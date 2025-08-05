import crypto from 'crypto';

/**
 * Generates a base64-encoded HMAC SHA256 signature for outbound payloads.
 * Format: HMAC(secret, timestamp + body)
 */
export const generateHmacHeader = (
  body: string,
  secret: string,
  timestamp: string
): string => {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(timestamp + body);
  return hmac.digest('base64');
};