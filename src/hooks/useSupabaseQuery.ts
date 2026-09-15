import { useEffect, useState, useCallback, useRef } from 'react';
import { getEntry, setEntry, subscribe } from '../lib/queryClient';

interface Options {
  enabled?: boolean;
  /** Refresh interval in ms. Set to 0 to disable. */
  refreshInterval?: number;
}

/**
 * useSupabaseQuery — fetch-on-mount with cache + invalidation.
 *
 *   const { data, loading, error, refetch } = useSupabaseQuery(
 *     ['tickets', orgId],
 *     () => api.tickets.list(orgId)
 *   );
 *
 * After a mutation calls invalidate('tickets'), this hook refetches automatically.
 */
export function useSupabaseQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<T>,
  options: Options = {}
): {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<T | undefined>;
} {
  const keyStr = JSON.stringify(key);
  const [entry, setLocal] = useState(() => getEntry<T>(keyStr));
  const enabled = options.enabled ?? true;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    if (!enabled) return;
    setEntry<T>(keyStr, { loading: true, error: null });
    try {
      const data = await fetcherRef.current();
      setEntry<T>(keyStr, { data, loading: false, error: null, promise: null });
      return data;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setEntry<T>(keyStr, { error: err, loading: false, promise: null });
      return undefined;
    }
  }, [keyStr, enabled]);

  useEffect(() => {
    const unsub = subscribe(keyStr, () => {
      const next = getEntry<T>(keyStr);
      setLocal({ ...next });
      // Cache was cleared by invalidate() — refetch so UI updates without hard refresh
      if (enabled && next.data === undefined && !next.loading) {
        void run();
      }
    });
    setLocal({ ...getEntry<T>(keyStr) });

    if (enabled && getEntry<T>(keyStr).data === undefined && !getEntry<T>(keyStr).loading) {
      void run();
    }

    let interval: ReturnType<typeof setInterval> | undefined;
    if (options.refreshInterval && options.refreshInterval > 0) {
      interval = setInterval(() => void run(), options.refreshInterval);
    }

    return () => {
      unsub();
      if (interval) clearInterval(interval);
    };
  }, [keyStr, enabled, run, options.refreshInterval]);

  return { ...entry, refetch: run };
}
