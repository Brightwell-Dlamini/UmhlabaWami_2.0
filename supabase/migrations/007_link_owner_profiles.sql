-- 007: Link orphan admin profiles to their approved organisations
-- Fixes org admins who can log in but have no organization_id (empty Centres UI)

alter table public.organizations
  add column if not exists owner_auth_user_id uuid references auth.users(id) on delete set null;

-- 1) From owner_auth_user_id pointer
update public.profiles p
set
  organization_id = o.id,
  role = case when p.role = 'super_admin' then p.role else 'admin' end,
  status = 'Active'
from public.organizations o
where o.owner_auth_user_id = p.id
  and o.status = 'Active'
  and (p.organization_id is distinct from o.id);

-- 2) From matching email when owner pointer missing
update public.profiles p
set
  organization_id = o.id,
  role = case when p.role = 'super_admin' then p.role else 'admin' end,
  status = 'Active'
from public.organizations o
where lower(o.email) = lower(p.email)
  and o.status = 'Active'
  and p.organization_id is null
  and p.role is distinct from 'super_admin';

-- 3) Backfill owner_auth_user_id on org from linked profile email
update public.organizations o
set owner_auth_user_id = p.id
from public.profiles p
where lower(o.email) = lower(p.email)
  and o.owner_auth_user_id is null
  and o.status = 'Active'
  and p.organization_id = o.id;

-- Allow owners to read their org even before organization_id is set on profile
drop policy if exists "org_select_owner" on public.organizations;
create policy "org_select_owner" on public.organizations for select using (
  owner_auth_user_id = auth.uid()
  or lower(email) = lower(coalesce((select email from public.profiles where id = auth.uid()), ''))
);
