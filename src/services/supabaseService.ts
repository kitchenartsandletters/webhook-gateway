import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const insertWebhookLog = async (source: string, payload: any) => {
  const { error } = await supabase.from('webhook_logs').insert([{ source, payload }]);
  if (error) throw new Error(`[Supabase] ${error.message}`);
};
