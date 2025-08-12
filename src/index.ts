import express from 'express';
import dotenv from 'dotenv';
import webhookRoutes from './routes/webhooks.js';
import replayRoutes from './routes/replay.js';
import replayDeliveryRoutes from './routes/replayDelivery.js';

dotenv.config();
const app = express();

// IMPORTANT: raw parser first for this route (before any JSON parser)
app.use('/webhooks/shopify', express.raw({ type: 'application/json' }));

app.use('/webhooks', webhookRoutes);
app.use('/replay', replayRoutes);
app.use('/', replayDeliveryRoutes);

app.get('/health', (_, res) => res.status(200).send('OK'));
app.get('/test/ping', (_, res) => res.send({ pong: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Webhook Gateway running on port ${PORT}`));

import retryPendingRoute from './routes/retryPending.js';
app.use('/', retryPendingRoute);
