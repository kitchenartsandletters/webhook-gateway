// src/routes/replayDelivery.ts
import express from 'express';
import { retrySingleDelivery } from '../services/retryService.js';

const router = express.Router();

router.post('/replay/:id', async (req, res) => {
  const deliveryId = req.params.id;

  if (!deliveryId) {
    return res.status(400).json({ error: 'Missing delivery ID' });
  }

  try {
    await retrySingleDelivery(deliveryId);
    res.status(200).json({ success: true, message: `Replayed delivery ${deliveryId}` });
  } catch (err: unknown) {
  console.error('[Replay Route Error]', err);
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  res.status(500).json({ success: false, error: 'Replay failed', details: message });
}
});

export default router;