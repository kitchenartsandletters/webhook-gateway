import { fetchPendingDeliveries, updateDeliveryStatus } from './supabaseService.js';
import { forwardToExternalService } from './externalDeliveryService.js';
import { RETRY_INTERVAL, EXTERNAL_RETRY_LIMIT } from '../config.js';
import { fetchDeliveryById } from './supabaseService.js'; // Make sure this exists too

export const retryPendingDeliveries = async (): Promise<void> => {
  const deliveries = await fetchPendingDeliveries();

  for (const delivery of deliveries) {
    const {
      id,
      topic,
      payload,
      target_url: targetUrl,
      attempt_count: attemptCount,
      headers
    } = delivery;

    // Reuse the exact raw payload and the original Shopify headers so HMAC validation can pass downstream.
    // `headers` is stored as a JSON string in the database; parse it if present.
    const savedHeaders = headers ? JSON.parse(headers) : undefined;

    try {
      const { statusCode, responseBody } = await forwardToExternalService({
        topic,
        rawBody: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload), 'utf8'),
        shopifyHeaders: savedHeaders || { hmac: '', topic, shopDomain: '' },
        url: targetUrl,
        attempt: attemptCount + 1,
        deliveryId: id,
      });

      await updateDeliveryStatus(id, 'success', statusCode, responseBody, attemptCount + 1);
    } catch (err: any) {
      const nextRetry = new Date(Date.now() + RETRY_INTERVAL * 1000).toISOString();

      await updateDeliveryStatus(
        id,
        'failed',
        err?.statusCode || 500,
        err?.message || 'Retry failed',
        attemptCount + 1,
        attemptCount + 1 < EXTERNAL_RETRY_LIMIT ? nextRetry : undefined
      );
    }
  }
};

export const retrySingleDelivery = async (id: string): Promise<void> => {
  const delivery = await fetchDeliveryById(id);

  if (!delivery) {
    throw new Error(`Delivery with ID ${id} not found`);
  }

  const {
    topic,
    payload,
    target_url: targetUrl,
    attempt_count: attemptCount,
    headers
  } = delivery;

  // Preserve original headers for downstream HMAC validation.
  const savedHeaders = headers ? JSON.parse(headers) : undefined;

  try {
    const { statusCode, responseBody } = await forwardToExternalService({
      topic,
      rawBody: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload), 'utf8'),
      shopifyHeaders: savedHeaders || { hmac: '', topic, shopDomain: '' },
      url: targetUrl,
      attempt: attemptCount + 1,
      deliveryId: id,
    });

    await updateDeliveryStatus(id, 'success', statusCode, responseBody, attemptCount + 1);
  } catch (err: any) {
    const nextRetry = new Date(Date.now() + RETRY_INTERVAL * 1000).toISOString();

    await updateDeliveryStatus(
      id,
      'failed',
      err?.statusCode || 500,
      err?.message || 'Retry failed',
      attemptCount + 1,
      attemptCount + 1 < EXTERNAL_RETRY_LIMIT ? nextRetry : undefined
    );
  }
};