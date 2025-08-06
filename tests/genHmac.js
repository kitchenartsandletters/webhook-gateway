import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const payload = JSON.stringify({
  "id": 123456789,
  "email": "test@example.com"
});
const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

if (!secret) {
  console.error('❌ No SHOPIFY_WEBHOOK_SECRET in .env');
  process.exit(1);
}

const hmac = crypto
  .createHmac('sha256', secret)
  .update(payload, 'utf8') // Must be a string
  .digest('base64');

console.log(`✅ HMAC: ${hmac}`);