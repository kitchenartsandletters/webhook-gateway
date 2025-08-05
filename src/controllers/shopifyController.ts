import crypto from 'crypto';
import { SHOPIFY_WEBHOOK_SECRET } from '../config.js';
import { Request, Response } from 'express';
import { insertWebhookLog } from '../services/supabaseService.js';
import { forwardToFastAPI } from '../utils/forwarder.js';
import { topicHandlers } from '../services/topicHandlers.js';
import { WebhookProcessingError } from '../utils/errors.js';
import { createGitHubIssue } from '../services/githubService.js'; // Assuming this is a utility to create GitHub issues
import { forwardToExternalService } from '../services/externalDeliveryService.js';

export const handleShopifyWebhook = async (req: Request, res: Response) => {
  console.log('[DEBUG] Webhook received');
  console.log('[DEBUG] typeof req.body:', typeof req.body);
  console.log('[DEBUG] Buffer.isBuffer:', Buffer.isBuffer(req.body));
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const rawBody = req.body as Buffer; // Buffer
    console.log('[DEBUG] rawBody length:', rawBody.length);
    console.log('[DEBUG] rawBody (utf8):', rawBody.toString('utf8'));
  const calculatedHmac = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('base64');
  console.log('[DEBUG] Computed HMAC:', calculatedHmac);
  console.log('[DEBUG] Header HMAC:', hmacHeader);

  if (calculatedHmac !== hmacHeader) {
    console.warn('[HMAC Mismatch]');
    return res.status(401).send('HMAC validation failed');
  }

  const parsedBody = JSON.parse(rawBody.toString());
  const topic = req.get('X-Shopify-Topic') || 'unknown';
  const shopDomain = req.get('X-Shopify-Shop-Domain') || 'unknown.myshopify.com';

  console.log('[DEBUG] handling topic logic...');
  const handler = topicHandlers[topic];
  if (handler) {
    try {
      handler(parsedBody);
    } catch (err) {
      if (err instanceof WebhookProcessingError) {
        await createGitHubIssue(`Webhook failure: ${topic}`, `${err.message}\n\n${JSON.stringify(err.context, null, 2)}`);
      }
      console.error(`[Handler Error] ${topic}:`, err);
    }
  }
  console.log('[DEBUG] topic handler complete');

  try {
    console.log('[DEBUG] inserting into Supabase...');
    await insertWebhookLog('shopify', parsedBody, topic, shopDomain);
    console.log('[DEBUG] inserted into Supabase');
    if (topic === 'inventory_levels/update') {
      const destinationUrl = process.env.USED_BOOKS_WEBHOOK_URL!;
      if (destinationUrl) {
        console.log('[DEBUG] forwarding to external service...');
        await forwardToExternalService(topic, parsedBody, destinationUrl);
        console.log('[DEBUG] external delivery complete');
      } else {
        console.warn(`[Delivery Skipped] No destination set for topic: ${topic}`);
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEBUG] forwarding to internal service...');
      await forwardToFastAPI('/webhooks/shopify', parsedBody);
      console.log('[DEBUG] forwarded to internal service');
    }
    console.log('[DEBUG] sending 200 OK response');
    res.status(200).send('Received');
  } catch (err) {
    console.error('[Webhook Error]', err);
    res.status(500).send('Internal Error');
  }
};