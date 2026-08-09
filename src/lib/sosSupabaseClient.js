import { createClient } from '@supabase/supabase-js';

export const sosSupabase = createClient(
  'https://cxdqkjvtpilvouwtbgdy.supabase.co',
  'sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
