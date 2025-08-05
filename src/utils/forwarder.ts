import fetch from 'node-fetch';
import { FASTAPI_INTERNAL_URL } from '../config.js';

export const forwardToFastAPI = async (endpoint: string, body: any) => {
  const url = FASTAPI_INTERNAL_URL + endpoint;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`[Forwarding Error] ${res.statusText}`);
};
