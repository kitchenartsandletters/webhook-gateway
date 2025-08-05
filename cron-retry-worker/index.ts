import 'dotenv/config';
import { retryPendingDeliveries } from '../src/services/retryService';

(async () => {
  try {
    await retryPendingDeliveries();
    console.log('✅ Retry job complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Retry job failed:', err);
    process.exit(1);
  }
})();