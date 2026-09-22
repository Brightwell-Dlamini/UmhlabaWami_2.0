-- ============================================================================
-- 015_ticket_status_guards.sql
--
-- Harden ticket lifecycle RPCs so status transitions are idempotent and
-- invalid actions raise a clear error (no duplicate timeline entries).
-- Safe to re-run: uses CREATE OR REPLACE.
-- ============================================================================

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

  if v_ticket.status not in ('Open', 'In Progress', 'Reopened') then
    raise exception
      'Cannot assign a ticket that is "%". Reopen it first if needed.',
      v_ticket.status
      using errcode = '22023';
  end if;

  update public.tickets
     set assigned_to = p_technician_id,
         assigned_to_name = p_technician_name
   where id = p_ticket_id;

  perform public.append_ticket_timeline(
    p_ticket_id,
    'Assigned to technician',
    'Assigned to ' || coalesce(p_technician_name, 'technician'),
    p_actor_name,
    'manager',
    'assignment'
  );
end;
$$;

grant execute on function public.assign_ticket(uuid, uuid, text, text) to authenticated;

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

  if v_ticket.status not in ('Open', 'Reopened') then
    raise exception
      'Cannot accept a ticket that is "%". Only Open or Reopened tickets can be accepted.',
      v_ticket.status
      using errcode = '22023';
  end if;

  update public.tickets
     set status = 'In Progress'::ticket_status
   where id = p_ticket_id;

  perform public.append_ticket_timeline(
    p_ticket_id,
    'Job accepted',
    'Work has started.',
    p_actor_name,
    'maintenance',
    'acceptance'
  );
end;
$$;

grant execute on function public.accept_ticket(uuid, text) to authenticated;

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

  if v_ticket.status in ('Resolved', 'Closed') then
    raise exception
      'Ticket is already "%". Cannot mark as completed again.',
      v_ticket.status
      using errcode = '22023';
  end if;

  if v_ticket.status not in ('Open', 'In Progress', 'Reopened') then
    raise exception
      'Cannot mark as completed a ticket that is "%".',
      v_ticket.status
      using errcode = '22023';
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
declare
  v_ticket public.tickets%rowtype;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'Ticket not found.' using errcode = '02000';
  end if;

  if v_ticket.status <> 'Resolved' then
    raise exception
      'Cannot confirm a ticket that is "%". Only Resolved tickets can be confirmed.',
      v_ticket.status
      using errcode = '22023';
  end if;

  update public.tickets
     set status = 'Closed'::ticket_status,
         closed_at = now(),
         tenant_confirmed_fixed = true,
         tenant_rating = p_rating,
         tenant_feedback = p_feedback
   where id = p_ticket_id;

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
declare
  v_ticket public.tickets%rowtype;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'Ticket not found.' using errcode = '02000';
  end if;

  if v_ticket.status not in ('Resolved', 'Closed') then
    raise exception
      'Cannot reopen a ticket that is "%". Only Resolved or Closed tickets can be reopened.',
      v_ticket.status
      using errcode = '22023';
  end if;

  update public.tickets
     set status = 'Reopened'::ticket_status,
         resolved_at = null,
         tenant_confirmed_fixed = false
   where id = p_ticket_id;

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
