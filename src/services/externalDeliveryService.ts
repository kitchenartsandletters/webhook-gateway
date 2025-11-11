import fetch from 'node-fetch';
import { logDeliveryAttempt } from './deliveryLogger.js';
import { supabase } from '../services/supabaseService.js';
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

    // --- Ensure deliveryId is a valid UUID or insert stub record ---
    let eventId = deliveryId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!eventId || typeof eventId !== 'string' || !uuidRegex.test(eventId)) {
      // Insert stub webhook_logs record
      const { data, error } = await supabase
        .from('webhook_logs')
        .insert({
          topic,
          shop_domain: shopifyHeaders.shopDomain,
          received_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) {
        console.error('[Stub Insert Error] Could not create placeholder webhook_logs entry:', error);
        throw error;
      }
      eventId = data.id;
      console.log(`[Stub Inserted] Created placeholder webhook_logs entry for replay: ${eventId}`);

      // New code: wait 100ms then verify insert
      await new Promise(r => setTimeout(r, 100));
      const verify = await supabase
        .from('webhook_logs')
        .select('id')
        .eq('id', eventId)
        .single();
      if (verify.error || !verify.data) {
        console.error('[Stub Verification Error] Inserted webhook_logs entry not found:', verify.error);
        throw new Error("Stub insert not persisted");
      }
      console.log("[Stub Confirmed] webhook_logs entry visible in DB:", verify.data?.id);

      // --- Force connection flush / visibility for Supabase pool ---
      try {
        await supabase.rpc('pg_sleep', { seconds: 0.2 });
        console.log('[Stub Visibility] pg_sleep(0.2) executed to ensure commit visibility');
      } catch (flushErr) {
        console.warn('[Stub Visibility] pg_sleep fallback failed (ignored):', flushErr.message);
      }
    }

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
        eventId: eventId!,
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
        // Ensure eventId is valid before logging
        let failedEventId = eventId;
        if (!failedEventId || typeof failedEventId !== 'string' || !uuidRegex.test(failedEventId)) {
          const { data, error } = await supabase
            .from('webhook_logs')
            .insert({
              topic,
              shop_domain: shopifyHeaders.shopDomain,
              received_at: new Date().toISOString(),
            })
            .select('id')
            .single();
          if (error) {
            console.error('[Stub Insert Error] Could not create placeholder webhook_logs entry:', error);
            throw error;
          }
          failedEventId = data.id;
          console.log(`[Stub Inserted] Created placeholder webhook_logs entry for replay: ${failedEventId}`);
        }
        console.error(`[Hard Fail] ${topic} exception after ${attempt} attempts: ${err.message}`);
        await logDeliveryAttempt({
          eventId: failedEventId!,
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