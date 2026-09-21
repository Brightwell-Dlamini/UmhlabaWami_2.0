// src/hooks/useSupabaseMutation.ts
import { useCallback, useState, useRef } from 'react';
import { invalidate } from '../lib/queryClient';

interface MutationOptions<TArgs, TResult> {
  mutationFn: (args: TArgs) => Promise<TResult>;
  /** Cache prefixes to invalidate on success. e.g. ['tenants', 'shops'] */
  invalidateKeys?: string[];
  onSuccess?: (result: TResult, args: TArgs) => void;
  onError?: (error: Error, args: TArgs) => void;
}

interface MutationResult<TArgs, TResult> {
  mutate: (args: TArgs) => Promise<TResult>;
  loading: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Mutation hook with cache invalidation.
 *
 * - Returns a Promise that REJECTS on failure (after calling onError).
 *   Callers can `await mutate(...)` inside try/catch, or fire-and-forget.
 * - loading/error are state for UI binding.
 * - mutate is stable across renders.
 *
 * TArgs defaults to `void` so no-arg mutations can call `mutate()` directly
 * instead of `mutate(undefined as never)`.
 */
export function useSupabaseMutation<TArgs = void, TResult = unknown>(
  opts: MutationOptions<TArgs, TResult>
): MutationResult<TArgs, TResult> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const mutate = useCallback(async (args: TArgs): Promise<TResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await optsRef.current.mutationFn(args);

      // Invalidate before onSuccess so subscribers see fresh state
      // if onSuccess triggers its own refetch or navigation.
      const keys = optsRef.current.invalidateKeys;
      if (keys) for (const k of keys) invalidate(k);

      optsRef.current.onSuccess?.(result, args);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      optsRef.current.onError?.(err, args);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { mutate, loading, error, reset };
}
