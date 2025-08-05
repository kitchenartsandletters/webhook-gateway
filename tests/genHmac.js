import crypto from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.SHOPIFY_API_SECRET;
if (!secret) {
  console.error('❌ No SHOPIFY_API_SECRET in .env');
  process.exit(1);
}

const payload = fs.readFileSync('tests/test_payload.json', 'utf8');
const hmac = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('base64');

console.log('✅ HMAC:', hmac);