import { Router } from 'express';
import { fetchWebhookLog, markAsReplayed } from '../services/supabaseService.js';
import { topicHandlers } from '../services/topicHandlers.ts.old';

const router = Router();

router.post('/replay/:id', async (req, res) => {
  const { id } = req.params;
  const { note = '' } = req.body;

  try {
    const log = await fetchWebhookLog(id);

    const { payload, topic } = log;
    const handler = topicHandlers[topic];

    if (!handler) {
      return res.status(404).json({ error: `No handler defined for topic: ${topic}` });
    }

    handler(payload);
    await markAsReplayed(id, note);

    return res.status(200).json({ success: true, replayed: id });
  } catch (err) {
    console.error('[Replay Error]', err);
    const errorMessage = (err instanceof Error) ? err.message : String(err);
    return res.status(500).json({ error: 'Replay failed', detail: errorMessage });
  }
});

export default router;
