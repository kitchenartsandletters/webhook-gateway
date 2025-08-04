import { Router } from 'express';
import { handleShopifyWebhook } from '../controllers/shopifyController.js';
import express from 'express';

const router = Router();

// Use raw body parser for HMAC validation
router.post('/shopify', express.raw({ type: 'application/json' }), handleShopifyWebhook);

export default router;