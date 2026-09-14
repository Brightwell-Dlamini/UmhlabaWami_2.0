import { useEffect, useState, useCallback } from 'react';
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

  const run = useCallback(async () => {
    if (!enabled) return;
    setEntry<T>(keyStr, { loading: true, error: null });
    try {
      const data = await fetcher();
      setEntry<T>(keyStr, { data, loading: false, error: null, promise: null });
      return data;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setEntry<T>(keyStr, { error: err, loading: false, promise: null });
      return undefined;
    }
  }, [keyStr, enabled, fetcher]);

  useEffect(() => {
    const unsub = subscribe(keyStr, () => setLocal({ ...getEntry<T>(keyStr) }));
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
