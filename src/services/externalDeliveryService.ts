import fetch from 'node-fetch';
import { logDeliveryAttempt } from './deliveryLogger.js';
import { EXTERNAL_HMAC_SECRET, EXTERNAL_RETRY_LIMIT, EXTERNAL_RETRY_INTERVAL_SECONDS } from '../config.js';
import { generateHmacHeader } from '../utils/hmac.js';
import { addToQueue } from '../utils/deliveryQueue.js';

const MAX_ATTEMPTS = EXTERNAL_RETRY_LIMIT;
const RETRY_INTERVAL = EXTERNAL_RETRY_INTERVAL_SECONDS * 1000;

type ShopifyHeaders = {
  hmac: string;
  topic: string;
  shopDomain: string;
  /** Optional convenience hint for downstream */
  availableHint?: string;
};

type ForwardArgs = {
  topic: string;
  rawBody: Buffer;                         // exact bytes from Shopify
  shopifyHeaders: ShopifyHeaders;          // pass-through headers
  url: string;
  attempt?: number;
  deliveryId?: string;                     // webhook_logs.id
};

// --- Helpers ---
const safeParse = (buf: Buffer) => {
  try { return JSON.parse(buf.toString('utf8')); } catch { return null; }
};

type RetryItem = {
  type: 'options';
  args: ForwardArgs;
};

// Schedules a retry that preserves rawBody + Shopify headers
const scheduleRetry = (item: RetryItem) => {
  const { args } = item;
  const nextAttempt = (args.attempt ?? 1) + 1;

  addToQueue({
    topic: args.topic,
    targetUrl: args.url,
    attemptCount: nextAttempt,
    delayMs: RETRY_INTERVAL,

    // ✅ satisfy current DeliveryItem contract
    payload: safeParse(args.rawBody),

    // keep raw bytes + headers alive in the closure
    retry: () => forwardToExternalService({
      ...args,
      attempt: nextAttempt
    }),
  });
};

// ---- Overloads for backward compatibility ----
export function forwardToExternalService(
  topic: string,
  payload: any,
  url: string,
  attempt?: number,
  deliveryId?: string
): Promise<{ statusCode: number; responseBody: string }>;
export function forwardToExternalService(args: ForwardArgs): Promise<{ statusCode: number; responseBody: string }>;

// ---- Implementation ----
export async function forwardToExternalService(
  a: any,
  b?: any,
  c?: any,
  d?: any,
  e?: any
): Promise<{ statusCode: number; responseBody: string }> {

  // New path: options object with rawBody + shopify headers
  if (typeof a === 'object' && a && 'rawBody' in a && 'shopifyHeaders' in a) {
    const args = a as ForwardArgs;
    const {
      topic,
      rawBody,
      shopifyHeaders,
      url,
      attempt = 1,
      deliveryId
    } = args;

    // Gateway provenance signature (optional; accepts Buffer)
    const timestamp = new Date().toISOString();
    const gatewaySig = generateHmacHeader(rawBody, EXTERNAL_HMAC_SECRET, timestamp);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Pass-through Shopify headers for downstream HMAC verification
          'X-Shopify-Hmac-Sha256': shopifyHeaders.hmac,
          'X-Shopify-Topic': shopifyHeaders.topic,
          'X-Shopify-Shop-Domain': shopifyHeaders.shopDomain,
          // Optional gateway provenance
          'X-Gateway-Signature': gatewaySig,
          'X-Gateway-Timestamp': timestamp,
          'X-Retry-Attempt': String(attempt),
          // Optional hint (only sent if present)
          ...(shopifyHeaders.availableHint
            ? { 'X-Available-Hint': String(shopifyHeaders.availableHint) }
            : {}),
        },
        body: rawBody,  // ← CRITICAL: exact bytes
      });

      const responseText = await res.text();
      const ok = res.status >= 200 && res.status < 300;

      await logDeliveryAttempt({
        eventId: deliveryId!, // we expect a real UUID from controller
        topic,
        targetUrl: url,
        payload: safeParse(rawBody), // log JSON for observability
        headers: {
          'X-Shopify-Hmac-Sha256': shopifyHeaders.hmac,
          'X-Shopify-Topic': shopifyHeaders.topic,
          'X-Shopify-Shop-Domain': shopifyHeaders.shopDomain,
          'X-Gateway-Signature': gatewaySig,
          'X-Gateway-Timestamp': timestamp,
          'X-Retry-Attempt': String(attempt),
        },
        status: ok ? 'success' : 'failed',
        responseCode: res.status,
        responseBody: responseText,
        attemptCount: attempt,
        hardFail: !ok && attempt >= MAX_ATTEMPTS,
      });

      if (!ok && attempt < MAX_ATTEMPTS) {
        console.warn(`[Retry] ${topic} failed (attempt ${attempt}). Retrying in ${RETRY_INTERVAL / 1000}s...`);
        scheduleRetry({ type: 'options', args });
      } else if (!ok) {
        console.error(`[Hard Fail] ${topic} failed after ${attempt} attempts.`);
      }

      return { statusCode: res.status, responseBody: responseText };

    } catch (err: any) {
      if (attempt < MAX_ATTEMPTS) {
        console.error(`[Retryable Error] ${topic} (attempt ${attempt}): ${err.message}`);
        scheduleRetry({ type: 'options', args });
      } else {
        console.error(`[Hard Fail] ${topic} exception after ${attempt} attempts: ${err.message}`);
        await logDeliveryAttempt({
          eventId: deliveryId!,
          topic,
          targetUrl: url,
          payload: safeParse(rawBody),
          headers: {
            'X-Shopify-Hmac-Sha256': shopifyHeaders.hmac,
            'X-Shopify-Topic': shopifyHeaders.topic,
            'X-Shopify-Shop-Domain': shopifyHeaders.shopDomain,
            'X-Gateway-Signature': gatewaySig,
            'X-Gateway-Timestamp': timestamp,
            'X-Retry-Attempt': String(attempt),
          },
          status: 'failed',
          responseCode: 0,
          responseBody: err.message,
          attemptCount: attempt,
          hardFail: true,
        });
      }
      return { statusCode: 0, responseBody: (err as Error).message };
    }
  }

  // Legacy path (kept for compatibility): (topic, payload, url, attempt, deliveryId)
  const topic = a as string;
  const payload = b;
  const url = c as string;
  const attempt = (d as number) ?? 1;
  const deliveryId = e as string | undefined;

  // Build a raw body from the JSON payload for legacy callers.
  // NOTE: This is not Shopify's original bytes; shopifyController will be updated next to use the options path.
  const rawBody = Buffer.from(JSON.stringify(payload ?? {}), 'utf8');
  const shopifyHeaders: ShopifyHeaders = {
    hmac: '', // not available in legacy path
    topic,
    shopDomain: '', // not available in legacy path
  };

  // Delegate to options path
  return forwardToExternalService({
    topic,
    rawBody,
    shopifyHeaders,
    url,
    attempt,
    deliveryId,
  });
}