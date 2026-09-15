/**
 * Ultra-light query layer.
 * - cache keyed by JSON.stringify(keyArray)
 * - invalidate(prefix) sets needsRefetch once and notifies
 * - clearAll() drops cache silently (logout) — no refetch storm
 * - setEntry only notifies when something actually changed
 */

type Listener = () => void;

interface CacheEntry<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  promise: Promise<T> | null;
  needsRefetch?: boolean;
}

const cache = new Map<string, CacheEntry<unknown>>();
const listeners = new Map<string, Set<Listener>>();

export function subscribe(key: string, listener: Listener): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(listener);
  return () => {
    const set = listeners.get(key);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

function keyMatchesPrefix(key: string, prefix: string): boolean {
  if (!prefix) return false;
  if (key === prefix) return true;
  if (key.startsWith(prefix + ':') || key.startsWith(prefix + ',')) return true;
  try {
    const parsed = JSON.parse(key) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.some(
        (part) =>
          part === prefix ||
          (typeof part === 'string' && (part === prefix || part.startsWith(prefix + ':')))
      );
    }
  } catch {
    /* not JSON */
  }
  if (key.includes(`"${prefix}"`) || key.includes(`"${prefix}:`)) return true;
  return false;
}

function notifyMatching(prefix: string) {
  const keys = [...listeners.keys()];
  for (const key of keys) {
    if (!keyMatchesPrefix(key, prefix)) continue;
    const set = listeners.get(key);
    if (!set) continue;
    [...set].forEach((l) => {
      try {
        l();
      } catch (e) {
        console.warn('[queryClient] listener error', e);
      }
    });
  }
}

function notifyExact(key: string) {
  const set = listeners.get(key);
  if (!set) return;
  [...set].forEach((l) => {
    try {
      l();
    } catch (e) {
      console.warn('[queryClient] listener error', e);
    }
  });
}

export function getEntry<T>(key: string): CacheEntry<T> {
  if (!cache.has(key)) {
    cache.set(key, {
      data: undefined,
      error: null,
      loading: false,
      promise: null,
      needsRefetch: false,
    });
  }
  return cache.get(key) as CacheEntry<T>;
}

export function setEntry<T>(key: string, entry: Partial<CacheEntry<T>>) {
  const current = getEntry<T>(key);
  const next: CacheEntry<T> = { ...current, ...entry };
  if (
    next.data === current.data &&
    next.error === current.error &&
    next.loading === current.loading &&
    next.needsRefetch === current.needsRefetch &&
    next.promise === current.promise
  ) {
    return;
  }
  cache.set(key, next);
  notifyExact(key);
}

export function invalidate(prefix: string) {
  const matched = new Set<string>();
  for (const key of cache.keys()) {
    if (keyMatchesPrefix(key, prefix)) matched.add(key);
  }
  for (const key of listeners.keys()) {
    if (keyMatchesPrefix(key, prefix)) matched.add(key);
  }

  for (const key of matched) {
    const current = getEntry(key);
    cache.set(key, {
      ...current,
      data: undefined,
      error: null,
      loading: false,
      promise: null,
      needsRefetch: true,
    });
  }
  notifyMatching(prefix);
}

/** Logout: wipe cache, do not notify (avoids mass refetch while UI unmounts). */
export function clearAll() {
  cache.clear();
}
