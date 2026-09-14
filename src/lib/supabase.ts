/**
 * Supabase client — production wiring.
 * Fully Supabase-reliant; missing env vars throw at module load.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function assertConfigured() {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (missing.length) {
    throw new Error(
      `[Umhlaba Wami] Missing required Supabase env vars: ${missing.join(', ')}. ` +
        `Add them to your .env file.`
    );
  }
  if (supabaseUrl!.includes('your-project')) {
    throw new Error('[Umhlaba Wami] VITE_SUPABASE_URL still contains placeholder value.');
  }
}

assertConfigured();

let client: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!client) {
    client = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'umhlaba_wami_auth',
      },
      global: {
        headers: { 'x-application-name': 'umhlaba-wami' },
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  }
  return client;
};
