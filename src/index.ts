import express from 'express';
import dotenv from 'dotenv';
import webhookRoutes from './routes/webhooks.js';
import replayRoutes from './routes/replay.js';

dotenv.config();
const app = express();

app.use('/webhooks', webhookRoutes);
app.use('/replay', replayRoutes);

app.get('/health', (_, res) => res.status(200).send('OK'));
app.get('/test/ping', (_, res) => res.send({ pong: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Webhook Gateway running on port ${PORT}`));
