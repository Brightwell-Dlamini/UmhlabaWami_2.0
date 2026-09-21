-- ============================================================================
-- 005_rpc_create_invoice.sql
--
-- Invoice creation RPCs.
-- Assumes 001–004 have run.
-- Idempotent: create or replace.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: build the JSONB shape the client expects (with lines array).
-- ---------------------------------------------------------------------------
create or replace function public.invoice_to_json(p_invoice_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', i.id,
    'organization_id', i.organization_id,
    'invoice_number', i.invoice_number,
    'type', i.type,
    'tenant_id', i.tenant_id,
    'tenant_name', i.tenant_name,
    'shop_id', i.shop_id,
    'shop_number', i.shop_number,
    'issue_date', i.issue_date,
    'due_date', i.due_date,
    'status', i.status,
    'currency', i.currency,
    'subtotal', i.subtotal,
    'tax_amount', i.tax_amount,
    'total', i.total,
    'amount_paid', i.amount_paid,
    'notes', i.notes,
    'created_at', i.created_at,
    'lines', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'description', l.description,
            'quantity', l.quantity,
            'unit_amount', l.unit_amount,
            'amount', l.amount
          )
          order by l.line_order
        )
        from public.invoice_lines l
        where l.invoice_id = i.id
      ),
      '[]'::jsonb
    )
  )
  from public.invoices i
  where i.id = p_invoice_id;
$$;

grant execute on function public.invoice_to_json(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_invoice_with_lines
--
-- p_lines is a JSONB array of:
--   { description, quantity, unit_amount }
-- Tax is computed at p_tax_rate (default 0.15) on the subtotal.
-- ---------------------------------------------------------------------------
create or replace function public.create_invoice_with_lines(
  p_organization_id uuid,
  p_tenant_id uuid,
  p_type invoice_type,
  p_issue_date date,
  p_due_date date,
  p_currency text,
  p_tax_rate numeric,
  p_lines jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_subtotal numeric(12,2) := 0;
  v_tax numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_invoice_id uuid;
  v_invoice_number text;
  v_tenant_name text;
  v_shop_id uuid;
  v_shop_number text;
  v_line_order int := 0;
  v_qty numeric;
  v_unit numeric;
  v_amt numeric;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'An invoice must have at least one line.'
      using errcode = '22023';
  end if;

  -- Resolve tenant + shop denormalized fields.
  select t.business_name, t.shop_id, s.shop_number
    into v_tenant_name, v_shop_id, v_shop_number
    from public.tenants t
    left join public.shops s on s.id = t.shop_id
   where t.id = p_tenant_id
     and t.organization_id = p_organization_id;

  if v_tenant_name is null then
    raise exception 'Tenant not found in organisation.'
      using errcode = '02000';
  end if;

  -- Sum lines.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := coalesce((v_line ->> 'quantity')::numeric, 0);
    v_unit := coalesce((v_line ->> 'unit_amount')::numeric, 0);
    v_amt := round(v_qty * v_unit, 2);
    v_subtotal := v_subtotal + v_amt;
  end loop;

  v_tax := round(v_subtotal * coalesce(p_tax_rate, 0.15), 2);
  v_total := v_subtotal + v_tax;

  v_invoice_number := public.generate_invoice_number(p_organization_id);

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
    notes,
    invoice_period
  )
  values (
    p_organization_id,
    v_invoice_number,
    p_type,
    p_tenant_id,
    v_tenant_name,
    v_shop_id,
    v_shop_number,
    p_issue_date,
    p_due_date,
    'Draft'::invoice_status,
    coalesce(p_currency, 'SZL'),
    v_subtotal,
    v_tax,
    v_total,
    0,
    p_notes,
    case when p_type = 'Rent' then to_char(p_issue_date, 'YYYY-MM') else null end
  )
  returning id into v_invoice_id;

  -- Lines.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := coalesce((v_line ->> 'quantity')::numeric, 0);
    v_unit := coalesce((v_line ->> 'unit_amount')::numeric, 0);
    v_amt := round(v_qty * v_unit, 2);

    insert into public.invoice_lines (
      invoice_id, description, quantity, unit_amount, amount, line_order
    )
    values (
      v_invoice_id,
      v_line ->> 'description',
      v_qty,
      v_unit,
      v_amt,
      v_line_order
    );

    v_line_order := v_line_order + 1;
  end loop;

  return public.invoice_to_json(v_invoice_id);
end;
$$;

grant execute on function public.create_invoice_with_lines(
  uuid, uuid, invoice_type, date, date, text, numeric, jsonb, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- convert_quote_to_invoice
--
-- Reads the quote + lines, creates a matching invoice, marks the quote as
-- converted. Fails if the quote has no tenant (prospect-only quotes can't
-- be converted — they need a tenant to bill against).
-- ---------------------------------------------------------------------------
create or replace function public.convert_quote_to_invoice(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_invoice_id uuid;
  v_invoice_number text;
  v_tenant_name text;
  v_shop_number text;
  v_line record;
  v_line_order int := 0;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Quote not found.' using errcode = '02000';
  end if;

  if v_quote.status = 'Converted' then
    raise exception 'Quote is already converted.' using errcode = '22023';
  end if;

  if v_quote.tenant_id is null then
    raise exception 'Quote has no tenant. Assign a tenant before converting.'
      using errcode = '22023';
  end if;

  select t.business_name, s.shop_number
    into v_tenant_name, v_shop_number
    from public.tenants t
    left join public.shops s on s.id = t.shop_id
   where t.id = v_quote.tenant_id;

  v_invoice_number := public.generate_invoice_number(v_quote.organization_id);

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
    notes,
    salesperson_id,
    salesperson_name,
    source_quote_id
  )
  values (
    v_quote.organization_id,
    v_invoice_number,
    case
      when v_quote.type = 'Lease Proposal' then 'Rent'::invoice_type
      when v_quote.type = 'Fitout Works' then 'Other'::invoice_type
      else 'Service Charge'::invoice_type
    end,
    v_quote.tenant_id,
    v_tenant_name,
    v_quote.shop_id,
    v_shop_number,
    current_date,
    current_date + 7,
    'Draft'::invoice_status,
    v_quote.currency,
    v_quote.subtotal,
    v_quote.tax_amount,
    v_quote.total,
    0,
    v_quote.notes,
    v_quote.salesperson_id,
    v_quote.salesperson_name,
    v_quote.id
  )
  returning id into v_invoice_id;

  for v_line in
    select * from public.quote_lines
    where quote_id = p_quote_id
    order by line_order
  loop
    insert into public.invoice_lines (
      invoice_id, description, quantity, unit_amount, amount, line_order
    )
    values (
      v_invoice_id,
      v_line.description,
      v_line.quantity,
      v_line.unit_amount,
      v_line.amount,
      v_line_order
    );
    v_line_order := v_line_order + 1;
  end loop;

  update public.quotes
     set status = 'Converted',
         converted_invoice_id = v_invoice_id,
         converted_at = now()
   where id = p_quote_id;

  return public.invoice_to_json(v_invoice_id);
end;
$$;

grant execute on function public.convert_quote_to_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- convert_order_to_invoice
-- ---------------------------------------------------------------------------
create or replace function public.convert_order_to_invoice(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.sales_orders%rowtype;
  v_invoice_id uuid;
  v_invoice_number text;
  v_tenant_name text;
  v_shop_number text;
  v_line record;
  v_line_order int := 0;
begin
  select * into v_order from public.sales_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.' using errcode = '02000';
  end if;

  if v_order.status = 'Invoiced' then
    raise exception 'Order is already invoiced.' using errcode = '22023';
  end if;

  if v_order.tenant_id is null then
    raise exception 'Order has no tenant.' using errcode = '22023';
  end if;

  select t.business_name, s.shop_number
    into v_tenant_name, v_shop_number
    from public.tenants t
    left join public.shops s on s.id = t.shop_id
   where t.id = v_order.tenant_id;

  v_invoice_number := public.generate_invoice_number(v_order.organization_id);

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
    notes,
    salesperson_id,
    salesperson_name,
    source_order_id
  )
  values (
    v_order.organization_id,
    v_invoice_number,
    'Other'::invoice_type,
    v_order.tenant_id,
    v_tenant_name,
    v_order.shop_id,
    v_shop_number,
    current_date,
    coalesce(v_order.due_date, current_date + 7),
    'Draft'::invoice_status,
    v_order.currency,
    v_order.subtotal,
    v_order.tax_amount,
    v_order.total,
    0,
    v_order.notes,
    v_order.salesperson_id,
    v_order.salesperson_name,
    v_order.id
  )
  returning id into v_invoice_id;

  for v_line in
    select * from public.sales_order_lines
    where order_id = p_order_id
    order by line_order
  loop
    insert into public.invoice_lines (
      invoice_id, description, quantity, unit_amount, amount, line_order
    )
    values (
      v_invoice_id,
      v_line.description,
      v_line.quantity,
      v_line.unit_amount,
      v_line.amount,
      v_line_order
    );
    v_line_order := v_line_order + 1;
  end loop;

  update public.sales_orders
     set status = 'Invoiced',
         converted_invoice_id = v_invoice_id,
         converted_at = now()
   where id = p_order_id;

  return public.invoice_to_json(v_invoice_id);
end;
$$;

grant execute on function public.convert_order_to_invoice(uuid) to authenticated;