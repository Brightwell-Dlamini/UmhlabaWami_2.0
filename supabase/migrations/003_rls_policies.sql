-- ============================================================================
-- 003_rls_policies.sql
--
-- Row Level Security for every public table.
-- Assumes 001 and 002 have run.
-- Idempotent: drops and recreates each policy.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions — cached per-statement for performance.
-- ---------------------------------------------------------------------------

-- Current caller's organization_id. Returns NULL if no profile / no org.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid() limit 1;
$$;

-- Current caller's role. Returns NULL if no profile.
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

-- Is the caller a super admin?
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

-- Is the caller an org admin (admin of their own org)?
create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'property_manager')
  );
$$;

grant execute on function public.current_org_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_org_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- ORGANIZATIONS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;

drop policy if exists organizations_select_own on public.organizations;
create policy organizations_select_own on public.organizations
  for select using (
    id = public.current_org_id()
    or public.is_super_admin()
  );

drop policy if exists organizations_select_by_owner on public.organizations;
create policy organizations_select_by_owner on public.organizations
  for select using (
    owner_auth_user_id = auth.uid()
  );

drop policy if exists organizations_insert_public on public.organizations;
-- Anyone can insert (registration flow). The RPC enforces sanity.
create policy organizations_insert_public on public.organizations
  for insert with check (true);

drop policy if exists organizations_update_super on public.organizations;
create policy organizations_update_super on public.organizations
  for update using (public.is_super_admin());

drop policy if exists organizations_update_own on public.organizations;
create policy organizations_update_own on public.organizations
  for update using (id = public.current_org_id())
  with check (id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_select_org on public.profiles;
create policy profiles_select_org on public.profiles
  for select using (
    organization_id is not null
    and organization_id = public.current_org_id()
  );

drop policy if exists profiles_select_super on public.profiles;
create policy profiles_select_super on public.profiles
  for select using (public.is_super_admin());

drop policy if exists profiles_insert_self on public.profiles;
-- Self-signup only (org owners + tenants). Role must be safe.
create policy profiles_insert_self on public.profiles
  for insert with check (
    id = auth.uid()
    and role in ('tenant', 'admin')
    and status in ('Active', 'Pending')
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid() limit 1)
    and status = (select status from public.profiles where id = auth.uid() limit 1)
    and coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce((select organization_id from public.profiles where id = auth.uid() limit 1), '00000000-0000-0000-0000-000000000000'::uuid)
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (
    public.is_super_admin()
    or (
      public.is_org_admin()
      and organization_id = public.current_org_id()
    )
  );

-- ---------------------------------------------------------------------------
-- SHOPPING_CENTERS
-- ---------------------------------------------------------------------------
alter table public.shopping_centers enable row level security;

drop policy if exists centers_select on public.shopping_centers;
create policy centers_select on public.shopping_centers
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists centers_write on public.shopping_centers;
create policy centers_write on public.shopping_centers
  for all using (
    organization_id = public.current_org_id() or public.is_super_admin()
  )
  with check (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- PROPERTIES
-- ---------------------------------------------------------------------------
alter table public.properties enable row level security;

drop policy if exists properties_select on public.properties;
create policy properties_select on public.properties
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists properties_write on public.properties;
create policy properties_write on public.properties
  for all using (
    organization_id = public.current_org_id() or public.is_super_admin()
  )
  with check (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- SHOPS — tenants can see units in their org
-- ---------------------------------------------------------------------------
alter table public.shops enable row level security;

drop policy if exists shops_select_own on public.shops;
create policy shops_select_own on public.shops
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists shops_select_public on public.shops;
create policy shops_select_public on public.shops
  for select using (public_listing = true);

drop policy if exists shops_write on public.shops;
create policy shops_write on public.shops
  for all using (
    organization_id = public.current_org_id() or public.is_super_admin()
  )
  with check (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- TENANTS
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;

drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists tenants_write on public.tenants;
create policy tenants_write on public.tenants
  for all using (
    organization_id = public.current_org_id() or public.is_super_admin()
  )
  with check (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- LEASES
-- ---------------------------------------------------------------------------
alter table public.leases enable row level security;

drop policy if exists leases_select on public.leases;
create policy leases_select on public.leases
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists leases_write on public.leases;
create policy leases_write on public.leases
  for all using (
    organization_id = public.current_org_id() or public.is_super_admin()
  )
  with check (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- SLA_MATRIX
-- ---------------------------------------------------------------------------
alter table public.sla_matrix enable row level security;

drop policy if exists sla_matrix_select on public.sla_matrix;
create policy sla_matrix_select on public.sla_matrix
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists sla_matrix_write on public.sla_matrix;
create policy sla_matrix_write on public.sla_matrix
  for all using (
    organization_id = public.current_org_id() or public.is_super_admin()
  )
  with check (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- TICKETS
-- Tenants see only their own (by user_id or by their tenant.shop_id).
-- Staff see everything in their org.
-- ---------------------------------------------------------------------------
alter table public.tickets enable row level security;

drop policy if exists tickets_select_tenant on public.tickets;
create policy tickets_select_tenant on public.tickets
  for select using (
    public.current_user_role() = 'tenant'
    and (
      created_by_user_id = auth.uid()
      or exists (
        select 1 from public.tenants t
        where t.user_id = auth.uid() and t.shop_id = tickets.shop_id
      )
    )
  );

drop policy if exists tickets_select_org on public.tickets;
create policy tickets_select_org on public.tickets
  for select using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','maintenance','finance','admin')
  );

drop policy if exists tickets_select_super on public.tickets;
create policy tickets_select_super on public.tickets
  for select using (public.is_super_admin());

drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets
  for insert with check (
    organization_id = public.current_org_id()
    and created_by_user_id = auth.uid()
    and public.current_user_role() in ('tenant','property_manager','admin')
  );

drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets
  for update using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists tickets_delete on public.tickets;
create policy tickets_delete on public.tickets
  for delete using (
    public.is_super_admin()
    or (organization_id = public.current_org_id() and public.current_user_role() = 'admin')
  );

-- ---------------------------------------------------------------------------
-- TICKET_TIMELINE
-- ---------------------------------------------------------------------------
alter table public.ticket_timeline enable row level security;

drop policy if exists ticket_timeline_select on public.ticket_timeline;
create policy ticket_timeline_select on public.ticket_timeline
  for select using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_timeline.ticket_id
    )
  );

drop policy if exists ticket_timeline_insert on public.ticket_timeline;
create policy ticket_timeline_insert on public.ticket_timeline
  for insert with check (true);

-- ---------------------------------------------------------------------------
-- TICKET_ATTACHMENTS
-- ---------------------------------------------------------------------------
alter table public.ticket_attachments enable row level security;

drop policy if exists ticket_attachments_select on public.ticket_attachments;
create policy ticket_attachments_select on public.ticket_attachments
  for select using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_attachments.ticket_id
    )
  );

drop policy if exists ticket_attachments_insert on public.ticket_attachments;
create policy ticket_attachments_insert on public.ticket_attachments
  for insert with check (true);

-- ---------------------------------------------------------------------------
-- TICKET_COMMENTS
-- ---------------------------------------------------------------------------
alter table public.ticket_comments enable row level security;

drop policy if exists ticket_comments_select on public.ticket_comments;
create policy ticket_comments_select on public.ticket_comments
  for select using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_comments.ticket_id
    )
  );

drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert on public.ticket_comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_comments.ticket_id
    )
  );