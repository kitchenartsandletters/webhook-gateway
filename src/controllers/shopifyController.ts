import crypto from 'crypto';
import { Request, Response } from 'express';
import { insertWebhookLog } from '../services/supabaseService.js';
import { forwardToFastAPI } from '../utils/forwarder.js';

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

  try {
    await insertWebhookLog('shopify', parsedBody);
    await forwardToFastAPI('/webhooks/shopify', parsedBody);
    res.status(200).send('Received');
  } catch (err) {
    console.error('[Webhook Error]', err);
    res.status(500).send('Internal Error');
  }
};