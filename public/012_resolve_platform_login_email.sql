-- ===========================================================================
-- 012_resolve_platform_login_email.sql
--
-- Lets platform admins sign in with username OR email when using org code
-- SUPER / PLATFORM / ADMIN. Security definer so it works before a session
-- exists (same pattern as resolve_login_email).
-- ===========================================================================

create or replace function public.resolve_platform_login_email(p_identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.email
    from public.profiles p
   where p.role = 'super_admin'::user_role
     and p.status = 'Active'::user_status
     and (
       lower(p.email) = lower(trim(p_identifier))
       or lower(coalesce(p.username, '')) = lower(trim(p_identifier))
     )
   limit 1;
$$;

grant execute on function public.resolve_platform_login_email(text) to anon, authenticated;
