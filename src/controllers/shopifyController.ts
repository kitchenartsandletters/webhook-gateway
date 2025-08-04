import { Request, Response } from 'express';
import { insertWebhookLog } from '../services/supabaseService.js';
import { forwardToFastAPI } from '../utils/forwarder.js';

export const handleShopifyWebhook = async (req: Request, res: Response) => {
  try {
    const rawPayload = req.body;
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');

    // TODO: Add HMAC validation logic here

    await insertWebhookLog('shopify', rawPayload);

    await forwardToFastAPI('/webhooks/shopify', rawPayload);
    res.status(200).send('Received');
  } catch (err) {
    console.error('[Webhook Error]', err);
    res.status(500).send('Internal Error');
  }
};
