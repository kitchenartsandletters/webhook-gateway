import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { WebhookProcessingError } from '../utils/errors.js';
import { forwardToExternalService } from './externalDeliveryService.js';
import { supabase } from './supabaseService.js';
import { forwardToPreorderInternal } from '../utils/preorderForwarder.js';

const USED_BOOKS_WEBHOOK_URL = (process.env.USED_BOOKS_WEBHOOK_URL || '') as string;
const PREORDER_WEBHOOK_URL   = (process.env.PREORDER_WEBHOOK_URL || process.env.PREORDER_SERVICE_URL || '') as string;
const SHOP_URL               = process.env.SHOP_URL || '';
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || '';

// const ENABLE_PREORDER_ROUTING = process.env.ENABLE_PREORDER_ROUTING === 'true';

/**
 * Expanded Phase 2 routing including products/update and enhanced preorder tracking topics.
 * This includes forwarding to both used-books and preorder services,
 * with consistent error handling and gating by ENABLE_PREORDER_ROUTING.
 */
async function forwardJson(topic: string, payload: any, url: string, attempt = 1, deliveryId?: string): Promise<string | undefined> {
  if (!url) return Promise.resolve(undefined); // no-op if no target configured

  const safeId = deliveryId && /^[0-9a-fA-F-]{36}$/.test(deliveryId)
    ? deliveryId
    : randomUUID();

  const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
  const hmac = crypto.createHmac('sha256', SHOPIFY_WEBHOOK_SECRET).update(rawBody).digest('base64');
  const shopifyHeaders = { hmac, topic, shopDomain: SHOP_URL };

  // ✅ ensure the event_id exists in webhook_logs first
  await supabase
    .from('webhook_logs')
    .upsert({
      id: safeId,
      topic,
      payload,
      shop_domain: SHOP_URL,
      received_at: new Date().toISOString()
    }, { onConflict: 'id' });

  // now forward
  await forwardToExternalService({
    rawBody,
    topic,
    shopifyHeaders,
    attempt,
    deliveryId: safeId,
    url
  });
  return safeId;
}

export type TopicHandler = (payload: any) => void;

export const topicHandlers: Record<string, TopicHandler> = {
  'orders/create': (payload) => {
    console.log('[Handler] orders/create:', payload.id);
    // if (!ENABLE_PREORDER_ROUTING) return; // 👈 valid here
    forwardJson('orders/create', payload, PREORDER_WEBHOOK_URL)
    .catch(err => console.error('[Error] forwarding orders/create (preorder):', err));
  },
  'orders/fulfilled': (payload) => {
    // if (!ENABLE_PREORDER_ROUTING) return; // 👈 valid here
    if (!payload.fulfillment_status || payload.fulfillment_status !== 'fulfilled') {
      throw new WebhookProcessingError('Invalid fulfillment status', {
        orderId: payload.id,
        fulfillment_status: payload.fulfillment_status
      });
    }
    console.log('[Handler] orders/fulfilled:', payload.id);
    forwardJson('orders/fulfilled', payload, PREORDER_WEBHOOK_URL)
    .catch(err => console.error('[Error] forwarding orders/fulfilled (preorder):', err));
  },
  'orders/cancelled': (payload) => {
    console.log('[Handler] orders/cancelled:', payload.id);
    // if (!ENABLE_PREORDER_ROUTING) return; // 👈 valid here
    forwardJson('orders/cancelled', payload, PREORDER_WEBHOOK_URL)
    .catch(err => console.error('[Error] forwarding orders/cancelled (preorder):', err));
  },
  'orders/updated': (payload) => {
    console.log('[Handler] orders/updated:', payload.id);
    // if (!ENABLE_PREORDER_ROUTING) return; // 👈 valid here
    forwardJson('orders/updated', payload, PREORDER_WEBHOOK_URL)
    .catch(err => console.error('[Error] forwarding orders/updated (preorder):', err));
  },
  'refunds/create': (payload) => {
    console.log('[Handler] refunds/create:', payload.id);
    // if (!ENABLE_PREORDER_ROUTING) return; // 👈 valid here
    forwardJson('refunds/create', payload, PREORDER_WEBHOOK_URL)
    .catch(err => console.error('[Error] forwarding refunds/create (preorder):', err));
  },
  'inventory_levels/update': (payload) => {
    console.log('[Handler] inventory_levels/update:', payload);

    Promise.allSettled([
      (async () => {
        const eventId = await forwardJson('inventory_levels/update', payload, USED_BOOKS_WEBHOOK_URL);
        return forwardToPreorderInternal({
          event_id: eventId, // <-- include event_id for better tracking
          type: 'inventory.updated',
          inventory_item_id: payload.inventory_item_id
        });
      })()
    ]).then(results => {
      results.forEach((r, i) => {
        const target = i === 0 ? 'used-books' : 'preorder-internal';
        if (r.status === 'rejected') {
          console.error(`[Error] forwarding inventory_levels/update (${target}):`, r.reason);
        }
      });
    });
  },
  'products/update': (payload) => {
    console.log('[Handler] products/update:', payload.id);

    Promise.allSettled([
      (async () => {
        const eventId = await forwardJson('products/update', payload, USED_BOOKS_WEBHOOK_URL);
        return forwardToPreorderInternal({
          event_id: eventId, // <-- include event_id for better tracking
          type: 'product.updated',
          product_id: payload.id
        });
      })()
    ]).then(results => {
      results.forEach((r, i) => {
        const target = i === 0 ? 'used-books' : 'preorder-internal';
        if (r.status === 'rejected') {
          console.error(`[Error] forwarding products/update (${target}):`, r.reason);
        }
      });
    });
  },
  'products/create': (payload) => {
    console.log('[Handler] products/create:', payload.id);

    forwardJson('products/create', payload, USED_BOOKS_WEBHOOK_URL)
      .then(eventId => forwardToPreorderInternal({
        event_id: eventId, // <-- include event_id for better tracking
        type: 'product.updated', // ← intentionally SAME as update
        product_id: payload.id
      }))
      .catch(err => {
        console.error('[Error] forwarding products/create (preorder-internal):', err);
      });
  },
};
