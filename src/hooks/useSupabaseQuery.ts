import { useEffect, useState, useCallback, useRef } from 'react';
import { getEntry, setEntry, subscribe } from '../lib/queryClient';

interface Options {
  enabled?: boolean;
  refreshInterval?: number;
}

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
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const run = useCallback(async () => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    setEntry<T>(keyStr, { loading: true, error: null, needsRefetch: false });
    try {
      const data = await fetcherRef.current();
      if (!mounted.current) return data;
      setEntry<T>(keyStr, {
        data,
        loading: false,
        error: null,
        promise: null,
        needsRefetch: false,
      });
      return data;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (mounted.current) {
        setEntry<T>(keyStr, {
          error: err,
          loading: false,
          promise: null,
          needsRefetch: false,
        });
      }
      return undefined;
    } finally {
      inFlight.current = false;
    }
  }, [keyStr, enabled]);

  useEffect(() => {
    mounted.current = true;
    const unsub = subscribe(keyStr, () => {
      if (!mounted.current) return;
      const next = getEntry<T>(keyStr);
      setLocal({ ...next });
      if (enabled && next.needsRefetch && !next.loading && !inFlight.current) {
        void run();
      }
    });

    setLocal({ ...getEntry<T>(keyStr) });

    const current = getEntry<T>(keyStr);
    if (
      enabled &&
      !current.loading &&
      !inFlight.current &&
      (current.data === undefined || current.needsRefetch)
    ) {
      void run();
    }

    let interval: ReturnType<typeof setInterval> | undefined;
    if (options.refreshInterval && options.refreshInterval > 0) {
      interval = setInterval(() => {
        if (mounted.current) void run();
      }, options.refreshInterval);
    }

    return () => {
      mounted.current = false;
      unsub();
      if (interval) clearInterval(interval);
    };
  }, [keyStr, enabled, run, options.refreshInterval]);

  return { ...entry, refetch: run };
}
