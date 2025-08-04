import { Router } from 'express';
import { handleShopifyWebhook } from '../controllers/shopifyController.js';

const router = Router();
router.post('/shopify', handleShopifyWebhook);
export default router;
