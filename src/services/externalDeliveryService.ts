import fetch from 'node-fetch';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logDeliveryAttempt } from './deliveryLogger.js';
import { EXTERNAL_HMAC_SECRET, EXTERNAL_RETRY_LIMIT, EXTERNAL_RETRY_INTERVAL_SECONDS } from '../config.js';

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

const signPayload = (payload: any): string => {
  const raw = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', EXTERNAL_HMAC_SECRET);
  hmac.update(raw);
  return hmac.digest('base64');
};

export const forwardToExternalService = async (topic: string, payload: any, url: string, attempt = 1): Promise<void> => {
  const signature = signPayload(payload);
  const timestamp = new Date().toISOString();

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
      scheduleRetry(topic, payload, url, attempt + 1);
    } else if (!isSuccess) {
      console.error(`[Hard Fail] ${topic} failed after ${attempt} attempts.`);
      await logDeliveryAttempt({
        eventId: payload.id || 'unknown',
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
        eventId: payload.id || 'unknown',
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
    }

  } catch (err: any) {
    if (attempt < MAX_ATTEMPTS) {
      console.error(`[Retryable Error] ${topic} (attempt ${attempt}): ${err.message}`);
      scheduleRetry(topic, payload, url, attempt + 1);
    } else {
      console.error(`[Hard Fail] ${topic} exception after ${attempt} attempts: ${err.message}`);
      await logDeliveryAttempt({
        eventId: payload.id || 'unknown',
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
  }
};

const scheduleRetry = (topic: string, payload: any, url: string, attempt: number) => {
  const id = uuidv4();
  retryQueue.push({ id, topic, url, payload, attempt });

  setTimeout(() => {
    const attemptIndex = retryQueue.findIndex(a => a.id === id);
    if (attemptIndex >= 0) {
      const attemptData = retryQueue.splice(attemptIndex, 1)[0];
      forwardToExternalService(attemptData.topic, attemptData.payload, attemptData.url, attemptData.attempt);
    }
  }, RETRY_INTERVAL);
};