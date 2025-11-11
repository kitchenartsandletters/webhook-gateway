import { createClient } from '@supabase/supabase-js';
import { createGitHubIssue } from './githubService.js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const logDeliveryAttempt = async (params: {
  eventId: string;
  topic: string;
  targetUrl: string;
  payload: any;
  headers: Record<string, string>;
  status: 'success' | 'failed';
  responseCode: number;
  responseBody: string;
  attemptCount: number;
  hardFail?: boolean;
}) => {
  const {
    eventId,
    topic,
    targetUrl,
    payload,
    headers,
    status,
    responseCode,
    responseBody,
    attemptCount,
    hardFail
  } = params;

  try {
    // ✅ Use atomic RPC for transactional insert
    const { data, error } = await supabase.rpc('upsert_webhook_and_delivery', {
      headers,
      payload,
      responsebody: responseBody,
      responsecode: responseCode,
      shopdomain: headers['X-Shopify-Shop-Domain'] || '',
      status,
      targeturl: targetUrl,
      topic
    });

    if (error) {
      console.error('[Supabase Logging Error]', error);
    } else {
      console.log(`[RPC Transaction] upsert_webhook_and_delivery succeeded for ${topic} (${eventId || 'new'})`);
    }
  } catch (rpcErr) {
    console.error('[Supabase RPC Exception]', rpcErr);
  }

  if (hardFail) {
    const issueTitle = `External Delivery Failure: ${topic}`;
    const issueBody = `
**Topic**: ${topic}
**Target URL**: ${targetUrl}
**Attempt**: ${attemptCount}
**Response Code**: ${responseCode}

\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`
`;
    try {
      await createGitHubIssue(issueTitle, issueBody);
    } catch (err) {
      console.error('[GitHub Issue Creation Error]', err);
    }
  }
};
