import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      // Session lives only for the browser tab, so a fresh start requires signing in again.
      auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true },
    })
  : null;
