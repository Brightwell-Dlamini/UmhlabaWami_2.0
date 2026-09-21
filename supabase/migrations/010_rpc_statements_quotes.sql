-- ============================================================================
-- 010_rpc_statements_quotes.sql
--
-- Statements, quotes, bulk rent generation.
-- Assumes 001–009 have run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- generate_statement
--
-- Reads all invoices + payments for a tenant in a period, computes opening
-- and closing balances. The opening balance is the sum of (invoice totals
-- minus payments) BEFORE period_start. Closing = opening + in-period net.
--
-- Idempotent enough: re-generating the same (tenant, period) creates a new
-- statement row each time — the PDF generator doesn't care, and there's no
-- UNIQUE constraint on (tenant, period) by design (you might want to
-- regenerate after corrections).
-- ---------------------------------------------------------------------------
create or replace function public.generate_statement(
  p_tenant_id uuid,
  p_period_start date,
  p_period_end date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant public.tenants%rowtype;
  v_opening numeric(12,2) := 0;
  v_closing numeric(12,2) := 0;
  v_total_invoiced numeric(12,2) := 0;
  v_total_paid numeric(12,2) := 0;
  v_statement_id uuid;
  v_statement public.statements%rowtype;
begin
  select * into v_tenant from public.tenants where id = p_tenant_id;
  if not found then
    raise exception 'Tenant not found.' using errcode = '02000';
  end if;

  -- Opening: sum of invoice totals minus payments before period_start.
  select
    coalesce((select sum(i.total - i.amount_paid)
                from public.invoices i
               where i.tenant_id = p_tenant_id
                 and i.issue_date < p_period_start
                 and i.status <> 'Cancelled'), 0)
  into v_opening;

  -- Total invoiced and paid IN the period.
  select coalesce(sum(i.total), 0) into v_total_invoiced
    from public.invoices i
   where i.tenant_id = p_tenant_id
     and i.issue_date between p_period_start and p_period_end
     and i.status <> 'Cancelled';

  select coalesce(sum(p.amount), 0) into v_total_paid
    from public.payment_records p
   where p.tenant_id = p_tenant_id
     and p.paid_at::date between p_period_start and p_period_end;

  -- Closing = opening + invoiced - paid.
  v_closing := v_opening + v_total_invoiced - v_total_paid;

  insert into public.statements (
    organization_id, tenant_id, period_start, period_end,
    opening_balance, closing_balance, total_invoiced, total_paid
  )
  values (
    v_tenant.organization_id, p_tenant_id, p_period_start, p_period_end,
    v_opening, v_closing, v_total_invoiced, v_total_paid
  )
  returning * into v_statement;

  return to_jsonb(v_statement);
end;
$$;

grant execute on function public.generate_statement(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- create_quote_with_lines
--
-- p_lines is a JSONB array of:
--   { item_id?, description, quantity, unit_amount, tax_rate?, line_order? }
-- ---------------------------------------------------------------------------
create or replace function public.create_quote_with_lines(
  p_organization_id uuid,
  p_type quote_type,
  p_tenant_id uuid,
  p_prospect_name text,
  p_prospect_email text,
  p_prospect_phone text,
  p_prospect_company text,
  p_shop_id uuid,
  p_issue_date date,
  p_valid_until date,
  p_currency text,
  p_lines jsonb,
  p_notes text,
  p_terms text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(12,2) := 0;
  v_tax numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_line jsonb;
  v_qty numeric;
  v_unit numeric;
  v_rate numeric;
  v_amt numeric;
  v_line_order int := 0;
  v_quote_id uuid;
  v_quote_number text;
  v_salesperson_name text;
  v_quote public.quotes%rowtype;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'A quote must have at least one line.'
      using errcode = '22023';
  end if;

  -- Sum.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := coalesce((v_line ->> 'quantity')::numeric, 0);
    v_unit := coalesce((v_line ->> 'unit_amount')::numeric, 0);
    v_rate := coalesce((v_line ->> 'tax_rate')::numeric, 0.15);
    v_amt := round(v_qty * v_unit, 2);
    v_subtotal := v_subtotal + v_amt;
    v_tax := v_tax + round(v_amt * v_rate, 2);
  end loop;
  v_total := v_subtotal + v_tax;

  select name into v_salesperson_name from public.profiles where id = auth.uid() limit 1;

  v_quote_number := public.generate_quote_number(p_organization_id);

  insert into public.quotes (
    organization_id, quote_number, type, tenant_id,
    prospect_name, prospect_email, prospect_phone, prospect_company,
    shop_id, issue_date, valid_until, status, currency,
    subtotal, tax_amount, total, notes, terms,
    salesperson_id, salesperson_name
  )
  values (
    p_organization_id, v_quote_number, p_type, p_tenant_id,
    p_prospect_name, p_prospect_email, p_prospect_phone, p_prospect_company,
    p_shop_id, p_issue_date, p_valid_until, 'Draft'::quote_status,
    coalesce(p_currency, 'SZL'),
    v_subtotal, v_tax, v_total, p_notes, p_terms,
    auth.uid(), v_salesperson_name
  )
  returning * into v_quote;

  -- Lines.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := coalesce((v_line ->> 'quantity')::numeric, 0);
    v_unit := coalesce((v_line ->> 'unit_amount')::numeric, 0);
    v_rate := coalesce((v_line ->> 'tax_rate')::numeric, 0.15);
    v_amt := round(v_qty * v_unit, 2);

    insert into public.quote_lines (
      quote_id, item_id, description, quantity, unit_amount, tax_rate, amount, line_order
    )
    values (
      v_quote.id,
      nullif(v_line ->> 'item_id', '')::uuid,
      v_line ->> 'description',
      v_qty,
      v_unit,
      v_rate,
      v_amt,
      coalesce((v_line ->> 'line_order')::int, v_line_order)
    );

    v_line_order := v_line_order + 1;
  end loop;

  -- Return with lines.
  return jsonb_build_object(
    'id', v_quote.id,
    'organization_id', v_quote.organization_id,
    'quote_number', v_quote.quote_number,
    'type', v_quote.type,
    'tenant_id', v_quote.tenant_id,
    'prospect_name', v_quote.prospect_name,
    'prospect_email', v_quote.prospect_email,
    'prospect_phone', v_quote.prospect_phone,
    'prospect_company', v_quote.prospect_company,
    'shop_id', v_quote.shop_id,
    'issue_date', v_quote.issue_date,
    'valid_until', v_quote.valid_until,
    'status', v_quote.status,
    'currency', v_quote.currency,
    'subtotal', v_quote.subtotal,
    'tax_amount', v_quote.tax_amount,
    'total', v_quote.total,
    'notes', v_quote.notes,
    'terms', v_quote.terms,
    'salesperson_id', v_quote.salesperson_id,
    'salesperson_name', v_quote.salesperson_name,
    'converted_invoice_id', v_quote.converted_invoice_id,
    'converted_at', v_quote.converted_at,
    'created_at', v_quote.created_at,
    'lines', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'quote_id', l.quote_id,
            'item_id', l.item_id,
            'description', l.description,
            'quantity', l.quantity,
            'unit_amount', l.unit_amount,
            'tax_rate', l.tax_rate,
            'amount', l.amount,
            'line_order', l.line_order
          )
          order by l.line_order
        )
        from public.quote_lines l
        where l.quote_id = v_quote.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.create_quote_with_lines(
  uuid, quote_type, uuid, text, text, text, text, uuid, date, date, text, jsonb, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- bulk_generate_rent_invoices
--
-- For every Active tenant with an active shop, generate a rent invoice for
-- the period. Skips tenants who already have one (idempotent).
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
      s.rental_amount,
      s.shopping_center_id
    from public.tenants t
    join public.shops s on s.id = t.shop_id
    where t.organization_id = p_organization_id
      and t.status = 'Active'::tenant_status
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
      organization_id, invoice_number, type, tenant_id, tenant_name,
      shop_id, shop_number, issue_date, due_date, status, currency,
      subtotal, tax_amount, total, amount_paid, invoice_period
    )
    values (
      v_rec.organization_id, v_invoice_number, 'Rent', v_rec.tenant_id, v_rec.tenant_name,
      v_rec.shop_id, v_rec.shop_number, v_issue_date, v_due_date,
      'Draft'::invoice_status, 'SZL',
      v_subtotal, v_tax, v_total, 0, v_period
    )
    returning id into v_invoice_id;

    insert into public.invoice_lines (
      invoice_id, description, quantity, unit_amount, amount, line_order
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
  'Generates rent invoices for active tenants, skipping those who already have one for the period. Returns count of new invoices.';

grant execute on function public.bulk_generate_rent_invoices(uuid, date, numeric) to authenticated;