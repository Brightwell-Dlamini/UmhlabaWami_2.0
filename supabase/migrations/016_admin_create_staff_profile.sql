-- ===========================================================================
-- 016_admin_create_staff_profile.sql
--
-- Allow org admins (and super admins) to create profile rows for other users.
-- Fixes: "Profile row failed: new row violates row-level security policy
-- for table profiles" when adding staff via the admin UI.
--
-- Also: security-definer RPC used by the client after auth.signUp, and a
-- safer handle_new_auth_user that preserves invited staff roles when an
-- organization_id is present in signup metadata.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) INSERT policies for staff created by admins
-- ---------------------------------------------------------------------------
drop policy if exists profiles_insert_org_admin on public.profiles;
create policy profiles_insert_org_admin on public.profiles
  for insert with check (
    (
      public.is_org_admin()
      and organization_id is not null
      and organization_id = public.current_org_id()
      and role <> 'super_admin'
    )
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- 2) RPC: admin_upsert_staff_profile (preferred path from the client)
-- ---------------------------------------------------------------------------
create or replace function public.admin_upsert_staff_profile(
  p_user_id uuid,
  p_email text,
  p_name text,
  p_username text,
  p_role user_role,
  p_phone text default null,
  p_organization_id uuid default null,
  p_status user_status default 'Active'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
  v_caller_org uuid;
  v_org uuid;
  v_row public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select role, organization_id
    into v_caller_role, v_caller_org
    from public.profiles
   where id = auth.uid()
   limit 1;

  if v_caller_role is null then
    raise exception 'Caller has no profile';
  end if;

  v_org := coalesce(p_organization_id, v_caller_org);

  if v_caller_role = 'super_admin' then
    null;
  elsif v_caller_role in ('admin', 'property_manager') then
    if v_org is null or v_org is distinct from v_caller_org then
      raise exception 'You can only add users to your own organisation';
    end if;
    if p_role = 'super_admin' then
      raise exception 'Only super admins can grant super_admin';
    end if;
  else
    raise exception 'Insufficient privileges to create staff profiles';
  end if;

  if p_user_id is null then
    raise exception 'User id is required';
  end if;
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'Email is required';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Name is required';
  end if;

  insert into public.profiles (
    id, email, name, username, role, phone, organization_id, status
  ) values (
    p_user_id,
    lower(trim(p_email)),
    trim(p_name),
    coalesce(nullif(trim(p_username), ''), split_part(lower(trim(p_email)), '@', 1)),
    p_role,
    nullif(trim(coalesce(p_phone, '')), ''),
    v_org,
    coalesce(p_status, 'Active'::user_status)
  )
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    username = excluded.username,
    role = excluded.role,
    phone = excluded.phone,
    organization_id = excluded.organization_id,
    status = excluded.status
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_upsert_staff_profile(
  uuid, text, text, text, user_role, text, uuid, user_status
) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) handle_new_auth_user — keep invited staff roles when org is present
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
  v_org_id := nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid;

  -- Self-signup without org: only tenant / admin are safe.
  -- Admin-invited signup (organization_id present): allow staff roles.
  if v_org_id is not null and v_requested_role in (
    'tenant', 'property_manager', 'maintenance', 'finance', 'admin'
  ) then
    v_safe_role := v_requested_role::user_role;
  elsif v_requested_role in ('tenant', 'admin') then
    v_safe_role := v_requested_role::user_role;
  else
    v_safe_role := 'tenant'::user_role;
  end if;

  v_status := coalesce(
    nullif(new.raw_user_meta_data ->> 'status', '')::user_status,
    'Active'::user_status
  );

  v_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (
    id, email, name, username, role, phone, organization_id, status
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
