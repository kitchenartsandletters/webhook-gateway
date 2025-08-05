import express from 'express';
import { fetchDeliveryLog, markDeliveryAsReplayed } from '../services/supabaseService.js';
import { forwardToExternalService } from '../services/externalDeliveryService.js';

const router = express.Router();

router.post('/replay-delivery/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const delivery = await fetchDeliveryLog(id);

    if (!delivery || !delivery.payload || !delivery.target_url || !delivery.topic) {
      return res.status(400).json({ error: 'Malformed or incomplete delivery record' });
    }

    await forwardToExternalService(
      delivery.topic,
      delivery.payload,
      delivery.target_url,
      delivery.attempt_count + 1
    );

    await markDeliveryAsReplayed(id);

    return res.status(200).json({ success: true, message: 'Replay initiated' });

  } catch (err: any) {
    console.error('[Replay Error]', err.message);
    return res.status(500).json({ error: 'Replay failed', detail: err.message });
  }
});

export default router;
