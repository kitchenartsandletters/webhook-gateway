import crypto from 'crypto';
import { WebhookProcessingError } from '../utils/errors.js';
import { forwardToExternalService } from './externalDeliveryService.js';

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
  'inventory_levels/update': (payload) => {
    console.log('[Handler] inventory_levels/update:', payload);
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const hmac = crypto.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET || '').update(rawBody).digest('base64');
    const shopifyHeaders = {
      hmac,
      topic: 'inventory_levels/update',
      shopDomain: process.env.SHOP_URL || ''
    };
    forwardToExternalService({
      rawBody,
      topic: 'inventory_levels/update',
      shopifyHeaders,
      attempt: 1,
      deliveryId: 'manual-replay',
      url: (process.env.USED_BOOKS_WEBHOOK_URL || '') as string,
    }).catch((err) => {
      console.error('[Error] forwarding inventory_levels/update:', err);
    });
  },
  'products/update': (payload) => {
    console.log('[Handler] products/update:', payload);
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const hmac = crypto.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET || '').update(rawBody).digest('base64');
    const shopifyHeaders = {
      hmac,
      topic: 'products/update',
      shopDomain: process.env.SHOP_URL || ''
    };
    forwardToExternalService({
      rawBody,
      topic: 'products/update',
      shopifyHeaders,
      attempt: 1,
      deliveryId: 'manual-replay',
      url: (process.env.USED_BOOKS_WEBHOOK_URL || '') as string,
    }).catch((err) => {
      console.error('[Error] forwarding products/update:', err);
    });
  },
};
