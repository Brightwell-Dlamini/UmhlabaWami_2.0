-- ============================================================================
-- 014_invoice_unique_period.sql (corrected)
--
-- Adds invoice_period + a partial unique index on rent invoices, and rewrites
-- bulk_generate_rent_invoices to:
--   - generate invoice_number (there is no trigger and no default)
--   - populate tenant_name / shop_number denormalized columns
--   - skip tenants who already have a rent invoice this period (idempotent)
--   - cast status to the invoice_status enum explicitly
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Add invoice_period if missing.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'invoice_period'
  ) then
    alter table public.invoices add column invoice_period text;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2) Backfill existing rows: YYYY-MM of issue_date for rent invoices.
-- ---------------------------------------------------------------------------
update public.invoices
   set invoice_period = to_char(issue_date, 'YYYY-MM')
 where invoice_period is null
   and type = 'Rent';

-- ---------------------------------------------------------------------------
-- 3) Partial unique index on rent invoices per tenant per period.
-- ---------------------------------------------------------------------------
drop index if exists public.invoices_unique_rent_period;
create unique index invoices_unique_rent_period
  on public.invoices (organization_id, tenant_id, invoice_period)
  where type = 'Rent' and tenant_id is not null;

-- ---------------------------------------------------------------------------
-- 4) Invoice-number generator.
--
-- Format: INV-YYYYMM-NNNN
-- NNNN is a per-org, per-month sequence. Lock the org row so two
-- concurrent calls cannot produce the same number.
-- ---------------------------------------------------------------------------
create or replace function public.generate_invoice_number(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char(now(), 'YYYYMM');
  v_seq integer;
begin
  -- Serialize number allocation per organisation.
  perform 1 from public.organizations where id = p_org_id for update;

  select count(*) + 1
    into v_seq
    from public.invoices
   where organization_id = p_org_id
     and to_char(created_at, 'YYYYMM') = v_period;

  -- Retry if the derived number is somehow already taken (e.g. manual
  -- inserts bypassing this helper). Bounded loop.
  for i in 1..50 loop
    if not exists (
      select 1 from public.invoices
       where organization_id = p_org_id
         and invoice_number = 'INV-' || v_period || '-' || lpad((v_seq + i - 1)::text, 4, '0')
    ) then
      return 'INV-' || v_period || '-' || lpad((v_seq + i - 1)::text, 4, '0');
    end if;
  end loop;

  -- Extremely unlikely fallback: suffix with a random fragment.
  return 'INV-' || v_period || '-' || lpad(v_seq::text, 4, '0')
         || '-' || substring(gen_random_uuid()::text, 1, 4);
end;
$$;

comment on function public.generate_invoice_number(uuid) is
  'Allocates the next invoice number for an organisation in the current month. Format: INV-YYYYMM-NNNN.';

grant execute on function public.generate_invoice_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Rewritten bulk generator.
-- ---------------------------------------------------------------------------
create or replace function public.bulk_generate_rent_invoices(
  p_organization_id uuid,
  p_period_date date,
  p_tax_rate numeric default 0.15
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char(p_period_date, 'YYYY-MM');
  v_issue_date date := p_period_date;
  v_due_date date := p_period_date + interval '7 days';
  v_count integer := 0;
  v_rec record;
  v_invoice_id uuid;
  v_invoice_number text;
  v_subtotal numeric;
  v_tax numeric;
  v_total numeric;
begin
  for v_rec in
    select
      t.id             as tenant_id,
      t.organization_id,
      t.shop_id,
      t.business_name  as tenant_name,
      s.shop_number,
      s.rental_amount
    from public.tenants t
    join public.shops s on s.id = t.shop_id
    where t.organization_id = p_organization_id
      and t.status = 'Active'
      and s.rental_amount > 0
      and not exists (
        select 1 from public.invoices i
        where i.organization_id = t.organization_id
          and i.tenant_id = t.id
          and i.invoice_period = v_period
          and i.type = 'Rent'
      )
  loop
    v_subtotal := v_rec.rental_amount;
    v_tax      := round(v_rec.rental_amount * p_tax_rate, 2);
    v_total    := round(v_rec.rental_amount * (1 + p_tax_rate), 2);

    v_invoice_number := public.generate_invoice_number(v_rec.organization_id);

    insert into public.invoices (
      organization_id,
      invoice_number,
      type,
      tenant_id,
      tenant_name,
      shop_id,
      shop_number,
      issue_date,
      due_date,
      status,
      currency,
      subtotal,
      tax_amount,
      total,
      amount_paid,
      invoice_period
    )
    values (
      v_rec.organization_id,
      v_invoice_number,
      'Rent',
      v_rec.tenant_id,
      v_rec.tenant_name,
      v_rec.shop_id,
      v_rec.shop_number,
      v_issue_date,
      v_due_date,
      'Draft'::invoice_status,
      'SZL',
      v_subtotal,
      v_tax,
      v_total,
      0,
      v_period
    )
    returning id into v_invoice_id;

    insert into public.invoice_lines (
      invoice_id,
      description,
      quantity,
      unit_amount,
      amount,
      line_order
    )
    values (
      v_invoice_id,
      'Monthly rent — ' || to_char(p_period_date, 'FMMonth YYYY'),
      1,
      v_rec.rental_amount,
      v_rec.rental_amount,
      0
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.bulk_generate_rent_invoices(uuid, date, numeric) is
  'Generates rent invoices for all active tenants with a shop. Skips tenants who already have a rent invoice for the period. Returns count of new invoices.';

grant execute on function public.bulk_generate_rent_invoices(uuid, date, numeric) to authenticated;
