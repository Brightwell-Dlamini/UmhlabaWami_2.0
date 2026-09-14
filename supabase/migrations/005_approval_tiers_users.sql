-- 005: Org approval RPCs, subscription_tiers CRUD, user helpers

create table if not exists public.subscription_tiers (
  id uuid primary key default uuid_generate_v4(),
  tier_key text unique not null,
  name text not null,
  price_label text not null default '',
  property_limit int not null default 2,
  tenant_limit int not null default 50,
  user_limit int not null default 10,
  storage_limit_gb int not null default 5,
  features text[] not null default '{}',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_tiers enable row level security;

drop policy if exists "tiers_read_all" on public.subscription_tiers;
create policy "tiers_read_all" on public.subscription_tiers for select using (true);

drop policy if exists "tiers_super_write" on public.subscription_tiers;
create policy "tiers_super_write" on public.subscription_tiers for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.subscription_tiers (tier_key, name, price_label, property_limit, tenant_limit, user_limit, storage_limit_gb, features, sort_order)
select * from (values
  ('Starter', 'Starter', 'E999 / mo', 2, 50, 10, 5, array['Up to 2 centres','50 tenants','10 staff users','Basic SLA'], 1),
  ('Professional', 'Professional', 'E2,999 / mo', 10, 250, 40, 25, array['10 centres','250 tenants','40 staff','Commercial engine','Priority support'], 2),
  ('Enterprise', 'Enterprise', 'Custom', 999, 9999, 500, 200, array['Unlimited centres','Dedicated support','Custom branding','Audit exports'], 3)
) as v(tier_key, name, price_label, property_limit, tenant_limit, user_limit, storage_limit_gb, features, sort_order)
where not exists (select 1 from public.subscription_tiers limit 1);

create or replace function public.approve_organization(
  p_org_id uuid,
  p_approver_name text default 'Super Admin',
  p_custom_code text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
  v_code text;
  v_prefix text;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin role required';
  end if;

  select * into v_org from public.organizations where id = p_org_id for update;
  if not found then
    raise exception 'Organization not found';
  end if;
  if v_org.status = 'Active' then
    raise exception 'Organization already active';
  end if;

  v_code := nullif(trim(upper(coalesce(p_custom_code, ''))), '');
  if v_code is null or v_code = 'PENDING' or v_code like 'PENDING%' then
    v_prefix := upper(left(regexp_replace(coalesce(v_org.company_name, 'ORG'), '[^a-zA-Z0-9]', '', 'g') || 'ORG', 3));
    v_code := v_prefix || '-' || to_char(now(), 'DDMMYY') || '-' || lpad((floor(random() * 9000) + 1000)::text, 4, '0');
  end if;

  while exists (
    select 1 from public.organizations where organization_code = v_code and id <> p_org_id
  ) loop
    v_prefix := upper(left(regexp_replace(coalesce(v_org.company_name, 'ORG'), '[^a-zA-Z0-9]', '', 'g') || 'ORG', 3));
    v_code := v_prefix || '-' || to_char(now(), 'DDMMYY') || '-' || lpad((floor(random() * 9000) + 1000)::text, 4, '0');
  end loop;

  update public.organizations set
    status = 'Active',
    organization_code = v_code,
    approved_at = now(),
    approved_by = auth.uid()
  where id = p_org_id
  returning * into v_org;

  insert into public.audit_logs (organization_id, user_id, user_name, action, details)
  values (
    v_org.id,
    auth.uid(),
    coalesce(p_approver_name, 'Super Admin'),
    'ORG_APPROVED',
    'Approved ' || v_org.company_name || ' → code ' || v_org.organization_code
  );

  return v_org;
end;
$$;

grant execute on function public.approve_organization(uuid, text, text) to authenticated;

create or replace function public.reject_organization(
  p_org_id uuid,
  p_approver_name text default 'Super Admin',
  p_reason text default 'Rejected'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super admin role required';
  end if;

  update public.organizations
  set status = 'Rejected'
  where id = p_org_id and status <> 'Active';

  insert into public.audit_logs (organization_id, user_id, user_name, action, details)
  values (p_org_id, auth.uid(), coalesce(p_approver_name, 'Super Admin'), 'ORG_REJECTED', coalesce(p_reason, 'Rejected'));
end;
$$;

grant execute on function public.reject_organization(uuid, text, text) to authenticated;

create or replace function public.activate_profile(
  p_user_id uuid,
  p_actor_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role user_role;
  v_actor_org uuid;
  v_target public.profiles;
begin
  select role, organization_id into v_actor_role, v_actor_org
  from public.profiles where id = auth.uid();

  if v_actor_role is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Profile not found';
  end if;

  if v_actor_role = 'super_admin'
     or (v_actor_role in ('admin', 'property_manager') and v_target.organization_id = v_actor_org)
  then
    update public.profiles set status = 'Active' where id = p_user_id
    returning * into v_target;
    return v_target;
  end if;

  raise exception 'Not allowed to activate this profile';
end;
$$;

grant execute on function public.activate_profile(uuid, text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, name, role, status, phone, organization_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email, 'user'), '@', 1)),
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'User'), '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'tenant'),
    coalesce(new.raw_user_meta_data->>'status', 'Active'),
    new.raw_user_meta_data->>'phone',
    nullif(new.raw_user_meta_data->>'organization_id', '')::uuid
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(nullif(excluded.name, ''), profiles.name),
    username = coalesce(nullif(excluded.username, ''), profiles.username),
    role = coalesce(excluded.role, profiles.role),
    phone = coalesce(excluded.phone, profiles.phone),
    organization_id = coalesce(excluded.organization_id, profiles.organization_id),
    status = coalesce(excluded.status, profiles.status);
  return new;
end;
$$;
