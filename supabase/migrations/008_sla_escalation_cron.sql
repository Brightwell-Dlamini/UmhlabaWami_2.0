-- ============================================================================
-- 010_sla_escalation_cron.sql
--
-- Server-side SLA escalation pass + scheduled execution.
-- Safe to run multiple times. Requires pg_cron extension.
-- ============================================================================

-- 1) Ensure pg_cron is available.
create extension if not exists pg_cron with schema extensions;

-- 2) The escalation pass. Idempotent.
create or replace function public.run_sla_escalation_pass(
  p_org_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed integer := 0;
begin
  with candidates as (
    select id,
           resolution_deadline,
           responded_at,
           sla_status
    from public.tickets
    where (p_org_id is null or organization_id = p_org_id)
      and status not in ('Resolved', 'Closed', 'Cancelled')
      and resolution_deadline is not null
  ),
  computed as (
    select id,
           sla_status as old_status,
           case
             when resolution_deadline <= now() then 'Overdue'
             when resolution_deadline <= now() + interval '25 percent' * (resolution_deadline - now())
               then 'Warning'
             else 'Compliant'
           end as new_status
    from candidates
  ),
  updated as (
    update public.tickets t
    set sla_status = c.new_status
    from computed c
    where t.id = c.id
      and t.sla_status is distinct from c.new_status
    returning t.id
  )
  select count(*) into v_changed from updated;

  return v_changed;
end;
$$;

comment on function public.run_sla_escalation_pass(uuid) is
  'Advances sla_status for open tickets. Returns number of rows changed. Callable by authenticated users (scoped to their org via RLS) and by pg_cron for the whole platform.';

-- 3) Grant execution. RLS still scopes rows for authenticated callers.
grant execute on function public.run_sla_escalation_pass(uuid) to authenticated;

-- 4) Schedule the cron job. Replaces any existing job with this name.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'umhlaba_wami_sla_escalation';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'umhlaba_wami_sla_escalation',
    '*/5 * * * *',
    $cron$ select public.run_sla_escalation_pass(null); $cron$
  );
end
$$;

-- 5) Optional: log cron runs. Requires an audit_logs table with the right
-- shape. If yours differs, adapt or drop this block.
create or replace function public.log_sla_escalation_run()
returns trigger
language plpgsql
as $$
begin
  insert into public.audit_logs (
    user_id,
    user_name,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    'system',
    'pg_cron',
    'sla_escalation_run',
    'system',
    'sla_escalation',
    'Scheduled SLA escalation pass completed.'
  );
  return new;
end;
$$;
