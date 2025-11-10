import crypto from 'crypto';
import { WebhookProcessingError } from '../utils/errors.js';
import { forwardToExternalService } from './externalDeliveryService.js';

const USED_BOOKS_WEBHOOK_URL = (process.env.USED_BOOKS_WEBHOOK_URL || '') as string;
const PREORDER_WEBHOOK_URL   = (process.env.PREORDER_WEBHOOK_URL || process.env.PREORDER_SERVICE_URL || '') as string;
const SHOP_URL               = process.env.SHOP_URL || '';
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || '';

const ENABLE_PREORDER_ROUTING = process.env.ENABLE_PREORDER_ROUTING === 'true';

function forwardJson(topic: string, payload: any, url: string, attempt = 1, deliveryId = 'manual-replay') {
  if (!url) return Promise.resolve(); // silently no-op if target not configured
  const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
  const hmac = crypto.createHmac('sha256', SHOPIFY_WEBHOOK_SECRET).update(rawBody).digest('base64');
  const shopifyHeaders = {
    hmac,
    topic,
    shopDomain: SHOP_URL
  };
  return forwardToExternalService({
    rawBody,
    topic,
    shopifyHeaders,
    attempt,
    deliveryId,
    url
  });
}

export type TopicHandler = (payload: any) => void;

export const topicHandlers: Record<string, TopicHandler> = {
  'orders/create': (payload) => {
    console.log('[Handler] orders/create:', payload.id);
    if (!ENABLE_PREORDER_ROUTING) return; // 👈 valid here
    forwardJson('orders/create', payload, PREORDER_WEBHOOK_URL)
    .catch(err => console.error('[Error] forwarding orders/create (preorder):', err));
  },
  'orders/fulfilled': (payload) => {
    if (!ENABLE_PREORDER_ROUTING) return; // 👈 valid here
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
    if (!ENABLE_PREORDER_ROUTING) return; // 👈 valid here
    forwardJson('orders/cancelled', payload, PREORDER_WEBHOOK_URL)
    .catch(err => console.error('[Error] forwarding orders/cancelled (preorder):', err));
  },
  'orders/updated': (payload) => {
    console.log('[Handler] orders/updated:', payload.id);
    if (!ENABLE_PREORDER_ROUTING) return; // 👈 valid here
    forwardJson('orders/updated', payload, PREORDER_WEBHOOK_URL)
    .catch(err => console.error('[Error] forwarding orders/updated (preorder):', err));
  },
  'refunds/create': (payload) => {
    console.log('[Handler] refunds/create:', payload.id);
    if (!ENABLE_PREORDER_ROUTING) return; // 👈 valid here
  },
  'inventory_levels/update': (payload) => {
    console.log('[Handler] inventory_levels/update:', payload);
    if (!ENABLE_PREORDER_ROUTING) return; // 👈 valid here
    Promise.allSettled([
      forwardJson('inventory_levels/update', payload, USED_BOOKS_WEBHOOK_URL),
      forwardJson('inventory_levels/update', payload, PREORDER_WEBHOOK_URL)
    ]).then(results => {
      results.forEach((r, i) => {
        const target = i === 0 ? 'used-books' : 'preorder';
        if (r.status === 'rejected') {
          console.error(`[Error] forwarding inventory_levels/update (${target}):`, r.reason);
        }
      });
    });
  },
  'products/update': (payload) => {
    console.log('[Handler] products/update:', payload);
    if (!ENABLE_PREORDER_ROUTING) return; // 👈 valid here
    Promise.allSettled([
      forwardJson('products/update', payload, USED_BOOKS_WEBHOOK_URL),
      forwardJson('products/update', payload, PREORDER_WEBHOOK_URL)
    ]).then(results => {
      results.forEach((r, i) => {
        const target = i === 0 ? 'used-books' : 'preorder';
        if (r.status === 'rejected') {
          console.error(`[Error] forwarding products/update (${target}):`, r.reason);
        }
      });
    });
  },
};
