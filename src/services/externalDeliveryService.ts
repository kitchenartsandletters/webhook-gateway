import fetch from 'node-fetch';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logDeliveryAttempt } from './deliveryLogger.js';
import { EXTERNAL_HMAC_SECRET, EXTERNAL_RETRY_LIMIT, EXTERNAL_RETRY_INTERVAL_SECONDS } from '../config.js';
import { generateHmacHeader } from '../utils/hmac.js';
import { addToQueue } from '../utils/deliveryQueue.js';

const MAX_ATTEMPTS = EXTERNAL_RETRY_LIMIT;
const RETRY_INTERVAL = EXTERNAL_RETRY_INTERVAL_SECONDS * 1000;

// Now imported from config.ts

interface DeliveryAttempt {
  id: string;
  topic: string;
  url: string;
  payload: any;
  attempt: number;
}

const retryQueue: DeliveryAttempt[] = [];

const signPayload = (payload: any, timestamp: string): string => {
  return generateHmacHeader(JSON.stringify(payload), EXTERNAL_HMAC_SECRET, timestamp);
};

export const forwardToExternalService = async (
  topic: string,
  payload: any,
  url: string,
  attempt = 1,
  deliveryId?: string
): Promise<{ statusCode: number; responseBody: string }> => {
  const timestamp = new Date().toISOString();
  const signature = signPayload(payload, timestamp);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Signature': signature,
        'X-Gateway-Timestamp': timestamp,
        'X-Retry-Attempt': attempt.toString(),
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    const isSuccess = res.status >= 200 && res.status < 300;

    if (!isSuccess && attempt < MAX_ATTEMPTS) {
      console.warn(`[Retry] ${topic} failed (attempt ${attempt}). Retrying in ${RETRY_INTERVAL / 1000}s...`);
      scheduleRetry(topic, payload, url, attempt + 1, deliveryId);
    } else if (!isSuccess) {
      console.error(`[Hard Fail] ${topic} failed after ${attempt} attempts.`);
      await logDeliveryAttempt({
        eventId: deliveryId!,
        topic,
        targetUrl: url,
        payload,
        headers: {
          'X-Gateway-Signature': signature,
          'X-Gateway-Timestamp': timestamp,
          'X-Retry-Attempt': attempt.toString(),
        },
        status: 'failed',
        responseCode: res.status,
        responseBody: responseText,
        attemptCount: attempt,
        hardFail: true,
      });
    } else {
      console.log(`[External Delivery Success] ${topic} → ${url}`);
      await logDeliveryAttempt({
        eventId: deliveryId ?? (payload?.id || 'unknown'),
        topic,
        targetUrl: url,
        payload,
        headers: {
          'X-Gateway-Signature': signature,
          'X-Gateway-Timestamp': timestamp,
          'X-Retry-Attempt': attempt.toString(),
        },
        status: 'success',
        responseCode: res.status,
        responseBody: responseText,
        attemptCount: attempt,
      });
      return { statusCode: res.status, responseBody: responseText };
    }

  } catch (err: any) {
    if (attempt < MAX_ATTEMPTS) {
      console.error(`[Retryable Error] ${topic} (attempt ${attempt}): ${err.message}`);
      scheduleRetry(topic, payload, url, attempt + 1, deliveryId);
    } else {
      console.error(`[Hard Fail] ${topic} exception after ${attempt} attempts: ${err.message}`);
      await logDeliveryAttempt({
        eventId: deliveryId ?? (payload?.id || 'unknown'),
        topic,
        targetUrl: url,
        payload,
        headers: {
          'X-Gateway-Signature': signature,
          'X-Gateway-Timestamp': timestamp,
          'X-Retry-Attempt': attempt.toString(),
        },
        status: 'failed',
        responseCode: 0,
        responseBody: err.message,
        attemptCount: attempt,
        hardFail: true,
      });
    }
    return { statusCode: 0, responseBody: err.message };
  }

  // Final fallback (should never be hit, but satisfies TypeScript)
  return { statusCode: 500, responseBody: 'Unhandled delivery state' };
};

const scheduleRetry = (topic: string, payload: any, url: string, attempt: number, deliveryId?: string) => {
  addToQueue({
    topic,
    payload,
    targetUrl: url,
    attemptCount: attempt,
    delayMs: RETRY_INTERVAL,
    retry: () => forwardToExternalService(topic, payload, url, attempt, deliveryId)
  });
};