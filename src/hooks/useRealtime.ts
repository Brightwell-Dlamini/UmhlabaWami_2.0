import { useEffect, useRef } from 'react';
import { tryGetSupabase } from '../lib/supabase';
import { invalidate } from '../lib/queryClient';

interface Options {
  table: string;
  filter?: string;
  invalidateKeys: string[];
  enabled?: boolean;
}

/**
 * Subscribe to Postgres changes and invalidate related caches once per event.
 * Dependency array is stabilised so we do NOT tear down/rebuild the channel
 * on every parent re-render (that loop froze the tab on logout).
 */
export function useRealtime({ table, filter, invalidateKeys, enabled = true }: Options) {
  const keysRef = useRef(invalidateKeys);
  keysRef.current = invalidateKeys;
  // Stable string so effect deps don't change when callers pass a new array literal
  const keysKey = invalidateKeys.join('|');

  useEffect(() => {
    if (!enabled) return;
    const sb = tryGetSupabase();
    if (!sb) return;

    const channelName = `rt:${table}:${filter ?? 'all'}`;
    const channel = sb
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        () => {
          // One-shot invalidation; query layer refetches once via needsRefetch
          keysRef.current.forEach((k) => invalidate(k));
        }
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [table, filter, enabled, keysKey]);
}
