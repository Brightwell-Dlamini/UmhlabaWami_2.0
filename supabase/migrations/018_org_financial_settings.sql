-- ============================================================================
-- 018_org_financial_settings.sql
--
-- Persists the "Commercial Leasing & Financial Rules" section of
-- OrgSettingsView. These drive invoice generation, late-fee computation,
-- and utility billing when those features land.
-- ============================================================================

alter table public.organizations
  add column if not exists escalation_rate_pct numeric not null default 8.0,
  add column if not exists grace_period_days int not null default 7,
  add column if not exists utility_markup_pct numeric not null default 5.0,
  add column if not exists auto_invoice_enabled boolean not null default true;

-- Range guards: escalation 0–50%, grace 0–90 days, markup 0–50%.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_escalation_rate_range'
  ) then
    alter table public.organizations
      add constraint organizations_escalation_rate_range
      check (escalation_rate_pct >= 0 and escalation_rate_pct <= 50);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_grace_period_range'
  ) then
    alter table public.organizations
      add constraint organizations_grace_period_range
      check (grace_period_days >= 0 and grace_period_days <= 90);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_utility_markup_range'
  ) then
    alter table public.organizations
      add constraint organizations_utility_markup_range
      check (utility_markup_pct >= 0 and utility_markup_pct <= 50);
  end if;
end
$$;

comment on column public.organizations.escalation_rate_pct is
  'Annual rent escalation rate applied at lease renewal. Percent, 0–50.';
comment on column public.organizations.grace_period_days is
  'Days after due date before a late fee is applied. 0–90.';
comment on column public.organizations.utility_markup_pct is
  'Surcharge applied to recovered utility costs. Percent, 0–50.';
comment on column public.organizations.auto_invoice_enabled is
  'When true, rent invoices are generated automatically on the 1st of each month.';

do $$
declare
  v_orgs integer;
begin
  select count(*) into v_orgs from public.organizations;
  raise notice 'Organizations updated with financial settings defaults: %', v_orgs;
end
$$;
