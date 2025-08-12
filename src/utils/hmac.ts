import crypto from 'crypto';

// accept string OR Buffer
export const generateHmacHeader = (
  data: string | Buffer,
  secret: string,
  _timestamp?: string // kept for signature compatibility; not used in hashing
): string => {
  const hmac = crypto.createHmac('sha256', secret);
  if (typeof data === 'string') {
    hmac.update(data, 'utf8');
  } else {
    hmac.update(data); // Buffer
  }
  return hmac.digest('base64');
};
