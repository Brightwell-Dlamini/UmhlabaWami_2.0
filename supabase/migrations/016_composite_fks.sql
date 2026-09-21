-- ============================================================================
-- 016_composite_fks.sql
--
-- Enforce same-org referential integrity via composite foreign keys.
--
-- For each child table we:
--   1. Add a UNIQUE constraint on the parent's (id, organization_id).
--   2. Add a composite FK on the child's (parent_id, organization_id).
--
-- This prevents cross-tenant data leaks from client bugs or hostile payloads.
-- Existing violations are surfaced first — they must be fixed manually.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Pre-flight: report any existing cross-org orphans. Fix before proceeding.
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  -- Invoices vs tenants
  select count(*) into v_count
    from public.invoices i
    join public.tenants t on t.id = i.tenant_id
   where i.tenant_id is not null
     and i.organization_id <> t.organization_id;
  if v_count > 0 then
    raise exception 'Cross-org invoices→tenants: % rows. Fix before running this migration.', v_count;
  end if;

  -- Leases vs tenants
  select count(*) into v_count
    from public.leases l
    join public.tenants t on t.id = l.tenant_id
   where l.organization_id <> t.organization_id;
  if v_count > 0 then
    raise exception 'Cross-org leases→tenants: % rows. Fix before running.', v_count;
  end if;

  -- Tickets vs shops
  select count(*) into v_count
    from public.tickets tk
    join public.shops s on s.id = tk.shop_id
   where tk.shop_id is not null
     and tk.organization_id <> s.organization_id;
  if v_count > 0 then
    raise exception 'Cross-org tickets→shops: % rows. Fix before running.', v_count;
  end if;

  -- Shops vs shopping_centers
  select count(*) into v_count
    from public.shops s
    join public.shopping_centers c on c.id = s.shopping_center_id
   where s.organization_id <> c.organization_id;
  if v_count > 0 then
    raise exception 'Cross-org shops→centers: % rows. Fix before running.', v_count;
  end if;

  -- Properties vs shopping_centers
  select count(*) into v_count
    from public.properties p
    join public.shopping_centers c on c.id = p.shopping_center_id
   where p.organization_id <> c.organization_id;
  if v_count > 0 then
    raise exception 'Cross-org properties→centers: % rows. Fix before running.', v_count;
  end if;

  raise notice 'Pre-flight clean. Proceeding with composite FKs.';
end
$$;

-- ---------------------------------------------------------------------------
-- Helper: idempotent creation of unique constraint + composite FK.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_composite_fk(
  p_child_table text,
  p_child_col text,
  p_parent_table text,
  p_constraint_suffix text
)
returns void
language plpgsql
as $$
declare
  v_unique_name text := p_parent_table || '_id_org_unique';
  v_fk_name text := p_child_table || '_' || p_constraint_suffix || '_fkey';
begin
  -- Unique index on parent (id, organization_id) — required for composite FK.
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = v_unique_name
  ) then
    execute format(
      'create unique index %I on public.%I (id, organization_id)',
      v_unique_name, p_parent_table
    );
  end if;

  -- Composite FK on child (parent_id, organization_id).
  if not exists (
    select 1 from pg_constraint
    where conname = v_fk_name
      and conrelid = format('public.%I', p_child_table)::regclass
  ) then
    execute format(
      'alter table public.%I
         add constraint %I
         foreign key (%I, organization_id)
         references public.%I (id, organization_id)
         on delete cascade',
      p_child_table,
      v_fk_name,
      p_child_col,
      p_parent_table
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) tenants → shopping_centers
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('tenants', 'shopping_center_id', 'shopping_centers', 'shopping_center');

-- ---------------------------------------------------------------------------
-- 2) shops → shopping_centers
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('shops', 'shopping_center_id', 'shopping_centers', 'shopping_center');

-- ---------------------------------------------------------------------------
-- 3) shops → properties
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('shops', 'property_id', 'properties', 'property');

-- ---------------------------------------------------------------------------
-- 4) properties → shopping_centers
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('properties', 'shopping_center_id', 'shopping_centers', 'shopping_center');

-- ---------------------------------------------------------------------------
-- 5) leases → tenants
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('leases', 'tenant_id', 'tenants', 'tenant');

-- ---------------------------------------------------------------------------
-- 6) leases → shops
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('leases', 'shop_id', 'shops', 'shop');

-- ---------------------------------------------------------------------------
-- 7) invoices → tenants
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('invoices', 'tenant_id', 'tenants', 'tenant');

-- ---------------------------------------------------------------------------
-- 8) invoices → shops (nullable column — composite FK allows NULL, but
--    the pair (NULL, org) is treated as "no reference" by Postgres).
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('invoices', 'shop_id', 'shops', 'shop');

-- ---------------------------------------------------------------------------
-- 9) tickets → tenants
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('tickets', 'tenant_id', 'tenants', 'tenant');

-- ---------------------------------------------------------------------------
-- 10) tickets → shops
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('tickets', 'shop_id', 'shops', 'shop');

-- ---------------------------------------------------------------------------
-- 11) payment_records → invoices
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('payment_records', 'invoice_id', 'invoices', 'invoice');

-- ---------------------------------------------------------------------------
-- 12) payment_records → tenants
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('payment_records', 'tenant_id', 'tenants', 'tenant');

-- ---------------------------------------------------------------------------
-- 13) finance_transactions → shopping_centers (via property_id → centers)
--     finance_transactions.property_id references a shopping center in the
--     app (naming legacy). Enforce same-org.
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('finance_transactions', 'property_id', 'shopping_centers', 'center');

-- ---------------------------------------------------------------------------
-- 14) staff_shifts → properties
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('staff_shifts', 'property_id', 'properties', 'property');

-- ---------------------------------------------------------------------------
-- 15) financial_requests → shopping_centers
-- ---------------------------------------------------------------------------
select public.ensure_composite_fk('financial_requests', 'property_id', 'shopping_centers', 'center');

-- Clean up the helper.
drop function if exists public.ensure_composite_fk(text, text, text, text);

-- Sanity: list all composite FKs we just created.
do $$
declare
  v_row record;
begin
  raise notice '--- Composite FKs on public schema ---';
  for v_row in
    select conname, conrelid::regclass as child
    from pg_constraint
    where contype = 'f'
      and connamespace = 'public'::regnamespace
      and array_length(conkey, 1) = 2
    order by conrelid::regclass::text, conname
  loop
    raise notice '% → %', v_row.child, v_row.conname;
  end loop;
end
$$;
