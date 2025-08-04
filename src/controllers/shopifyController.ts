import crypto from 'crypto';
import { Request, Response } from 'express';
import { insertWebhookLog } from '../services/supabaseService.js';
import { forwardToFastAPI } from '../utils/forwarder.js';
import { topicHandlers } from '../services/topicHandlers.js';
import { WebhookProcessingError } from '../utils/errors.js';
import { createGitHubIssue } from '../services/githubService.js'; // Assuming this is a utility to create GitHub issues

export const handleShopifyWebhook = async (req: Request, res: Response) => {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const rawBody = (req as any).body; // Buffer
  const calculatedHmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
    .update(rawBody, 'utf8')
    .digest('base64');

  if (calculatedHmac !== hmacHeader) {
    console.warn('[HMAC Mismatch]');
    return res.status(401).send('HMAC validation failed');
  }

  const parsedBody = JSON.parse(rawBody.toString());
  const topic = req.get('X-Shopify-Topic') || 'unknown';
  const shopDomain = req.get('X-Shopify-Shop-Domain') || 'unknown.myshopify.com';

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

  try {
    await insertWebhookLog('shopify', parsedBody, topic, shopDomain);
    if (process.env.NODE_ENV !== 'production') {
      await forwardToFastAPI('/webhooks/shopify', parsedBody);
    }
    res.status(200).send('Received');
  } catch (err) {
    console.error('[Webhook Error]', err);
    res.status(500).send('Internal Error');
  }
};