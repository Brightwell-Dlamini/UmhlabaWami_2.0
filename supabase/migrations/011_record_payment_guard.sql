-- ============================================================================
-- 011_record_payment_guard.sql
--
-- Transaction-safe payment recording:
--   1. Locks the invoice row (FOR UPDATE).
--   2. Re-checks the payment doesn't exceed the outstanding balance.
--   3. Inserts the payment record.
--   4. Updates the invoice's amount_paid + status atomically.
--   5. Emits a finance_transactions row for the ledger.
-- ============================================================================

create or replace function public.record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text default null,
  p_notes text default null
)
returns public.payment_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_remaining numeric;
  v_payment public.payment_records%rowtype;
  v_new_status text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.'
      using errcode = '22023';
  end if;

  -- Lock the invoice so concurrent payments serialize.
  select *
    into v_invoice
    from public.invoices
   where id = p_invoice_id
   for update;

  if not found then
    raise exception 'Invoice not found.' using errcode = '02000';
  end if;

  if v_invoice.status in ('Paid', 'Cancelled') then
    raise exception 'Invoice % is already %.',
      v_invoice.invoice_number, lower(v_invoice.status)
      using errcode = '22023';
  end if;

  v_remaining := coalesce(v_invoice.total, 0) - coalesce(v_invoice.amount_paid, 0);

  if v_remaining <= 0 then
    raise exception 'Invoice % has no outstanding balance.',
      v_invoice.invoice_number
      using errcode = '22023';
  end if;

  -- Tolerance of one cent to absorb client-side float drift.
  if p_amount > v_remaining + 0.01 then
    raise exception 'Payment exceeds outstanding balance of E%.',
      to_char(v_remaining, 'FM999G999G999D00')
      using errcode = '22023';
  end if;

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
  values (
    v_invoice.organization_id,
    v_invoice.id,
    v_invoice.tenant_id,
    p_amount,
    p_method,
    p_reference,
    now(),
    p_notes
  )
  returning * into v_payment;

  -- Update the invoice atomically.
  v_new_status := case
    when coalesce(v_invoice.amount_paid, 0) + p_amount >= v_invoice.total - 0.01
      then 'Paid'
    when coalesce(v_invoice.amount_paid, 0) + p_amount > 0
      then 'Partially Paid'
    else v_invoice.status
  end;

  update public.invoices
     set amount_paid = coalesce(amount_paid, 0) + p_amount,
         status = v_new_status
   where id = v_invoice.id;

  -- Ledger entry.
  insert into public.finance_transactions (
    organization_id,
    property_id,
    shop_id,
    tenant_id,
    type,
    category,
    amount,
    direction,
    description,
    reference,
    date,
    status,
    reconciled
  )
  values (
    v_invoice.organization_id,
    (select property_id from public.shops where id = v_invoice.shop_id limit 1),
    v_invoice.shop_id,
    v_invoice.tenant_id,
    'Rent Collection',
    'Payment',
    p_amount,
    'income',
    coalesce(p_notes, 'Payment received for ' || v_invoice.invoice_number),
    coalesce(p_reference, 'PAY-' || v_invoice.invoice_number),
    current_date,
    'Paid',
    false
  );

  return v_payment;
end;
$$;

comment on function public.record_payment(uuid, numeric, text, text, text) is
  'Records a payment against an invoice with transaction-safe over-payment protection. Returns the inserted payment_records row.';

grant execute on function public.record_payment(uuid, numeric, text, text, text) to authenticated;
