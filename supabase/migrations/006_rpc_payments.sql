-- ============================================================================
-- 006_rpc_payments.sql
--
-- Transaction-safe payment recording and bank reconciliation.
-- Assumes 001–005 have run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- record_payment
--
-- Locks the invoice row, re-checks the outstanding balance, inserts the
-- payment, updates invoice.amount_paid + status, and writes a
-- finance_transactions ledger entry — all in one transaction.
--
-- Returns the inserted payment_records row as jsonb.
-- ---------------------------------------------------------------------------
create or replace function public.record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method payment_method,
  p_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_remaining numeric;
  v_payment public.payment_records%rowtype;
  v_new_status invoice_status;
  v_property_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.'
      using errcode = '22023';
  end if;

  -- Lock the invoice so concurrent payments serialize.
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id
   for update;

  if not found then
    raise exception 'Invoice not found.' using errcode = '02000';
  end if;

  if v_invoice.status in ('Paid', 'Cancelled') then
    raise exception 'Invoice % is already %.',
      v_invoice.invoice_number, lower(v_invoice.status::text)
      using errcode = '22023';
  end if;

  v_remaining := coalesce(v_invoice.total, 0) - coalesce(v_invoice.amount_paid, 0);

  if v_remaining <= 0 then
    raise exception 'Invoice % has no outstanding balance.',
      v_invoice.invoice_number
      using errcode = '22023';
  end if;

  if p_amount > v_remaining + 0.01 then
    raise exception 'Payment exceeds outstanding balance of E%.',
      to_char(v_remaining, 'FM999G999G999D00')
      using errcode = '22023';
  end if;

  insert into public.payment_records (
    organization_id, invoice_id, tenant_id, amount, method, reference, paid_at, notes
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

  -- Compute new status.
  v_new_status := case
    when coalesce(v_invoice.amount_paid, 0) + p_amount >= v_invoice.total - 0.01
      then 'Paid'::invoice_status
    when coalesce(v_invoice.amount_paid, 0) + p_amount > 0
      then 'Partially Paid'::invoice_status
    else v_invoice.status
  end;

  update public.invoices
     set amount_paid = coalesce(amount_paid, 0) + p_amount,
         status = v_new_status
   where id = v_invoice.id;

  -- Resolve property (center) for the ledger row.
  select s.shopping_center_id into v_property_id
    from public.shops s where s.id = v_invoice.shop_id limit 1;

  -- Ledger entry.
  insert into public.finance_transactions (
    organization_id, property_id, shop_id, tenant_id,
    type, category, amount, direction, description, reference, date, status, reconciled
  )
  values (
    v_invoice.organization_id,
    v_property_id,
    v_invoice.shop_id,
    v_invoice.tenant_id,
    'Rent Collection'::finance_tx_type,
    'Payment',
    p_amount,
    'income'::finance_tx_direction,
    coalesce(p_notes, 'Payment received for ' || v_invoice.invoice_number),
    coalesce(p_reference, 'PAY-' || v_invoice.invoice_number),
    current_date,
    'Paid'::finance_tx_status,
    false
  );

  return jsonb_build_object(
    'id', v_payment.id,
    'organization_id', v_payment.organization_id,
    'invoice_id', v_payment.invoice_id,
    'tenant_id', v_payment.tenant_id,
    'amount', v_payment.amount,
    'method', v_payment.method,
    'reference', v_payment.reference,
    'paid_at', v_payment.paid_at,
    'notes', v_payment.notes
  );
end;
$$;

comment on function public.record_payment(uuid, numeric, payment_method, text, text) is
  'Records a payment against an invoice with row-lock over-payment protection. Writes a finance_transactions ledger row. Returns the payment as jsonb.';

grant execute on function public.record_payment(uuid, numeric, payment_method, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- reconcile_bank_transaction
--
-- Marks a bank line reconciled, optionally links a payment, and writes a
-- matching finance_transactions ledger row when a payment is provided.
--
-- Returns the updated bank_transactions row as jsonb.
-- ---------------------------------------------------------------------------
create or replace function public.reconcile_bank_transaction(
  p_bank_tx_id uuid,
  p_payment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bank public.bank_transactions%rowtype;
  v_payment public.payment_records%rowtype;
begin
  select * into v_bank
    from public.bank_transactions
   where id = p_bank_tx_id
   for update;

  if not found then
    raise exception 'Bank transaction not found.' using errcode = '02000';
  end if;

  if v_bank.reconciled then
    -- Idempotent: return the existing row.
    return jsonb_build_object(
      'id', v_bank.id,
      'organization_id', v_bank.organization_id,
      'date', v_bank.date,
      'description', v_bank.description,
      'amount', v_bank.amount,
      'direction', v_bank.direction,
      'reconciled', v_bank.reconciled,
      'matched_payment_id', v_bank.matched_payment_id
    );
  end if;

  if p_payment_id is not null then
    select * into v_payment
      from public.payment_records
     where id = p_payment_id
     for update;

    if not found then
      raise exception 'Payment record not found.' using errcode = '02000';
    end if;

    if v_payment.organization_id <> v_bank.organization_id then
      raise exception 'Payment does not belong to the same organisation.'
        using errcode = '42501';
    end if;
  end if;

  update public.bank_transactions
     set reconciled = true,
         matched_payment_id = p_payment_id
   where id = p_bank_tx_id
   returning * into v_bank;

  -- Ledger side-effect only when a payment is matched.
  if p_payment_id is not null then
    insert into public.finance_transactions (
      organization_id, type, category, amount, direction,
      description, reference, date, status, reconciled
    )
    values (
      v_bank.organization_id,
      'Rent Collection'::finance_tx_type,
      'Bank reconciliation',
      v_bank.amount,
      case when v_bank.direction = 'credit'
        then 'income'::finance_tx_direction
        else 'expense'::finance_tx_direction
      end,
      'Reconciled: ' || coalesce(v_bank.description, 'bank line'),
      coalesce(v_bank.description, 'BANK-' || substring(v_bank.id::text, 1, 8)),
      v_bank.date,
      'Paid'::finance_tx_status,
      true
    );
  end if;

  return jsonb_build_object(
    'id', v_bank.id,
    'organization_id', v_bank.organization_id,
    'date', v_bank.date,
    'description', v_bank.description,
    'amount', v_bank.amount,
    'direction', v_bank.direction,
    'reconciled', v_bank.reconciled,
    'matched_payment_id', v_bank.matched_payment_id
  );
end;
$$;

comment on function public.reconcile_bank_transaction(uuid, uuid) is
  'Marks a bank transaction reconciled, optionally links a payment, writes a ledger row when a payment is matched. Returns the updated row as jsonb.';

grant execute on function public.reconcile_bank_transaction(uuid, uuid) to authenticated;