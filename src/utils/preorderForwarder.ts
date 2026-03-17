import fetch from 'node-fetch';

const PREORDER_INTERNAL_URL = process.env.PREORDER_INTERNAL_URL!;
const PREORDER_ADMIN_TOKEN = process.env.PREORDER_ADMIN_TOKEN!;

export async function forwardToPreorderInternal(event: any) {
  if (!PREORDER_INTERNAL_URL) {
    console.warn('[Preorder] Missing PREORDER_INTERNAL_URL');
    return;
  }

  try {
    const res = await fetch(`${PREORDER_INTERNAL_URL}/internal/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': PREORDER_ADMIN_TOKEN,
      },
      body: JSON.stringify(event),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

  } catch (err) {
    console.error('[Preorder Forward Error]', err);
    throw err;
  }
}