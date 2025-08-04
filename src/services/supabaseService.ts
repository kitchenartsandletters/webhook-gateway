import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    .single();

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