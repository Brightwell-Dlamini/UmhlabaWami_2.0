-- ============================================================================
-- 017_payment_records_backfill.sql
--
-- For every invoice with amount_paid > 0 that has NO matching payment_records
-- row, insert a synthetic backfill payment dated to the invoice's issue date
-- (best estimate). Idempotent: uses a 'BACKFILL-' reference prefix and skips
-- invoices that already have a backfill row.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Pre-flight: count the gap.
-- ---------------------------------------------------------------------------
do $$
declare
  v_gap integer;
  v_total numeric;
begin
  select count(*), coalesce(sum(i.amount_paid), 0)
    into v_gap, v_total
    from public.invoices i
   where i.amount_paid > 0
     and not exists (
       select 1 from public.payment_records p where p.invoice_id = i.id
     );

  raise notice 'Backfill scope: % invoices, E% unaccounted.', v_gap, v_total;
end
$$;

-- ---------------------------------------------------------------------------
-- 2) The backfill itself.
-- ---------------------------------------------------------------------------
insert into public.payment_records (
  organization_id,
  invoice_id,
  tenant_id,
  amount,
  method,
  reference,
  paid_at,
  notes
)
select
  i.organization_id,
  i.id,
  i.tenant_id,
  i.amount_paid,
  'EFT'::text,
  'BACKFILL-' || i.invoice_number,
  i.issue_date::timestamptz,
  'Backfilled by migration 017. Original payment record missing.'
from public.invoices i
where i.amount_paid > 0
  and not exists (
    select 1 from public.payment_records p where p.invoice_id = i.id
  )
  -- Guard against re-running if a backfill row already exists.
  and not exists (
    select 1 from public.payment_records p
     where p.reference = 'BACKFILL-' || i.invoice_number
  );

-- ---------------------------------------------------------------------------
-- 3) Post-flight: confirm no gaps remain.
-- ---------------------------------------------------------------------------
do $$
declare
  v_remaining integer;
begin
  select count(*) into v_remaining
    from public.invoices i
   where i.amount_paid > 0
     and not exists (
       select 1 from public.payment_records p where p.invoice_id = i.id
     );

  if v_remaining = 0 then
    raise notice 'Backfill complete. No remaining gaps.';
  else
    raise notice 'WARNING: % invoices still have amount_paid but no payment_records.', v_remaining;
  end if;
end
$$;
