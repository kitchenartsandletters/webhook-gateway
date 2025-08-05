export const getEnv = (key: string): string => {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
};

export const EXTERNAL_HMAC_SECRET = getEnv('EXTERNAL_HMAC_SECRET');
export const USED_BOOKS_WEBHOOK_URL = getEnv('USED_BOOKS_WEBHOOK_URL');
export const EXTERNAL_RETRY_LIMIT = parseInt(process.env.EXTERNAL_RETRY_LIMIT || '3', 10);
export const EXTERNAL_RETRY_INTERVAL_SECONDS = parseInt(process.env.EXTERNAL_RETRY_INTERVAL_SECONDS || '60', 10);

export const SUPABASE_URL = getEnv('SUPABASE_URL');
export const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
export const GITHUB_REPO = getEnv('GITHUB_REPO');
export const GITHUB_TOKEN = getEnv('GITHUB_TOKEN');

export const FASTAPI_INTERNAL_URL = getEnv('FASTAPI_INTERNAL_URL');
export const SHOPIFY_WEBHOOK_SECRET = getEnv('SHOPIFY_WEBHOOK_SECRET');