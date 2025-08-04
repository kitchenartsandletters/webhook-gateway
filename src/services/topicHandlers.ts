import { WebhookProcessingError } from '../utils/errors.js';

export type TopicHandler = (payload: any) => void;

export const topicHandlers: Record<string, TopicHandler> = {
  'orders/create': (payload) => {
    console.log('[Handler] orders/create:', payload.id);
  },
  'orders/fulfilled': (payload) => {
    if (!payload.fulfillment_status || payload.fulfillment_status !== 'fulfilled') {
      throw new WebhookProcessingError('Invalid fulfillment status', {
        orderId: payload.id,
        fulfillment_status: payload.fulfillment_status
      });
    }
    console.log('[Handler] orders/fulfilled:', payload.id);
  },
  'orders/cancelled': (payload) => {
    console.log('[Handler] orders/cancelled:', payload.id);
  },
  'orders/updated': (payload) => {
    console.log('[Handler] orders/updated:', payload.id);
  },
  'refunds/create': (payload) => {
    console.log('[Handler] refunds/create:', payload.id);
  },
};
