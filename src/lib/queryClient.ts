/**
 * Ultra-light query layer.
 * - fetch-on-mount
 * - in-memory cache keyed by JSON.stringify(keyArray)
 * - invalidation via `invalidate(prefix)` matching array keys like ["tenants", orgId]
 * - subscribers get notified on invalidation and refetch
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

/** True if a cache key belongs to the invalidate prefix. */
function keyMatchesPrefix(key: string, prefix: string): boolean {
  if (!prefix) return false;
  if (key === prefix) return true;
  // Legacy colon prefixes: "tickets:orgId"
  if (key.startsWith(prefix + ':') || key.startsWith(prefix + ',')) return true;
  // JSON.stringify(['tenants', orgId]) → '["tenants","uuid"]'
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
  // Fallback: quoted segment inside the stringified array
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
    cache.set(key, { data: undefined, error: null, loading: false, promise: null });
  }
  return cache.get(key) as CacheEntry<T>;
}

export function setEntry<T>(key: string, entry: Partial<CacheEntry<T>>) {
  const current = getEntry<T>(key);
  cache.set(key, { ...current, ...entry });
  notifyExact(key);
}

/**
 * Drop cached data for every key that matches the prefix and notify subscribers.
 * Subscribers (useSupabaseQuery) will refetch when they see data === undefined.
 */
export function invalidate(prefix: string) {
  const toDelete: string[] = [];
  for (const key of cache.keys()) {
    if (keyMatchesPrefix(key, prefix)) toDelete.push(key);
  }
  for (const key of toDelete) {
    cache.delete(key);
  }
  notifyMatching(prefix);
}

export function clearAll() {
  cache.clear();
  for (const set of listeners.values()) set.forEach((l) => l());
}
