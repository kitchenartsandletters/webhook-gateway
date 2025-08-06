import { retryPendingDeliveries } from '../src/services/retryService';

const run = async () => {
  console.log('[Cron Retry Worker] Starting retry job...');
  await retryPendingDeliveries();
  console.log('[Cron Retry Worker] Job complete. Exiting.');
};

run().catch((err) => {
  console.error('[Cron Retry Worker] Error:', err);
  process.exit(1);
});