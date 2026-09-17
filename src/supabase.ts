import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wbguwmbwutvhqsirtjps.supabase.co';
const supabaseAnonKey = 'sb_publishable_HHSflu6QFeTOAOz32W2UdQ_wSQyiPIC';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseControl = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'control_de_horas' },
  auth: { 
    storageKey: 'control-horas-auth',
    persistSession: false, 
    autoRefreshToken: false, 
    detectSessionInUrl: false 
  }
});
