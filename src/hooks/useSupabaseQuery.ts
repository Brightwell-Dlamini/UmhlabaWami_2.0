import { useEffect, useState, useCallback, useRef } from 'react';
import { getEntry, setEntry, subscribe } from '../lib/queryClient';

interface Options {
  enabled?: boolean;
  refreshInterval?: number;
}

interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<T | undefined>;
}

/**
 * Subscribe to a cache key. Fetches when:
 *  - data is undefined
 *  - entry.needsRefetch is true and no fetch is in flight
 *  - refetch() is called manually
 *  - refreshInterval elapses (if enabled)
 *
 * Never blanks data during a refetch — stale values remain visible.
 * Safe against StrictMode double-mount.
 */
export function useSupabaseQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<T>,
  options: Options = {}
): QueryResult<T> {
  const keyStr = JSON.stringify(key);
  const enabled = options.enabled ?? true;

  const [snapshot, setSnapshot] = useState(() => getEntry<T>(keyStr));

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const keyRef = useRef(keyStr);
  keyRef.current = keyStr;

  const run = useCallback(async (): Promise<T | undefined> => {
    if (!enabled) return undefined;
    if (inFlightRef.current) return undefined;
    inFlightRef.current = true;

    const thisKey = keyRef.current;
    // Only flip loading if we have no data yet — otherwise keep stale visible.
    const current = getEntry<T>(thisKey);
    if (current.data === undefined) {
      setEntry<T>(thisKey, { loading: true, error: null, needsRefetch: false });
    } else {
      setEntry<T>(thisKey, { needsRefetch: false, error: null });
    }

    try {
      const data = await fetcherRef.current();
      if (!mountedRef.current || keyRef.current !== thisKey) return data;
      setEntry<T>(thisKey, {
        data,
        loading: false,
        error: null,
        promise: null,
        needsRefetch: false,
      });
      return data;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (mountedRef.current && keyRef.current === thisKey) {
        setEntry<T>(thisKey, {
          error: err,
          loading: false,
          promise: null,
          needsRefetch: false,
        });
      }
      return undefined;
    } finally {
      inFlightRef.current = false;
    }
  }, [enabled]);

  // Reset local snapshot immediately when key changes (avoids stale-key render).
  useEffect(() => {
    setSnapshot({ ...getEntry<T>(keyStr) });
  }, [keyStr]);

  useEffect(() => {
    mountedRef.current = true;
    inFlightRef.current = false;

    const unsub = subscribe(keyStr, () => {
      if (!mountedRef.current) return;
      const next = getEntry<T>(keyStr);
      setSnapshot({ ...next });
      if (enabled && next.needsRefetch && !next.loading && !inFlightRef.current) {
        void run();
      }
    });

    const current = getEntry<T>(keyStr);
    if (
      enabled &&
      !current.loading &&
      !inFlightRef.current &&
      (current.data === undefined || current.needsRefetch)
    ) {
      void run();
    }

    let interval: ReturnType<typeof setInterval> | undefined;
    if (enabled && options.refreshInterval && options.refreshInterval > 0) {
      interval = setInterval(() => {
        if (mountedRef.current && enabled) void run();
      }, options.refreshInterval);
    }

    return () => {
      mountedRef.current = false;
      unsub();
      if (interval) clearInterval(interval);
    };
  }, [keyStr, enabled, run, options.refreshInterval]);

  return {
    data: snapshot.data,
    loading: snapshot.loading,
    error: snapshot.error,
    refetch: run,
  };
}
