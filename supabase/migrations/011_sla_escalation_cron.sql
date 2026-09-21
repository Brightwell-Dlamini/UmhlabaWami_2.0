-- ============================================================================
-- 011_sla_escalation_cron.sql
--
-- Schedules the SLA escalation pass to run every 5 minutes, for all orgs.
-- Assumes 008 (which defined run_sla_escalation_pass) has run.
-- ============================================================================

-- 1) Ensure pg_cron is available.
create extension if not exists pg_cron with schema extensions;

-- 2) Unschedule any prior instance of this job (idempotent re-run).
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
    from cron.job
   where jobname = 'umhlaba_wami_sla_escalation';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
    raise notice 'Unscheduled existing job %', v_job_id;
  end if;
end
$$;

-- 3) Schedule the job.
select cron.schedule(
  'umhlaba_wami_sla_escalation',
  '*/5 * * * *',
  $$select public.run_sla_escalation_pass(null);$$
);

-- 4) Confirm.
do $$
declare
  v_jobname text;
  v_schedule text;
begin
  select jobname, schedule into v_jobname, v_schedule
    from cron.job
   where jobname = 'umhlaba_wami_sla_escalation';

  if v_jobname is null then
    raise exception 'Cron job was not scheduled.';
  end if;

  raise notice 'Scheduled: % → %', v_jobname, v_schedule;
end
$$;