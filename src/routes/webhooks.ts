import { Router } from 'express';
import { handleShopifyWebhook } from '../controllers/shopifyController.js';
import express from 'express';

const router = Router();

// no express.raw here anymore — index.ts handles it
router.post('/shopify', handleShopifyWebhook);

export default router;