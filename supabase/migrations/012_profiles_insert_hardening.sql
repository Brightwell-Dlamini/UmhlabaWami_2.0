-- ============================================================================
-- 012_profiles_insert_hardening.sql
--
-- Prevents privilege escalation via signup metadata.
--   1. Role allow-list as a CHECK constraint on profiles.role.
--   2. Status allow-list as a CHECK constraint.
--   3. RLS policies for SELECT/INSERT/UPDATE on profiles.
--   4. Tightened trigger that ignores role from raw_user_meta_data when
--      the caller is not a super_admin creating the row server-side.
-- ============================================================================

-- 1) Role + status constraints (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in (
        'tenant',
        'property_manager',
        'maintenance',
        'finance',
        'admin',
        'super_admin'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status in ('Active', 'Inactive', 'Pending', 'Suspended'));
  end if;
end
$$;

-- 2) Row Level Security on profiles.
alter table public.profiles enable row level security;

-- Drop and re-create policies idempotently.
drop policy if exists profiles_select_self on public.profiles;
drop policy if exists profiles_select_org on public.profiles;
drop policy if exists profiles_select_super on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

-- SELECT: any user can read their own row.
create policy profiles_select_self
  on public.profiles
  for select
  using (id = auth.uid());

-- SELECT: org members can see each other (needed for technician pickers).
create policy profiles_select_org
  on public.profiles
  for select
  using (
    organization_id is not null
    and organization_id = (
      select organization_id from public.profiles
      where id = auth.uid()
      limit 1
    )
  );

-- SELECT: super admins see everyone.
create policy profiles_select_super
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

-- INSERT: users may insert their own row only with safe defaults.
-- Prevents a fresh signup from claiming role = 'super_admin'.
create policy profiles_insert_self
  on public.profiles
  for insert
  with check (
    id = auth.uid()
    and role in ('tenant', 'admin')  -- org owners start as admin; tenants start as tenant
    and status in ('Active', 'Pending')
  );

-- UPDATE: users may edit their own non-privileged fields.
create policy profiles_update_self
  on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- Self-update cannot change role, status, or organization_id.
    -- Only name / phone / avatar_url are permitted.
    and role = (select role from public.profiles where id = auth.uid() limit 1)
    and status = (select status from public.profiles where id = auth.uid() limit 1)
    and coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(
          (select organization_id from public.profiles where id = auth.uid() limit 1),
          '00000000-0000-0000-0000-000000000000'::uuid
        )
  );

-- UPDATE: admins of the same org may edit their members (but not escalate
-- to super_admin — that check lives in the app layer + a trigger below).
create policy profiles_update_admin
  on public.profiles
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'super_admin')
        and (p.role = 'super_admin' or p.organization_id = profiles.organization_id)
    )
  )
  with check (
    -- Admins cannot promote anyone to super_admin via this policy.
    role <> 'super_admin'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  );

-- 3) Trigger hardening: when a new auth.users row triggers a profiles insert,
-- strip any role from raw_user_meta_data unless it's a safe default.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested_role text;
  v_safe_role text;
  v_org_id uuid;
  v_status text;
begin
  v_requested_role := nullif(new.raw_user_meta_data ->> 'role', '');

  -- Only tenant and admin are safe for a self-signup.
  -- Anything else is coerced to 'tenant'.
  v_safe_role := case
    when v_requested_role in ('tenant', 'admin') then v_requested_role
    else 'tenant'
  end;

  v_org_id := nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid;
  v_status := coalesce(
    nullif(new.raw_user_meta_data ->> 'status', ''),
    case when v_safe_role = 'admin' then 'Active' else 'Active' end
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
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    ),
    v_safe_role,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    v_org_id,
    v_status
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Re-bind the trigger if your auth.users trigger exists.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
