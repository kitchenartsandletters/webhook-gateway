import express from 'express';
import { retryPendingDeliveries } from '../services/retryService.js';

const router = express.Router();

router.get('/retry-pending', async (req, res) => {
  try {
    await retryPendingDeliveries();
    res.status(200).json({ success: true, message: 'Retry job complete' });
  } catch (err) {
    console.error('[Retry Route Error]', err);
    res.status(500).json({ success: false, error: 'Retry job failed' });
  }
});

export default router;