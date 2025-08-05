import { fetchPendingDeliveries, updateDeliveryStatus } from './supabaseService.js';
import { forwardToExternalService } from './externalDeliveryService.js';
import { RETRY_INTERVAL, EXTERNAL_RETRY_LIMIT } from '../config.js';

export const retryPendingDeliveries = async (): Promise<void> => {
  const deliveries = await fetchPendingDeliveries();

  for (const delivery of deliveries) {
    const {
      id,
      topic,
      payload,
      target_url: targetUrl,
      attempt_count: attemptCount
    } = delivery;

    try {
      const { statusCode, responseBody } = await forwardToExternalService(
        topic,
        payload,
        targetUrl,
        attemptCount + 1,
        id // reuse delivery ID
      );

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