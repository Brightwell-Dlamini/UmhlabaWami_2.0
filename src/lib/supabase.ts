/**
 * Supabase client — production wiring.
 *
 * Supports a dual mode:
 * - When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (and are not placeholders),
 *   the app talks to Supabase with RLS.
 * - When they are missing, repository helpers fall back to the in-memory demo store.
 *
 * getSupabase() throws if called while unconfigured so production paths fail fast.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Returns true when both required Vite env vars are present and look real.
 * Safe to call at module load and during build (does not throw).
 */
export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (supabaseUrl.includes('your-project') || supabaseUrl.includes('placeholder')) return false;
  if (supabaseAnonKey.includes('your-anon') || supabaseAnonKey.includes('placeholder')) return false;
  return true;
}

let client: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client, or null when env is not configured.
 * Prefer this in optional / progressive-enhancement paths.
 */
export function tryGetSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return getSupabase();
}

/**
 * Returns the shared Supabase client. Throws if env vars are missing.
 * Use in production-only code paths that require a live backend.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
    throw new Error(
      `[Umhlaba Wami] Missing required Supabase env vars: ${missing.join(', ') || 'invalid placeholder values'}. ` +
        `Add them to your .env file (local) or Vercel project Environment Variables (deploy).`
    );
  }

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
}
