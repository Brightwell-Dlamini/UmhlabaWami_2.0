-- ============================================================================
-- 004_triggers.sql
--
-- Triggers that fill NOT NULL columns and maintain updated_at.
-- Assumes 001, 002, 003 have run.
-- Idempotent: drops and recreates each trigger/function.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) handle_new_auth_user
--
-- Fires when Supabase creates a new auth.users row. Populates public.profiles
-- with safe defaults. The role is coerced: only 'tenant' and 'admin' are
-- allowed from self-signup metadata; anything else becomes 'tenant'.
-- This is the Phase-6 hardening we shipped earlier, reimplemented.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested_role text;
  v_safe_role user_role;
  v_org_id uuid;
  v_status user_status;
  v_username text;
begin
  v_requested_role := nullif(new.raw_user_meta_data ->> 'role', '');

  v_safe_role := case
    when v_requested_role in ('tenant', 'admin') then v_requested_role::user_role
    else 'tenant'::user_role
  end;

  v_org_id := nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid;
  v_status := coalesce(
    nullif(new.raw_user_meta_data ->> 'status', '')::user_status,
    'Active'::user_status
  );

  v_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (
    id,
    email,
    name,
    username,
    role,
    phone,
    organization_id,
    status
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    v_username,
    v_safe_role,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    v_org_id,
    v_status
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- 2) set_updated_at — shared trigger function for tables with updated_at.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Apply to tables that have updated_at.
drop trigger if exists set_updated_at_sla_matrix on public.sla_matrix;
create trigger set_updated_at_sla_matrix
  before update on public.sla_matrix
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_conversations on public.conversations;
create trigger set_updated_at_conversations
  before update on public.conversations
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_subscription_tiers on public.subscription_tiers;
create trigger set_updated_at_subscription_tiers
  before update on public.subscription_tiers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) tickets_set_number
--
-- Format: TKT-YYMMDD-NNNN, sequential per organization per day.
-- ---------------------------------------------------------------------------
create or replace function public.generate_ticket_number(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := 'TKT-' || to_char(now(), 'YYMMDD') || '-';
  v_next int;
begin
  -- Serialize per org.
  perform 1 from public.organizations where id = p_org_id for update;

  select coalesce(max(substring(ticket_number from 14 for 4)::int), 0) + 1
    into v_next
    from public.tickets
   where organization_id = p_org_id
     and ticket_number like v_prefix || '%';

  return v_prefix || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.tickets_set_number_trigger()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_number is null or new.ticket_number = '' then
    new.ticket_number := public.generate_ticket_number(new.organization_id);
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_set_number on public.tickets;
create trigger tickets_set_number
  before insert on public.tickets
  for each row execute function public.tickets_set_number_trigger();

-- ---------------------------------------------------------------------------
-- 4) tickets_set_deadlines
--
-- Reads the org's SLA matrix for the priority and computes response /
-- resolution deadlines. Falls back to sensible defaults if no matrix row.
-- Runs AFTER the number trigger (order doesn't matter here, but keep them
-- separate so it's clear).
-- ---------------------------------------------------------------------------
create or replace function public.tickets_set_deadlines_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response int;
  v_resolution int;
begin
  -- Look up the SLA matrix for this org + priority.
  select response_minutes, resolution_minutes
    into v_response, v_resolution
    from public.sla_matrix
   where organization_id = new.organization_id
     and priority = new.priority
   limit 1;

  -- Fallbacks if the matrix has no row yet.
  if v_response is null then
    v_response := case new.priority
      when 'Emergency' then 15
      when 'High' then 60
      when 'Medium' then 240
      else 1440
    end;
  end if;

  if v_resolution is null then
    v_resolution := case new.priority
      when 'Emergency' then 240
      when 'High' then 480
      when 'Medium' then 1440
      else 4320
    end;
  end if;

  if new.response_deadline is null then
    new.response_deadline := coalesce(new.created_at, now()) + (v_response || ' minutes')::interval;
  end if;

  if new.resolution_deadline is null then
    new.resolution_deadline := coalesce(new.created_at, now()) + (v_resolution || ' minutes')::interval;
  end if;

  return new;
end;
$$;

drop trigger if exists tickets_set_deadlines on public.tickets;
create trigger tickets_set_deadlines
  before insert on public.tickets
  for each row execute function public.tickets_set_deadlines_trigger();

-- ---------------------------------------------------------------------------
-- 5) invoices_set_number
--
-- Only fills the number if it's NULL or empty. The bulk generator RPC calls
-- generate_invoice_number directly; this is the fallback for manual inserts.
-- ---------------------------------------------------------------------------
create or replace function public.generate_invoice_number(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char(now(), 'YYYYMM');
  v_seq int;
begin
  perform 1 from public.organizations where id = p_org_id for update;

  select count(*) + 1
    into v_seq
    from public.invoices
   where organization_id = p_org_id
     and to_char(created_at, 'YYYYMM') = v_period;

  -- Retry loop for uniqueness.
  for i in 1..50 loop
    if not exists (
      select 1 from public.invoices
       where organization_id = p_org_id
         and invoice_number = 'INV-' || v_period || '-' || lpad((v_seq + i - 1)::text, 4, '0')
    ) then
      return 'INV-' || v_period || '-' || lpad((v_seq + i - 1)::text, 4, '0');
    end if;
  end loop;

  -- Fallback with random suffix (extremely unlikely).
  return 'INV-' || v_period || '-' || lpad(v_seq::text, 4, '0')
         || '-' || substring(gen_random_uuid()::text, 1, 4);
end;
$$;

create or replace function public.invoices_set_number_trigger()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number := public.generate_invoice_number(new.organization_id);
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_set_number on public.invoices;
create trigger invoices_set_number
  before insert on public.invoices
  for each row execute function public.invoices_set_number_trigger();

-- ---------------------------------------------------------------------------
-- 6) quotes_set_number — QT-YYMMDD-NNNN.
-- ---------------------------------------------------------------------------
create or replace function public.generate_quote_number(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := 'QT-' || to_char(now(), 'YYMMDD') || '-';
  v_next int;
begin
  perform 1 from public.organizations where id = p_org_id for update;

  select coalesce(max(substring(quote_number from 13 for 4)::int), 0) + 1
    into v_next
    from public.quotes
   where organization_id = p_org_id
     and quote_number like v_prefix || '%';

  return v_prefix || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.quotes_set_number_trigger()
returns trigger
language plpgsql
as $$
begin
  if new.quote_number is null or new.quote_number = '' then
    new.quote_number := public.generate_quote_number(new.organization_id);
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_set_number on public.quotes;
create trigger quotes_set_number
  before insert on public.quotes
  for each row execute function public.quotes_set_number_trigger();

-- ---------------------------------------------------------------------------
-- 7) sales_orders_set_number — SO-YYMMDD-NNNN.
-- ---------------------------------------------------------------------------
create or replace function public.generate_order_number(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := 'SO-' || to_char(now(), 'YYMMDD') || '-';
  v_next int;
begin
  perform 1 from public.organizations where id = p_org_id for update;

  select coalesce(max(substring(order_number from 13 for 4)::int), 0) + 1
    into v_next
    from public.sales_orders
   where organization_id = p_org_id
     and order_number like v_prefix || '%';

  return v_prefix || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.sales_orders_set_number_trigger()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.generate_order_number(new.organization_id);
  end if;
  return new;
end;
$$;

drop trigger if exists sales_orders_set_number on public.sales_orders;
create trigger sales_orders_set_number
  before insert on public.sales_orders
  for each row execute function public.sales_orders_set_number_trigger();

-- ---------------------------------------------------------------------------
-- 8) Grants.
-- ---------------------------------------------------------------------------
grant execute on function public.generate_ticket_number(uuid) to authenticated;
grant execute on function public.generate_invoice_number(uuid) to authenticated;
grant execute on function public.generate_quote_number(uuid) to authenticated;
grant execute on function public.generate_order_number(uuid) to authenticated;