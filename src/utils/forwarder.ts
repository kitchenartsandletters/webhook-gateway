import fetch from 'node-fetch';

export const forwardToFastAPI = async (endpoint: string, body: any) => {
  const url = process.env.FASTAPI_INTERNAL_URL + endpoint;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`[Forwarding Error] ${res.statusText}`);
};
