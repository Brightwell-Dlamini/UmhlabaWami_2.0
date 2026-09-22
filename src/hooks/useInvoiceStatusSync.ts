// src/hooks/useInvoiceStatusSync.ts
import { useEffect, useRef } from 'react';
import { getSupabase } from '../lib/supabase';
import { invalidate } from '../lib/queryClient';
import { todayIsoLocal } from '../lib/dates';

interface Options {
  orgId: string;
  /** When true, run the sync. Defaults to !!orgId. */
  enabled?: boolean;
  /** Skip if already ran in this session within this many ms. Defaults to 60s. */
  minIntervalMs?: number;
}

/**
 * Promote stale "Sent" / "Partially Paid" invoices whose due_date is
 * strictly before today (local) to "Overdue".
 *
 * Uses the server-side RPC `promote_overdue_invoices(p_org_id uuid)`.
 * If that RPC is missing (migration not yet deployed) the call is a no-op.
 *
 * On success, invalidates the `invoices` cache so subscribers refetch.
 */
export function useInvoiceStatusSync({
  orgId,
  enabled,
  minIntervalMs = 60_000,
}: Options) {
  const lastRunRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!(enabled ?? !!orgId)) return;
    if (!orgId) return;
    const now = Date.now();
    if (inFlightRef.current) return;
    if (now - lastRunRef.current < minIntervalMs) return;

    const sb = getSupabase();
    inFlightRef.current = true;
    lastRunRef.current = now;

    void (async () => {
      try {
        const { data, error } = await sb.rpc('promote_overdue_invoices', {
          p_org_id: orgId,
          p_today: todayIsoLocal(),
        });
        if (error) {
          // Non-fatal — the migration may not be deployed yet.
          if (!/could not find the function|function .* does not exist/i.test(error.message)) {
            console.warn('[useInvoiceStatusSync] promote failed', error.message);
          }
          return;
        }
        const promoted = Number(data ?? 0);
        if (promoted > 0) {
          invalidate('invoices');
        }
      } catch (e) {
        console.warn('[useInvoiceStatusSync] exception', e);
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [orgId, enabled, minIntervalMs]);
}
