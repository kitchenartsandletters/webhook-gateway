// tests/genHmac.js
import fs from 'fs';
import crypto from 'crypto';

const secret = process.env.SHOPIFY_API_SECRET || 'your-test-secret';

// Read file as raw Buffer
const buffer = fs.readFileSync('tests/test_payload.json');

// Log raw buffer
console.log('📦 Raw payload:', buffer.toString());

// Generate HMAC
const hmac = crypto.createHmac('sha256', secret).update(buffer).digest('base64');

console.log(`✅ HMAC: ${hmac}`);