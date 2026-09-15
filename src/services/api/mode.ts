/**
 * Backend mode gate.
 *
 * The ONLY place in the codebase that decides whether we talk to Supabase
 * or fall back to an in-memory store. Every `services/api/*` module branches
 * on `backendMode()` at the top of each function.
 *
 * When Supabase env vars are absent, `memory` mode activates and the seed
 * data in `services/db.ts` becomes the source of truth (demo only).
 *
 * Production MUST configure Supabase. `mode.ts` is the single chokepoint
 * where that requirement is enforced.
 */

import { isSupabaseConfigured } from '../../lib/supabase';

export type BackendMode = 'supabase' | 'memory';

export function backendMode(): BackendMode {
  return isSupabaseConfigured() ? 'supabase' : 'memory';
}

export function isMemoryMode(): boolean {
  return backendMode() === 'memory';
}

export function isSupabaseMode(): boolean {
  return backendMode() === 'supabase';
}

/**
 * Lazy import of the in-memory DB. Only called from within memory-mode
 * branches so we never even pull the demo seed into a production bundle
 * path (tree-shaking eliminates it when the branch is dead).
 */
export async function getMemoryDb() {
  const { db } = await import('../db');
  return db;
}
