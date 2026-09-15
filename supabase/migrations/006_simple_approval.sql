-- 006: Simple org approval — no edge functions
-- Adds owner_auth_user_id, replaces approve_organization to also attach owner profile

alter table public.organizations
  add column if not exists owner_auth_user_id uuid references auth.users(id) on delete set null;

create index if not exists organizations_owner_auth_user_id_idx
  on public.organizations (owner_auth_user_id);

-- Drop any existing overloads so return type can change safely
drop function if exists public.approve_organization(uuid, text, text);
drop function if exists public.approve_organization(uuid, text);
drop function if exists public.approve_organization(uuid);

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
  v_owner uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin role required';
  end if;

  select * into v_org from public.organizations where id = p_org_id for update;
  if not found then
    raise exception 'Organization not found';
  end if;
  if v_org.status = 'Active'::org_status then
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
    status = 'Active'::org_status,
    organization_code = v_code,
    approved_at = now(),
    approved_by = auth.uid()
  where id = p_org_id
  returning * into v_org;

  -- Attach owner as org admin (password already set at registration)
  v_owner := v_org.owner_auth_user_id;
  if v_owner is null and v_org.email is not null then
    select id into v_owner
    from public.profiles
    where lower(email) = lower(v_org.email)
    limit 1;
  end if;

  if v_owner is not null then
    update public.profiles set
      organization_id = v_org.id,
      role = 'admin',
      status = 'Active'
    where id = v_owner;

    -- keep pointer on org
    update public.organizations
      set owner_auth_user_id = coalesce(owner_auth_user_id, v_owner)
    where id = v_org.id
    returning * into v_org;

    begin
      insert into public.notifications (user_id, role, organization_id, type, title, message, read)
      values (
        v_owner,
        'admin',
        v_org.id,
        'approval',
        'Your organisation is approved',
        'Welcome to Umhlaba Wami. Your org code is ' || v_org.organization_code ||
          '. Sign in with the password you set during registration.',
        false
      );
    exception when others then
      null; -- non-fatal
    end;
  end if;

  begin
    insert into public.audit_logs (organization_id, user_id, user_name, action, details)
    values (
      v_org.id,
      auth.uid(),
      coalesce(p_approver_name, 'Super Admin'),
      'ORG_APPROVED',
      'Approved ' || v_org.company_name || ' → code ' || v_org.organization_code
    );
  exception when others then
    null;
  end;

  return v_org;
end;
$$;

grant execute on function public.approve_organization(uuid, text, text) to authenticated;

-- Reject (idempotent recreate)
drop function if exists public.reject_organization(uuid, text, text);
drop function if exists public.reject_organization(uuid, text);
drop function if exists public.reject_organization(uuid);

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
  set status = 'Rejected'::org_status
  where id = p_org_id and status <> 'Active'::org_status;

  begin
    insert into public.audit_logs (organization_id, user_id, user_name, action, details)
    values (p_org_id, auth.uid(), coalesce(p_approver_name, 'Super Admin'), 'ORG_REJECTED', coalesce(p_reason, 'Rejected'));
  exception when others then
    null;
  end;
end;
$$;

grant execute on function public.reject_organization(uuid, text, text) to authenticated;
