-- ============================================================================
-- 007_rpc_operations.sql
--
-- Operational RPCs: tenants, leases, announcements, requisitions, PM, chat.
-- Assumes 001–006 have run.
-- Idempotent: create or replace.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- add_tenant
--
-- Creates a tenant, flips the shop to Occupied, and returns the tenant row.
-- Also creates a stub lease? No — leases are a separate RPC.
-- ---------------------------------------------------------------------------
create or replace function public.add_tenant(
  p_organization_id uuid,
  p_property_id uuid,
  p_shopping_center_id uuid,
  p_shop_id uuid,
  p_business_name text,
  p_contact_person text,
  p_phone text,
  p_email text,
  p_trade_type text,
  p_move_in_date date,
  p_status tenant_status,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant public.tenants%rowtype;
begin
  insert into public.tenants (
    organization_id, property_id, shopping_center_id, shop_id,
    business_name, contact_person, phone, email, trade_type,
    move_in_date, status, user_id
  )
  values (
    p_organization_id, p_property_id, p_shopping_center_id, p_shop_id,
    p_business_name, p_contact_person, p_phone, p_email, p_trade_type,
    coalesce(p_move_in_date, current_date),
    coalesce(p_status, 'Active'::tenant_status),
    p_user_id
  )
  returning * into v_tenant;

  update public.shops
     set status = 'Occupied'::unit_status
   where id = p_shop_id
     and status <> 'Occupied'::unit_status;

  return to_jsonb(v_tenant);
end;
$$;

grant execute on function public.add_tenant(
  uuid, uuid, uuid, uuid, text, text, text, text, text, date, tenant_status, uuid
) to authenticated;

-- ---------------------------------------------------------------------------
-- add_lease
-- ---------------------------------------------------------------------------
create or replace function public.add_lease(
  p_organization_id uuid,
  p_tenant_id uuid,
  p_shop_id uuid,
  p_start_date date,
  p_end_date date,
  p_rental_amount numeric,
  p_deposit numeric,
  p_document_title text,
  p_document_url text,
  p_renewal_status lease_renewal_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.leases%rowtype;
begin
  insert into public.leases (
    organization_id, tenant_id, shop_id, start_date, end_date,
    rental_amount, deposit, document_title, document_url,
    renewal_status, is_digitally_signed
  )
  values (
    p_organization_id, p_tenant_id, p_shop_id, p_start_date, p_end_date,
    p_rental_amount, p_deposit, p_document_title, p_document_url,
    coalesce(p_renewal_status, 'Active'::lease_renewal_status),
    false
  )
  returning * into v_lease;

  return to_jsonb(v_lease);
end;
$$;

grant execute on function public.add_lease(
  uuid, uuid, uuid, date, date, numeric, numeric, text, text, lease_renewal_status
) to authenticated;

-- ---------------------------------------------------------------------------
-- sign_lease
-- ---------------------------------------------------------------------------
create or replace function public.sign_lease(
  p_lease_id uuid,
  p_signer_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.leases%rowtype;
begin
  update public.leases
     set is_digitally_signed = true,
         signed_at = now(),
         signer_name = p_signer_name
   where id = p_lease_id
   returning * into v_lease;

  if not found then
    raise exception 'Lease not found.' using errcode = '02000';
  end if;

  return to_jsonb(v_lease);
end;
$$;

grant execute on function public.sign_lease(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_tenant
--
-- Frees the shop, deletes the tenant. Cascades remove their leases,
-- invoices, statements via FK ON DELETE CASCADE.
-- ---------------------------------------------------------------------------
create or replace function public.delete_tenant(
  p_tenant_id uuid,
  p_actor_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  select shop_id into v_shop_id from public.tenants where id = p_tenant_id;

  if v_shop_id is not null then
    update public.shops
       set status = 'Available'::unit_status
     where id = v_shop_id;
  end if;

  delete from public.tenants where id = p_tenant_id;
end;
$$;

grant execute on function public.delete_tenant(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- post_announcement
-- ---------------------------------------------------------------------------
create or replace function public.post_announcement(
  p_organization_id uuid,
  p_property_id uuid,
  p_title text,
  p_message text,
  p_priority announcement_priority,
  p_target_audience announcement_audience
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author text;
  v_ann public.announcements%rowtype;
begin
  select name into v_author from public.profiles where id = auth.uid() limit 1;
  v_author := coalesce(v_author, 'System');

  insert into public.announcements (
    organization_id, property_id, title, message,
    priority, target_audience, created_by_name, is_active
  )
  values (
    p_organization_id, p_property_id, p_title, p_message,
    coalesce(p_priority, 'General'::announcement_priority),
    coalesce(p_target_audience, 'All Tenants'::announcement_audience),
    v_author, true
  )
  returning * into v_ann;

  return to_jsonb(v_ann);
end;
$$;

grant execute on function public.post_announcement(
  uuid, uuid, text, text, announcement_priority, announcement_audience
) to authenticated;

-- ---------------------------------------------------------------------------
-- broadcast_emergency
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_emergency(
  p_organization_id uuid,
  p_property_id uuid,
  p_type emergency_type,
  p_headline text,
  p_instructions text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author text;
  v_bc public.emergency_broadcasts%rowtype;
begin
  select name into v_author from public.profiles where id = auth.uid() limit 1;
  v_author := coalesce(v_author, 'System');

  insert into public.emergency_broadcasts (
    organization_id, property_id, type, headline, instructions,
    issued_by, is_active
  )
  values (
    p_organization_id, p_property_id, p_type, p_headline, p_instructions,
    v_author, true
  )
  returning * into v_bc;

  return to_jsonb(v_bc);
end;
$$;

grant execute on function public.broadcast_emergency(
  uuid, uuid, emergency_type, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- approve_requisition
-- ---------------------------------------------------------------------------
create or replace function public.approve_requisition(
  p_request_id uuid,
  p_approver_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.financial_requests%rowtype;
begin
  update public.financial_requests
     set status = 'Approved'::requisition_status,
         approved_by = p_approver_name
   where id = p_request_id
     and status = 'Pending Approval'::requisition_status
   returning * into v_row;

  if not found then
    raise exception 'Requisition not found or not pending approval.'
      using errcode = '02000';
  end if;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.approve_requisition(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- disburse_requisition
--
-- Marks the request disbursed AND writes an expense row to the ledger.
-- ---------------------------------------------------------------------------
create or replace function public.disburse_requisition(
  p_request_id uuid,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.financial_requests%rowtype;
begin
  update public.financial_requests
     set status = 'Disbursed'::requisition_status
   where id = p_request_id
     and status = 'Approved'::requisition_status
   returning * into v_row;

  if not found then
    raise exception 'Requisition not found or not approved.'
      using errcode = '02000';
  end if;

  insert into public.finance_transactions (
    organization_id, property_id, type, category, amount, direction,
    description, reference, date, status, reconciled
  )
  values (
    v_row.organization_id,
    v_row.property_id,
    case v_row.type
      when 'Vendor Payment' then 'Vendor Payout'::finance_tx_type
      when 'Maintenance Funding' then 'Maintenance Expense'::finance_tx_type
      else 'Maintenance Expense'::finance_tx_type
    end,
    v_row.type::text,
    v_row.amount,
    'expense'::finance_tx_direction,
    'Disbursed: ' || v_row.purpose,
    'REQ-' || substring(v_row.id::text, 1, 8),
    current_date,
    'Paid'::finance_tx_status,
    false
  );

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.disburse_requisition(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- complete_pm_task
--
-- Marks complete, schedules next occurrence by frequency_days.
-- ---------------------------------------------------------------------------
create or replace function public.complete_pm_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.preventive_maintenance%rowtype;
begin
  update public.preventive_maintenance
     set last_completed_at = now(),
         next_due_at = now() + (frequency_days || ' days')::interval,
         status = 'Scheduled'::pm_status
   where id = p_task_id
   returning * into v_task;

  if not found then
    raise exception 'PM task not found.' using errcode = '02000';
  end if;

  return to_jsonb(v_task);
end;
$$;

grant execute on function public.complete_pm_task(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- send_chat_message
--
-- Inserts the message and bumps conversation.updated_at + last_message.
-- ---------------------------------------------------------------------------
create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_name text;
  v_sender_role user_role;
  v_msg public.chat_messages%rowtype;
begin
  select name, role into v_sender_name, v_sender_role
    from public.profiles where id = auth.uid() limit 1;

  if v_sender_name is null then
    raise exception 'Caller has no profile.' using errcode = '02000';
  end if;

  insert into public.chat_messages (
    conversation_id, sender_id, sender_name, sender_role, message
  )
  values (
    p_conversation_id, auth.uid(), v_sender_name, v_sender_role, p_message
  )
  returning * into v_msg;

  update public.conversations
     set last_message = p_message,
         updated_at = now()
   where id = p_conversation_id;

  return to_jsonb(v_msg);
end;
$$;

grant execute on function public.send_chat_message(uuid, text) to authenticated;