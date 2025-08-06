import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const insertWebhookLog = async (source: string, payload: any, topic: string, shopDomain: string) => {
  const { data, error } = await supabase
    .from('webhook_logs')
    .insert([{ source, payload, topic, shop_domain: shopDomain }]);

  if (error) {
    console.error('[Supabase Insert Error]', error); // ← log actual error
    throw new Error(`[Supabase] ${error.message}`);
  }

  return data;
};

export const fetchWebhookLog = async (id: string) => {
  const { data, error } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('id', id)
    console.log('[Replay Debug]', data, error);

  if (error) {
    console.error('[Supabase Fetch Error]', error);
    throw new Error(`[Supabase] ${error.message}`);
  }

  return data;
};

export const markAsReplayed = async (id: string, notes: string) => {
  const { error } = await supabase
    .from('webhook_logs')
    .update({
      replayed: true,
      replay_notes: notes,
      replay_timestamp: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[Supabase Update Error]', error);
    throw new Error(`[Supabase] ${error.message}`);
  }
};
export const fetchDeliveryLog = async (id: string) => {
  const { data, error } = await supabase
    .from('external_deliveries')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[Supabase Fetch Delivery Error]', error);
    throw new Error(`[Supabase] ${error.message}`);
  }

  return data;
};

export const markDeliveryAsReplayed = async (id: string) => {
  const { error } = await supabase
    .from('external_deliveries')
    .update({
      replayed: true,
      last_attempt_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error('[Supabase Update Delivery Error]', error);
    throw new Error(`[Supabase] ${error.message}`);
  }
};

export const fetchPendingDeliveries = async (limit = 10) => {
  const { data, error } = await supabase
    .from('external_deliveries')
    .select('*')
    .or('status.eq.failed,status.eq.pending')
    .lte('next_retry_at', new Date().toISOString())
    .lt('attempt_count', 3)
    .limit(limit);

  if (error) {
    console.error('[Supabase Fetch Pending Deliveries Error]', error);
    throw new Error(`[Supabase] ${error.message}`);
  }

  return data;
};

export const updateDeliveryStatus = async (
  id: string,
  status: 'success' | 'failed',
  responseCode: number,
  responseBody: string,
  attemptCount: number,
  nextRetryAt?: string
) => {
  const updatePayload: any = {
    status,
    response_code: responseCode,
    response_body: responseBody,
    attempt_count: attemptCount,
    last_attempt_at: new Date().toISOString()
  };

  if (nextRetryAt) {
    updatePayload.next_retry_at = nextRetryAt;
  }

  const { error } = await supabase
    .from('external_deliveries')
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    console.error('[Supabase Update Delivery Status Error]', error);
    throw new Error(`[Supabase] ${error.message}`);
  }
};

export const fetchDeliveryById = async (id: string): Promise<any> => {
  const { data, error } = await supabase
    .from('external_deliveries')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
};