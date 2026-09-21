/**
 * Ultra-light query layer — v2
 *
 * Changes from v1:
 * - invalidate() keeps stale data. Only sets needsRefetch. No more NaN flashes.
 * - setQueryData() for optimistic writes.
 * - keyMatchesPrefix() is exact on segment boundaries, not substring guessing.
 * - clearAll() also drops listeners (prevents orphaned subscriptions after logout).
 * - notifyMatching() is debounced to one microtask to collapse storms.
 */

type Listener = () => void;

interface CacheEntry<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  promise: Promise<T> | null;
  needsRefetch: boolean;
}

const cache = new Map<string, CacheEntry<unknown>>();
const listeners = new Map<string, Set<Listener>>();

let notifyScheduled = false;
const pendingNotifyKeys = new Set<string>();

function scheduleNotify(key: string) {
  pendingNotifyKeys.add(key);
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    const keys = [...pendingNotifyKeys];
    pendingNotifyKeys.clear();
    for (const k of keys) notifyExact(k);
  });
}

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

/**
 * True when `key` is in the cache-space of `prefix`.
 *
 * Both `key` and `prefix` are JSON.stringify'd arrays (or plain strings).
 * We compare segment-wise so ['invoices', 'org1'] matches prefix ['invoices']
 * but does NOT match prefix ['invoice'].
 */
function keyMatchesPrefix(key: string, prefix: string): boolean {
  if (!prefix) return false;
  if (key === prefix) return true;

  // Cache keys are typically JSON.stringify(['shops', orgId]).
  // Mutations pass plain prefixes like 'shops' via invalidateKeys.
  try {
    const keyParts = JSON.parse(key) as unknown;

    if (Array.isArray(keyParts)) {
      try {
        const prefixParts = JSON.parse(prefix) as unknown;
        if (Array.isArray(prefixParts)) {
          if (prefixParts.length > keyParts.length) return false;
          for (let i = 0; i < prefixParts.length; i++) {
            if (keyParts[i] !== prefixParts[i]) return false;
          }
          return true;
        }
      } catch {
        // prefix is a plain string (e.g. 'shops') — match first segment
        return keyParts[0] === prefix;
      }
    }
  } catch {
    // key is a plain string
  }

  return key === prefix || key.startsWith(`${prefix}:`) || key.startsWith(`${prefix},`);
}

function notifyExact(key: string) {
  const set = listeners.get(key);
  if (!set) return;
  for (const l of [...set]) {
    try {
      l();
    } catch (e) {
      console.warn('[queryClient] listener error', e);
    }
  }
}

function notifyMatching(prefix: string) {
  const keys = new Set<string>();
  for (const key of cache.keys()) if (keyMatchesPrefix(key, prefix)) keys.add(key);
  for (const key of listeners.keys()) if (keyMatchesPrefix(key, prefix)) keys.add(key);
  for (const key of keys) scheduleNotify(key);
}

export function getEntry<T>(key: string): CacheEntry<T> {
  const existing = cache.get(key);
  if (existing) return existing as CacheEntry<T>;
  const fresh: CacheEntry<T> = {
    data: undefined,
    error: null,
    loading: false,
    promise: null,
    needsRefetch: false,
  };
  cache.set(key, fresh);
  return fresh;
}

export function setEntry<T>(key: string, entry: Partial<CacheEntry<T>>): void {
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
  scheduleNotify(key);
}

/**
 * Directly write data into the cache. Used for optimistic updates.
 * Clears needsRefetch so the pending refetch is a no-op.
 */
export function setQueryData<T>(key: string, data: T): void {
  setEntry<T>(key, { data, loading: false, error: null, needsRefetch: false });
}

/**
 * Mark a prefix as stale and notify subscribers. Does NOT clear data —
 * components keep rendering the stale value while the refetch is in flight.
 */
export function invalidate(prefix: string): void {
  const keys = new Set<string>();
  for (const key of cache.keys()) if (keyMatchesPrefix(key, prefix)) keys.add(key);
  for (const key of listeners.keys()) if (keyMatchesPrefix(key, prefix)) keys.add(key);

  for (const key of keys) {
    const current = getEntry(key);
    if (current.needsRefetch) continue;
    cache.set(key, { ...current, needsRefetch: true });
  }
  for (const key of keys) scheduleNotify(key);
}

/**
 * Logout: wipe cache + listeners silently. No refetch, no notify.
 * Called before the UI unmounts so orphaned fetches don't fire.
 */
export function clearAll(): void {
  cache.clear();
  listeners.clear();
  pendingNotifyKeys.clear();
}

/** Debug helper — not used in prod. */
export function __inspectCache() {
  return {
    size: cache.size,
    keys: [...cache.keys()],
    listenerCount: [...listeners.values()].reduce((n, s) => n + s.size, 0),
  };
}
