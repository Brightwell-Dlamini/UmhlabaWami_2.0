-- ============================================================================
-- 013_reconcile_bank_transaction.sql
--
-- Reconcile a bank line against a payment. Optionally creates a matching
-- finance_transactions ledger row (for the collections view) and returns
-- the updated bank_transactions row.
-- ============================================================================

create or replace function public.reconcile_bank_transaction(
  p_bank_tx_id uuid,
  p_payment_id uuid default null
)
returns public.bank_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bank public.bank_transactions%rowtype;
  v_payment public.payment_records%rowtype;
  v_org uuid;
begin
  select * into v_bank
    from public.bank_transactions
   where id = p_bank_tx_id
   for update;

  if not found then
    raise exception 'Bank transaction % not found.', p_bank_tx_id
      using errcode = '02000';
  end if;

  if v_bank.reconciled then
    return v_bank; -- idempotent
  end if;

  v_org := v_bank.organization_id;

  -- Optional link to a payment record.
  if p_payment_id is not null then
    select * into v_payment
      from public.payment_records
     where id = p_payment_id
     for update;
    if not found then
      raise exception 'Payment % not found.', p_payment_id
        using errcode = '02000';
    end if;
    if v_payment.organization_id <> v_org then
      raise exception 'Payment does not belong to the same organisation.'
        using errcode = '42501';
    end if;
  end if;

  update public.bank_transactions
     set reconciled = true,
         matched_payment_id = p_payment_id
   where id = p_bank_tx_id
   returning * into v_bank;

  -- Ledger side-effect. Only when we matched to a payment, to avoid
  -- double-counting unmatched lines.
  if p_payment_id is not null then
    insert into public.finance_transactions (
      organization_id,
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
      v_org,
      'Rent Collection',
      'Bank reconciliation',
      v_bank.amount,
      case when v_bank.direction = 'credit' then 'income' else 'expense' end,
      'Reconciled: ' || coalesce(v_bank.description, 'bank line'),
      coalesce(v_bank.description, 'BANK-' || substring(v_bank.id::text, 1, 8)),
      v_bank.date,
      'Paid',
      true
    );
  end if;

  return v_bank;
end;
$$;

comment on function public.reconcile_bank_transaction(uuid, uuid) is
  'Marks a bank transaction reconciled, optionally links a payment, and writes a matching finance_transactions row.';

grant execute on function public.reconcile_bank_transaction(uuid, uuid) to authenticated;
