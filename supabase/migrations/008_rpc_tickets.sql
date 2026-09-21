-- ============================================================================
-- 008_rpc_tickets.sql
--
-- Ticket lifecycle RPCs. All write to ticket_timeline for the audit trail.
-- Assumes 001–007 have run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: append a timeline entry.
-- ---------------------------------------------------------------------------
create or replace function public.append_ticket_timeline(
  p_ticket_id uuid,
  p_title text,
  p_description text,
  p_actor_name text,
  p_actor_role text,
  p_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ticket_timeline (
    ticket_id, title, description, actor_name, actor_role, type
  )
  values (
    p_ticket_id, p_title, coalesce(p_description, ''), p_actor_name, p_actor_role, p_type
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: create a notification for a user.
-- ---------------------------------------------------------------------------
create or replace function public.notify_user(
  p_user_id uuid,
  p_org_id uuid,
  p_type notification_type,
  p_title text,
  p_message text,
  p_link_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id, organization_id, type, title, message, link_id
  )
  values (p_user_id, p_org_id, p_type, p_title, p_message, p_link_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- assign_ticket — manager assigns a technician.
-- ---------------------------------------------------------------------------
create or replace function public.assign_ticket(
  p_ticket_id uuid,
  p_technician_id uuid,
  p_technician_name text,
  p_actor_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'Ticket not found.' using errcode = '02000';
  end if;

  update public.tickets
     set assigned_to = p_technician_id,
         assigned_to_name = p_technician_name
   where id = p_ticket_id;

  perform public.append_ticket_timeline(
    p_ticket_id,
    'Assigned to technician',
    'Assigned to ' || p_technician_name,
    p_actor_name,
    'manager',
    'assignment'
  );

  perform public.notify_user(
    p_technician_id,
    v_ticket.organization_id,
    'ticket_assigned'::notification_type,
    'New job assigned',
    'You were assigned: ' || v_ticket.title,
    p_ticket_id
  );
end;
$$;

grant execute on function public.assign_ticket(uuid, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_ticket — technician accepts, moves to In Progress.
-- ---------------------------------------------------------------------------
create or replace function public.accept_ticket(
  p_ticket_id uuid,
  p_actor_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'Ticket not found.' using errcode = '02000';
  end if;

  update public.tickets
     set status = 'In Progress'::ticket_status,
         responded_at = coalesce(responded_at, now())
   where id = p_ticket_id;

  perform public.append_ticket_timeline(
    p_ticket_id,
    'Job accepted',
    'Work has started.',
    p_actor_name,
    'maintenance',
    'acceptance'
  );

  if v_ticket.created_by_user_id is not null then
    perform public.notify_user(
      v_ticket.created_by_user_id,
      v_ticket.organization_id,
      'ticket_status'::notification_type,
      'Your ticket is in progress',
      v_ticket.title,
      p_ticket_id
    );
  end if;
end;
$$;

grant execute on function public.accept_ticket(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- resolve_ticket — technician completes work. Writes to finance ledger if
-- cost > 0.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_ticket(
  p_ticket_id uuid,
  p_actor_name text,
  p_repair_notes text,
  p_materials_used text default null,
  p_time_spent_hours numeric default null,
  p_cost numeric default null,
  p_after_images text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'Ticket not found.' using errcode = '02000';
  end if;

  update public.tickets
     set status = 'Resolved'::ticket_status,
         resolved_at = now(),
         repair_notes = p_repair_notes,
         materials_used = p_materials_used,
         time_spent_hours = p_time_spent_hours,
         cost = p_cost,
         after_images = coalesce(p_after_images, '{}')
   where id = p_ticket_id;

  perform public.append_ticket_timeline(
    p_ticket_id,
    'Work completed',
    coalesce(p_repair_notes, 'Repairs completed.'),
    p_actor_name,
    'maintenance',
    'resolution'
  );

  -- Ledger side-effect when there's a cost.
  if p_cost is not null and p_cost > 0 then
    insert into public.finance_transactions (
      organization_id, property_id, shop_id, tenant_id, ticket_id,
      type, category, amount, direction, description, reference,
      date, status, reconciled
    )
    values (
      v_ticket.organization_id,
      v_ticket.shopping_center_id,
      v_ticket.shop_id,
      v_ticket.tenant_id,
      v_ticket.id,
      'Maintenance Expense'::finance_tx_type,
      v_ticket.category::text,
      p_cost,
      'expense'::finance_tx_direction,
      'Ticket ' || v_ticket.ticket_number || ': ' || v_ticket.title,
      v_ticket.ticket_number,
      current_date,
      'Paid'::finance_tx_status,
      false
    );
  end if;

  if v_ticket.created_by_user_id is not null then
    perform public.notify_user(
      v_ticket.created_by_user_id,
      v_ticket.organization_id,
      'ticket_resolved'::notification_type,
      'Your ticket is resolved',
      'Please confirm: ' || v_ticket.title,
      p_ticket_id
    );
  end if;
end;
$$;

grant execute on function public.resolve_ticket(
  uuid, text, text, text, numeric, numeric, text[]
) to authenticated;

-- ---------------------------------------------------------------------------
-- confirm_ticket_resolution — tenant confirms; moves to Closed.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_ticket_resolution(
  p_ticket_id uuid,
  p_actor_name text,
  p_rating int,
  p_feedback text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tickets
     set status = 'Closed'::ticket_status,
         closed_at = now(),
         tenant_confirmed_fixed = true,
         tenant_rating = p_rating,
         tenant_feedback = p_feedback
   where id = p_ticket_id;

  if not found then
    raise exception 'Ticket not found.' using errcode = '02000';
  end if;

  perform public.append_ticket_timeline(
    p_ticket_id,
    'Confirmed fixed',
    case when p_rating is not null
      then 'Tenant rated ' || p_rating::text || '/5.'
      else 'Tenant confirmed.'
    end,
    p_actor_name,
    'tenant',
    'confirmation'
  );
end;
$$;

grant execute on function public.confirm_ticket_resolution(
  uuid, text, int, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- reopen_ticket — tenant rejects the fix; back to Reopened.
-- ---------------------------------------------------------------------------
create or replace function public.reopen_ticket(
  p_ticket_id uuid,
  p_actor_name text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tickets
     set status = 'Reopened'::ticket_status,
         resolved_at = null,
         tenant_confirmed_fixed = false
   where id = p_ticket_id;

  if not found then
    raise exception 'Ticket not found.' using errcode = '02000';
  end if;

  perform public.append_ticket_timeline(
    p_ticket_id,
    'Reopened',
    p_reason,
    p_actor_name,
    'tenant',
    'reopened'
  );
end;
$$;

grant execute on function public.reopen_ticket(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- run_sla_escalation_pass
--
-- Bulk-updates sla_status for open tickets. Returns number of rows changed.
-- Called by pg_cron (org = NULL → all orgs) and by OperationsApp (org = current).
--
-- Logic:
--   - Not-yet-due: Compliant
--   - Within 25% of time left: Warning
--   - Past deadline: Overdue
--   - Past deadline + 1 hour (Emergency) or 24 hours (others): Escalated
-- ---------------------------------------------------------------------------
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
           priority,
           status,
           sla_status,
           extract(epoch from (resolution_deadline - now())) as seconds_left
    from public.tickets
    where (p_org_id is null or organization_id = p_org_id)
      and status not in ('Resolved', 'Closed', 'Cancelled')
      and resolution_deadline is not null
  ),
  computed as (
    select id,
           sla_status as old_status,
           case
             when seconds_left < 0 then
               case
                 when (priority = 'Emergency' and seconds_left < -3600)
                   or (priority <> 'Emergency' and seconds_left < -86400)
                 then 'Escalated'::sla_status
                 else 'Overdue'::sla_status
               end
             when seconds_left < 900
               -- within 15 minutes
               then 'Warning'::sla_status
             else 'Compliant'::sla_status
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
  'Advances sla_status for open tickets. Returns number of rows changed.';

grant execute on function public.run_sla_escalation_pass(uuid) to authenticated;