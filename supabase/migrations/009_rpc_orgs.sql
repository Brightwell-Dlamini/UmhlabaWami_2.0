-- ============================================================================
-- 009_rpc_orgs.sql
--
-- Organization lifecycle + auth helpers.
-- Assumes 001–008 have run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- register_organization
--
-- Called from the RegisterOrgModal after Supabase signUp. Creates the
-- org in Pending Approval, links owner_auth_user_id. The signup trigger
-- already created a profiles row; we update it to point at the new org.
--
-- Generates a temporary organization_code (provisional); the real one is
-- issued at approval time.
-- ---------------------------------------------------------------------------
create or replace function public.register_organization(
  p_owner_auth_user_id uuid,
  p_company_name text,
  p_owner_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_subscription_tier subscription_tier,
  p_estimated_monthly_rent numeric,
  p_property_count int,
  p_tenant_count int,
  p_staff_breakdown jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provisional_code text;
  v_org public.organizations%rowtype;
begin
  -- Provisional code based on timestamp; real one issued at approval.
  v_provisional_code := 'PEND-' || to_char(now(), 'YYMMDDHH24MISS');

  insert into public.organizations (
    organization_code,
    company_name,
    owner_name,
    email,
    phone,
    address,
    subscription_tier,
    status,
    owner_auth_user_id,
    monthly_fee_estimate,
    property_limit,
    tenant_limit,
    user_limit,
    storage_limit
  )
  values (
    v_provisional_code,
    p_company_name,
    p_owner_name,
    lower(p_email),
    p_phone,
    p_address,
    coalesce(p_subscription_tier, 'Starter'::subscription_tier),
    'Pending Approval'::org_status,
    p_owner_auth_user_id,
    coalesce(p_estimated_monthly_rent, 0),
    case coalesce(p_subscription_tier, 'Starter'::subscription_tier)
      when 'Starter' then 2
      when 'Professional' then 10
      when 'Enterprise' then 999
    end,
    case coalesce(p_subscription_tier, 'Starter'::subscription_tier)
      when 'Starter' then 50
      when 'Professional' then 250
      when 'Enterprise' then 9999
    end,
    case coalesce(p_subscription_tier, 'Starter'::subscription_tier)
      when 'Starter' then 10
      when 'Professional' then 40
      when 'Enterprise' then 500
    end,
    case coalesce(p_subscription_tier, 'Starter'::subscription_tier)
      when 'Starter' then 5
      when 'Professional' then 25
      when 'Enterprise' then 200
    end
  )
  returning * into v_org;

  -- Link the owner's profile to the org. Also promote them to 'admin'.
  update public.profiles
     set organization_id = v_org.id,
         role = 'admin'::user_role,
         status = 'Active'::user_status
   where id = p_owner_auth_user_id;

  return to_jsonb(v_org);
end;
$$;

grant execute on function public.register_organization(
  uuid, text, text, text, text, text, subscription_tier, numeric, int, int, jsonb
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- lookup_organization
--
-- Login flow step 1: verify the code exists and is Active. Returns the org
-- row or NULL. The client treats NULL indistinctly from a wrong password
-- (uniform error surface, per the auth.ts design).
-- ---------------------------------------------------------------------------
create or replace function public.lookup_organization(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(o)
    from public.organizations o
   where upper(o.organization_code) = upper(trim(p_code))
   limit 1;
$$;

grant execute on function public.lookup_organization(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- resolve_login_email
--
-- Login flow step 2: (org_code, username) → email. Supabase auth expects
-- an email for signInWithPassword, but users log in with a username.
-- Returns NULL if not found (indistinguishable to the client).
-- ---------------------------------------------------------------------------
create or replace function public.resolve_login_email(
  p_org_code text,
  p_identifier text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.email
    from public.profiles p
    join public.organizations o on o.id = p.organization_id
   where upper(o.organization_code) = upper(trim(p_org_code))
     and (
       lower(p.username) = lower(trim(p_identifier))
       or lower(p.email) = lower(trim(p_identifier))
     )
     and p.status = 'Active'::user_status
   limit 1;
$$;

grant execute on function public.resolve_login_email(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- approve_organization
--
-- Super admin approves a pending org. Issues a real organization_code
-- (either the provided custom code or an auto-generated one), links the
-- owner profile, returns the trio the client needs.
-- ---------------------------------------------------------------------------
create or replace function public.approve_organization(
  p_org_id uuid,
  p_approver_name text,
  p_custom_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
  v_code text;
  v_owner_id uuid;
begin
  select * into v_org from public.organizations where id = p_org_id for update;
  if not found then
    raise exception 'Organisation not found.' using errcode = '02000';
  end if;
  if v_org.status = 'Active'::org_status then
    raise exception 'Organisation is already active.' using errcode = '22023';
  end if;

  -- Determine the code.
  if p_custom_code is not null and length(trim(p_custom_code)) > 0 then
    v_code := upper(trim(p_custom_code));
  else
    -- Auto-generate: {3-letter prefix}-{DDMMYY}-{4 random}
    declare
      v_prefix text;
      v_rand int;
    begin
      v_prefix := upper(substring(regexp_replace(v_org.company_name, '[^a-zA-Z0-9]', '', 'g') from 1 for 3));
      if length(v_prefix) < 3 then
        v_prefix := rpad(v_prefix, 3, 'X');
      end if;
      v_rand := floor(random() * 9000 + 1000)::int;
      v_code := v_prefix || '-' || to_char(now(), 'DDMMYY') || '-' || v_rand::text;
    end;
  end if;

  -- Ensure uniqueness.
  while exists (select 1 from public.organizations where organization_code = v_code and id <> p_org_id) loop
    v_code := v_code || '-' || floor(random() * 900 + 100)::int::text;
  end loop;

  update public.organizations
     set status = 'Active'::org_status,
         organization_code = v_code,
         approved_at = now(),
         approved_by = p_approver_name
   where id = p_org_id
   returning * into v_org;

  -- Link the owner's profile to the org.
  v_owner_id := v_org.owner_auth_user_id;
  if v_owner_id is null then
    -- Fallback: find by email.
    select id into v_owner_id
      from public.profiles
     where lower(email) = lower(v_org.email)
     limit 1;
  end if;

  if v_owner_id is not null then
    update public.profiles
       set organization_id = v_org.id,
           role = 'admin'::user_role,
           status = 'Active'::user_status
     where id = v_owner_id;
  end if;

  return jsonb_build_object(
    'organizationId', v_org.id,
    'organizationCode', v_org.organization_code,
    'adminUserId', coalesce(v_owner_id::text, '')
  );
end;
$$;

grant execute on function public.approve_organization(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- reject_organization
-- ---------------------------------------------------------------------------
create or replace function public.reject_organization(
  p_org_id uuid,
  p_approver_name text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organizations
     set status = 'Rejected'::org_status,
         approved_by = p_approver_name
   where id = p_org_id;

  if not found then
    raise exception 'Organisation not found.' using errcode = '02000';
  end if;
end;
$$;

grant execute on function public.reject_organization(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- set_profile_role — super admin only.
-- ---------------------------------------------------------------------------
create or replace function public.set_profile_role(
  p_user_id uuid,
  p_new_role user_role,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role user_role;
  v_target_role user_role;
  v_target_org uuid;
  v_row public.profiles%rowtype;
begin
  -- Only super admins can promote to super_admin.
  select role into v_actor_role from public.profiles where id = auth.uid();

  if p_new_role = 'super_admin'::user_role and v_actor_role <> 'super_admin'::user_role then
    raise exception 'Only super admins can grant super admin role.'
      using errcode = '42501';
  end if;

  select role, organization_id into v_target_role, v_target_org
    from public.profiles where id = p_user_id;

  if not found then
    raise exception 'User not found.' using errcode = '02000';
  end if;

  -- Prevent demoting the last admin in an org.
  if v_target_role = 'admin'::user_role
     and p_new_role <> 'admin'::user_role
     and v_target_org is not null then
    if (select count(*) from public.profiles
        where organization_id = v_target_org
          and role = 'admin'::user_role
          and status = 'Active'::user_status) <= 1 then
      raise exception 'Cannot demote the last admin of an organisation.'
        using errcode = '22023';
    end if;
  end if;

  update public.profiles
     set role = p_new_role
   where id = p_user_id
   returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.set_profile_role(uuid, user_role, text) to authenticated;

-- ---------------------------------------------------------------------------
-- set_profile_status — super admin or same-org admin.
-- ---------------------------------------------------------------------------
create or replace function public.set_profile_status(
  p_user_id uuid,
  p_new_status user_status,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_row public.profiles%rowtype;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.id is null then
    raise exception 'Caller has no profile.' using errcode = '02000';
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if v_target.id is null then
    raise exception 'Target user not found.' using errcode = '02000';
  end if;

  -- Only super admins can change a super admin's status.
  if v_target.role = 'super_admin'::user_role and v_actor.role <> 'super_admin'::user_role then
    raise exception 'Only super admins can change a super admin status.'
      using errcode = '42501';
  end if;

  -- Same-org check for non-super actors.
  if v_actor.role <> 'super_admin'::user_role then
    if v_actor.organization_id is null or v_actor.organization_id <> v_target.organization_id then
      raise exception 'Cannot change status outside your organisation.'
        using errcode = '42501';
    end if;
    if v_actor.role <> 'admin'::user_role then
      raise exception 'Only org admins can change status.' using errcode = '42501';
    end if;
  end if;

  -- Prevent self-suspension of a super admin.
  if p_user_id = auth.uid()
     and v_target.role = 'super_admin'::user_role
     and p_new_status <> 'Active'::user_status then
    raise exception 'You cannot suspend your own super admin account.'
      using errcode = '22023';
  end if;

  update public.profiles
     set status = p_new_status
   where id = p_user_id
   returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.set_profile_status(uuid, user_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- activate_profile — convenience alias for set_profile_status('Active').
-- ---------------------------------------------------------------------------
create or replace function public.activate_profile(
  p_user_id uuid,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.set_profile_status(p_user_id, 'Active'::user_status, p_actor_name);
end;
$$;

grant execute on function public.activate_profile(uuid, text) to authenticated;