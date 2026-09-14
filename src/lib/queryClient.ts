/**
 * Ultra-light query layer.
 * - fetch-on-mount
 * - in-memory cache keyed by string
 * - invalidation via `invalidate(keyPrefix)`
 * - subscribers get notified on invalidation
 */

type Listener = () => void;

interface CacheEntry<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  promise: Promise<T> | null;
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

function notifyPrefix(prefix: string) {
  for (const [key, set] of listeners) {
    if (key === prefix || key.startsWith(prefix + ':') || key.startsWith(prefix)) {
      set.forEach((l) => l());
    }
  }
}

function notifyExact(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

export function getEntry<T>(key: string): CacheEntry<T> {
  if (!cache.has(key)) {
    cache.set(key, { data: undefined, error: null, loading: false, promise: null });
  }
  return cache.get(key) as CacheEntry<T>;
}

export function setEntry<T>(key: string, entry: Partial<CacheEntry<T>>) {
  const current = getEntry<T>(key);
  cache.set(key, { ...current, ...entry });
  notifyExact(key);
}

export function invalidate(prefix: string) {
  for (const key of cache.keys()) {
    if (key === prefix || key.startsWith(prefix + ':') || key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
  notifyPrefix(prefix);
}

export function clearAll() {
  cache.clear();
  for (const set of listeners.values()) set.forEach((l) => l());
}
