// src/hooks/useSupabaseQuery.ts
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
 *  - refreshInterval elapses (only when the tab is visible)
 *  - the tab regains focus (if refreshInterval was configured)
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
      setEntry<T>(thisKey, {
        loading: true,
        error: null,
        needsRefetch: false,
      });
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

  // Reset local snapshot immediately when key changes.
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
      if (
        enabled &&
        next.needsRefetch &&
        !next.loading &&
        !inFlightRef.current
      ) {
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

    // Interval polling — paused while the tab is hidden.
    let interval: ReturnType<typeof setInterval> | undefined;
    const refreshMs = options.refreshInterval ?? 0;

    const startInterval = () => {
      if (interval || refreshMs <= 0 || !enabled) return;
      interval = setInterval(() => {
        // Belt-and-braces: also check visibility at tick time.
        if (document.visibilityState === 'visible') void run();
      }, refreshMs);
    };
    const stopInterval = () => {
      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Immediate catch-up fetch when returning to the tab.
        if (enabled && !inFlightRef.current) void run();
        startInterval();
      } else {
        stopInterval();
      }
    };

    if (refreshMs > 0 && enabled) {
      if (document.visibilityState === 'visible') startInterval();
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      mountedRef.current = false;
      unsub();
      stopInterval();
      if (refreshMs > 0) {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStr, enabled, run, options.refreshInterval]);

  return {
    data: snapshot.data,
    loading: snapshot.loading,
    error: snapshot.error,
    refetch: run,
  };
}
