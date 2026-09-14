import { useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { invalidate } from '../lib/queryClient';

interface Options {
  /** Table name to watch. */
  table: string;
  /** Postgres filter, e.g. `organization_id=eq.${orgId}`. */
  filter?: string;
  /** Cache key prefixes to invalidate on any change. */
  invalidateKeys: string[];
  enabled?: boolean;
}

/**
 * Subscribe to Postgres changes on a table and invalidate related caches.
 * Components using useSupabaseQuery will refetch automatically.
 *
 *   useRealtime({ table: 'tickets', filter: `organization_id=eq.${orgId}`,
 *                 invalidateKeys: ['tickets'] });
 */
export function useRealtime({ table, filter, invalidateKeys, enabled = true }: Options) {
  useEffect(() => {
    if (!enabled) return;
    const sb = getSupabase();
    const channel = sb
      .channel(`rt:${table}:${filter ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        () => {
          invalidateKeys.forEach((k) => invalidate(k));
        }
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [table, filter, enabled, ...invalidateKeys]);
}
