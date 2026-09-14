import { useCallback, useState } from 'react';
import { invalidate } from '../lib/queryClient';

interface MutationOptions<TArgs, TResult> {
  mutationFn: (args: TArgs) => Promise<TResult>;
  /** Cache prefixes to invalidate on success. e.g. ['tickets', 'tickets:org'] */
  invalidateKeys?: string[];
  onSuccess?: (result: TResult, args: TArgs) => void;
  onError?: (error: Error, args: TArgs) => void;
}

export function useSupabaseMutation<TArgs, TResult>(opts: MutationOptions<TArgs, TResult>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (args: TArgs): Promise<TResult | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await opts.mutationFn(args);
        opts.invalidateKeys?.forEach((k) => invalidate(k));
        opts.onSuccess?.(result, args);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        opts.onError?.(err, args);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [opts]
  );

  return { mutate, loading, error };
}
