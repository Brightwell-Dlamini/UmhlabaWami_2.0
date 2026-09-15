/**
 * Ultra-light query layer.
 * - fetch-on-mount
 * - cache keyed by JSON.stringify(keyArray)
 * - invalidate(prefix) marks matching keys and notifies subscribers to refetch once
 * - clearAll() drops cache without a refetch storm (used on logout)
 */

type Listener = () => void;

interface CacheEntry<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  promise: Promise<T> | null;
  /** Set by invalidate(); cleared after a successful/failed fetch attempt */
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
  for (const [key, set] of listeners) {
    if (keyMatchesPrefix(key, prefix)) {
      set.forEach((l) => l());
    }
  }
}

function notifyExact(key: string) {
  listeners.get(key)?.forEach((l) => l());
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
  cache.set(key, { ...current, ...entry });
  notifyExact(key);
}

/**
 * Mark matching queries stale and notify so mounted hooks refetch once.
 */
export function invalidate(prefix: string) {
  const matched: string[] = [];
  for (const key of cache.keys()) {
    if (keyMatchesPrefix(key, prefix)) matched.push(key);
  }
  for (const key of listeners.keys()) {
    if (keyMatchesPrefix(key, prefix) && !matched.includes(key)) matched.push(key);
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

/**
 * Drop all cached data. Does NOT notify subscribers — avoids a mass
 * refetch storm on logout (which froze the tab).
 */
export function clearAll() {
  cache.clear();
}
