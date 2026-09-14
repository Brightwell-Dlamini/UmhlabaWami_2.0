-- =========================================================
-- Row Level Security — organisation isolation
-- =========================================================

-- Helper: current user's organisation
create or replace function public.current_org_id()
returns uuid language sql stable security definer as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role()
returns user_role language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

-- Enable RLS on all tables
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table shopping_centers enable row level security;
alter table properties enable row level security;
alter table shops enable row level security;
alter table tenants enable row level security;
alter table leases enable row level security;
alter table sla_matrix enable row level security;
alter table tickets enable row level security;
alter table ticket_timeline enable row level security;
alter table ticket_attachments enable row level security;
alter table ticket_comments enable row level security;
alter table staff_shifts enable row level security;
alter table vendors enable row level security;
alter table finance_transactions enable row level security;
alter table financial_requests enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table payment_records enable row level security;
alter table bank_transactions enable row level security;
alter table announcements enable row level security;
alter table emergency_broadcasts enable row level security;
alter table notifications enable row level security;
alter table conversations enable row level security;
alter table chat_messages enable row level security;
alter table audit_logs enable row level security;
alter table property_leads enable row level security;

-- ---------- ORGANIZATIONS ----------
create policy "org_select_own" on organizations for select using (
  id = current_org_id() or is_super_admin()
);
create policy "org_update_own_admin" on organizations for update using (
  id = current_org_id() and current_role() in ('admin','super_admin')
) or is_super_admin();
create policy "org_insert_public" on organizations for insert with check (true);
create policy "org_super_delete" on organizations for delete using (is_super_admin());

-- ---------- PROFILES ----------
create policy "profiles_select_same_org" on profiles for select using (
  organization_id = current_org_id() or id = auth.uid() or is_super_admin()
);
create policy "profiles_update_self" on profiles for update using (id = auth.uid()) or is_super_admin();
create policy "profiles_insert_self" on profiles for insert with check (id = auth.uid() or is_super_admin());
create policy "profiles_delete_admin" on profiles for delete using (is_super_admin());

-- ---------- Generic org-scoped table policy (repeat pattern) ----------
-- For each table with organization_id, we apply:
--   SELECT: same org OR super admin
--   INSERT/UPDATE/DELETE: same org (role checks can be layered later)

create policy "centers_org" on shopping_centers for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "properties_org" on properties for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "shops_org_read" on shops for select using (
  organization_id = current_org_id() or public_listing = true or is_super_admin()
);
create policy "shops_org_write" on shops for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "tenants_org" on tenants for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "leases_org" on leases for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "sla_org" on sla_matrix for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "tickets_org" on tickets for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "timeline_org" on ticket_timeline for all using (
  ticket_id in (select id from tickets where organization_id = current_org_id()) or is_super_admin()
);

create policy "attachments_org" on ticket_attachments for all using (
  ticket_id in (select id from tickets where organization_id = current_org_id()) or is_super_admin()
);

create policy "comments_org" on ticket_comments for all using (
  ticket_id in (select id from tickets where organization_id = current_org_id()) or is_super_admin()
);

create policy "shifts_org" on staff_shifts for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "vendors_org" on vendors for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "finance_org" on finance_transactions for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "fin_req_org" on financial_requests for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "invoices_org" on invoices for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "invoice_lines_org" on invoice_lines for all using (
  invoice_id in (select id from invoices where organization_id = current_org_id()) or is_super_admin()
);

create policy "payments_org" on payment_records for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "bank_org" on bank_transactions for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "announcements_org" on announcements for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "broadcasts_org" on emergency_broadcasts for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "notifications_own" on notifications for all using (
  user_id = auth.uid() or is_super_admin()
) with check (user_id = auth.uid() or is_super_admin());

create policy "conversations_org" on conversations for all using (
  organization_id = current_org_id() or is_super_admin()
) with check (organization_id = current_org_id() or is_super_admin());

create policy "chat_org" on chat_messages for all using (
  conversation_id in (select id from conversations where organization_id = current_org_id()) or is_super_admin()
);

create policy "audit_read" on audit_logs for select using (
  organization_id = current_org_id() or is_super_admin()
);
create policy "audit_insert" on audit_logs for insert with check (true);

create policy "leads_public_insert" on property_leads for insert with check (true);
create policy "leads_super_read" on property_leads for select using (is_super_admin());
