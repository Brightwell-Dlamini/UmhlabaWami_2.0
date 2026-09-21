-- ============================================================================
-- 015_tickets_lite_rls.sql
--
-- Confirms row-level access for the columns used in ticketsApi.listLite().
--
-- listLite selects:
--   id, ticket_number, organization_id, shopping_center_id, property_id,
--   shop_id, tenant_id, title, description, exact_location_description,
--   priority, category, status, assigned_to, assigned_to_name,
--   created_by_user_id, created_at, response_deadline, resolution_deadline,
--   responded_at, resolved_at, closed_at, sla_status, tenant_confirmed_fixed
--
-- If your tickets table uses column-level grants (rare), extend them here.
-- Otherwise, this migration only confirms row-level policies are sufficient.
-- ============================================================================

alter table public.tickets enable row level security;

drop policy if exists tickets_select_tenant on public.tickets;
drop policy if exists tickets_select_org on public.tickets;
drop policy if exists tickets_select_super on public.tickets;

-- Tenants: only their own tickets (by user id or by shop id).
create policy tickets_select_tenant
  on public.tickets
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'tenant'
        and (
          p.id = tickets.created_by_user_id
          or (p.shop_id is not null and p.shop_id = tickets.shop_id)
        )
    )
  );

-- Managers, admins, finance, maintenance: all tickets in their org.
create policy tickets_select_org
  on public.tickets
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('property_manager', 'admin', 'finance', 'maintenance')
        and p.organization_id = tickets.organization_id
    )
  );

-- Super admins: all tickets.
create policy tickets_select_super
  on public.tickets
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  );

-- If your project uses column grants (unusual), grant explicit SELECT
-- on the lite columns to authenticated:
-- grant select (
--   id, ticket_number, organization_id, shopping_center_id, property_id,
--   shop_id, tenant_id, title, description, exact_location_description,
--   priority, category, status, assigned_to, assigned_to_name,
--   created_by_user_id, created_at, response_deadline, resolution_deadline,
--   responded_at, resolved_at, closed_at, sla_status, tenant_confirmed_fixed
-- ) on public.tickets to authenticated;
