import crypto from 'crypto';
import { fetchPendingDeliveries, updateDeliveryStatus } from './supabaseService.js';
import { forwardToExternalService } from './externalDeliveryService.js';
import { RETRY_INTERVAL, EXTERNAL_RETRY_LIMIT, SHOPIFY_WEBHOOK_SECRET } from '../config.js';
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

    // headers may be stored as a JSON string **or** as an object depending on the inserter.
    let savedHeaders: any = undefined;
    if (headers) {
      if (typeof headers === 'string') {
        try {
          savedHeaders = JSON.parse(headers);
        } catch {
          // if it's not valid JSON, fall back to undefined (we'll still deliver without HMAC)
          savedHeaders = undefined;
        }
      } else if (typeof headers === 'object') {
        savedHeaders = headers;
      }
    }

    try {
      const rawBody: Buffer = Buffer.from(
        typeof payload === 'string' ? payload : JSON.stringify(payload),
        'utf8'
      );

      const hdrTopic =
        (savedHeaders?.['X-Shopify-Topic'] as string) ||
        (savedHeaders?.['x-shopify-topic'] as string) ||
        topic;

      const hdrShopDomain =
        (savedHeaders?.['X-Shopify-Shop-Domain'] as string) ||
        (savedHeaders?.['x-shopify-shop-domain'] as string) ||
        '';

      const replayHmac = crypto
        .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('base64');

      const shopifyHeaders = {
        hmac: replayHmac,
        topic: hdrTopic,
        shopDomain: hdrShopDomain,
      };

      const { statusCode, responseBody } = await forwardToExternalService({
        topic: hdrTopic,
        rawBody,
        shopifyHeaders,
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

  // headers may be stored as a JSON string **or** as an object depending on the inserter.
  let savedHeaders: any = undefined;
  if (headers) {
    if (typeof headers === 'string') {
      try {
        savedHeaders = JSON.parse(headers);
      } catch {
        // if it's not valid JSON, fall back to undefined (we'll still deliver without HMAC)
        savedHeaders = undefined;
      }
    } else if (typeof headers === 'object') {
      savedHeaders = headers;
    }
  }

  try {
    const rawBody: Buffer = Buffer.from(
      typeof payload === 'string' ? payload : JSON.stringify(payload),
      'utf8'
    );

    const hdrTopic =
      (savedHeaders?.['X-Shopify-Topic'] as string) ||
      (savedHeaders?.['x-shopify-topic'] as string) ||
      topic;

    const hdrShopDomain =
      (savedHeaders?.['X-Shopify-Shop-Domain'] as string) ||
      (savedHeaders?.['x-shopify-shop-domain'] as string) ||
      '';

    const replayHmac = crypto
      .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('base64');

    const shopifyHeaders = {
      hmac: replayHmac,
      topic: hdrTopic,
      shopDomain: hdrShopDomain,
    };

    const { statusCode, responseBody } = await forwardToExternalService({
      topic: hdrTopic,
      rawBody,
      shopifyHeaders,
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