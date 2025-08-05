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

  const { error } = await supabase.from('external_deliveries').insert([{
    event_id: eventId,
    topic,
    target_url: targetUrl,
    payload,
    headers,
    status,
    response_code: responseCode,
    response_body: responseBody,
    attempt_count: attemptCount,
    last_attempt_at: new Date().toISOString()
  }]);

  if (error) {
    console.error('[Supabase Logging Error]', error);
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
