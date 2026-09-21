-- ============================================================================
-- 003_rls_policies.sql (Part 2 — finance, comms, admin)
-- Assumes helpers + Part 1 have run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- INVOICE_ITEMS
-- ---------------------------------------------------------------------------
alter table public.invoice_items enable row level security;

drop policy if exists invoice_items_select on public.invoice_items;
create policy invoice_items_select on public.invoice_items
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists invoice_items_write on public.invoice_items;
create policy invoice_items_write on public.invoice_items
  for all using (
    organization_id = public.current_org_id() or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- INVOICES
-- Tenants see their own invoices; staff see all in org.
-- ---------------------------------------------------------------------------
alter table public.invoices enable row level security;

drop policy if exists invoices_select_tenant on public.invoices;
create policy invoices_select_tenant on public.invoices
  for select using (
    public.current_user_role() = 'tenant'
    and (
      exists (
        select 1 from public.tenants t
        where t.user_id = auth.uid() and t.id = invoices.tenant_id
      )
    )
  );

drop policy if exists invoices_select_org on public.invoices;
create policy invoices_select_org on public.invoices
  for select using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','finance','admin')
  );

drop policy if exists invoices_select_super on public.invoices;
create policy invoices_select_super on public.invoices
  for select using (public.is_super_admin());

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','finance','admin')
  );

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
  for update using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices
  for delete using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('admin', 'finance')
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- INVOICE_LINES
-- ---------------------------------------------------------------------------
alter table public.invoice_lines enable row level security;

drop policy if exists invoice_lines_select on public.invoice_lines;
create policy invoice_lines_select on public.invoice_lines
  for select using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_lines.invoice_id
    )
  );

drop policy if exists invoice_lines_write on public.invoice_lines;
create policy invoice_lines_write on public.invoice_lines
  for all using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_lines.invoice_id
        and (i.organization_id = public.current_org_id() or public.is_super_admin())
    )
  ) with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_lines.invoice_id
        and (i.organization_id = public.current_org_id() or public.is_super_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- PAYMENT_RECORDS
-- ---------------------------------------------------------------------------
alter table public.payment_records enable row level security;

drop policy if exists payment_records_select_tenant on public.payment_records;
create policy payment_records_select_tenant on public.payment_records
  for select using (
    public.current_user_role() = 'tenant'
    and exists (
      select 1 from public.tenants t
      where t.user_id = auth.uid() and t.id = payment_records.tenant_id
    )
  );

drop policy if exists payment_records_select_org on public.payment_records;
create policy payment_records_select_org on public.payment_records
  for select using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','finance','admin')
  );

drop policy if exists payment_records_insert on public.payment_records;
create policy payment_records_insert on public.payment_records
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','finance','admin')
  );

-- ---------------------------------------------------------------------------
-- BANK_TRANSACTIONS
-- ---------------------------------------------------------------------------
alter table public.bank_transactions enable row level security;

drop policy if exists bank_tx_select on public.bank_transactions;
create policy bank_tx_select on public.bank_transactions
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists bank_tx_write on public.bank_transactions;
create policy bank_tx_write on public.bank_transactions
  for all using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','finance','admin')
    or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','finance','admin')
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- FINANCE_TRANSACTIONS
-- ---------------------------------------------------------------------------
alter table public.finance_transactions enable row level security;

drop policy if exists finance_tx_select on public.finance_transactions;
create policy finance_tx_select on public.finance_transactions
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists finance_tx_write on public.finance_transactions;
create policy finance_tx_write on public.finance_transactions
  for all using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','finance','admin','maintenance')
    or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','finance','admin','maintenance')
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- FINANCIAL_REQUESTS
-- ---------------------------------------------------------------------------
alter table public.financial_requests enable row level security;

drop policy if exists financial_requests_select on public.financial_requests;
create policy financial_requests_select on public.financial_requests
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists financial_requests_write on public.financial_requests;
create policy financial_requests_write on public.financial_requests
  for all using (
    organization_id = public.current_org_id() or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- ANNOUNCEMENTS — tenants see active announcements in their org.
-- ---------------------------------------------------------------------------
alter table public.announcements enable row level security;

drop policy if exists announcements_select_tenant on public.announcements;
create policy announcements_select_tenant on public.announcements
  for select using (
    public.current_user_role() = 'tenant'
    and is_active = true
    and organization_id = public.current_org_id()
  );

drop policy if exists announcements_select_org on public.announcements;
create policy announcements_select_org on public.announcements
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements
  for all using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin')
    or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin')
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- EMERGENCY_BROADCASTS — every org member sees active ones.
-- ---------------------------------------------------------------------------
alter table public.emergency_broadcasts enable row level security;

drop policy if exists emergency_broadcasts_select on public.emergency_broadcasts;
create policy emergency_broadcasts_select on public.emergency_broadcasts
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists emergency_broadcasts_write on public.emergency_broadcasts;
create policy emergency_broadcasts_write on public.emergency_broadcasts
  for all using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin')
    or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin')
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS — user sees only their own.
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_insert_any on public.notifications;
-- RPCs use security definer to insert for other users.
create policy notifications_insert_any on public.notifications
  for insert with check (true);

-- ---------------------------------------------------------------------------
-- CONVERSATIONS
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (
    organization_id = public.current_org_id()
    and auth.uid() = any(participant_ids)
    or public.is_super_admin()
  );

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert with check (
    organization_id = public.current_org_id()
    and auth.uid() = any(participant_ids)
  );

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update using (
    organization_id = public.current_org_id()
    and auth.uid() = any(participant_ids)
  );

-- ---------------------------------------------------------------------------
-- CHAT_MESSAGES
-- ---------------------------------------------------------------------------
alter table public.chat_messages enable row level security;

drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and (c.organization_id = public.current_org_id())
        and auth.uid() = any(c.participant_ids)
    )
  );

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and auth.uid() = any(c.participant_ids)
    )
  );

-- ---------------------------------------------------------------------------
-- AUDIT_LOGS — read-only for org admins, insert allowed for RPCs.
-- ---------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select using (
    organization_id = public.current_org_id() and public.current_user_role() = 'admin'
    or public.is_super_admin()
  );

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert with check (true);

-- ---------------------------------------------------------------------------
-- VENDORS
-- ---------------------------------------------------------------------------
alter table public.vendors enable row level security;

drop policy if exists vendors_select on public.vendors;
create policy vendors_select on public.vendors
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists vendors_write on public.vendors;
create policy vendors_write on public.vendors
  for all using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin')
    or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin')
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- STAFF_SHIFTS
-- ---------------------------------------------------------------------------
alter table public.staff_shifts enable row level security;

drop policy if exists staff_shifts_select on public.staff_shifts;
create policy staff_shifts_select on public.staff_shifts
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists staff_shifts_write on public.staff_shifts;
create policy staff_shifts_write on public.staff_shifts
  for all using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin')
    or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin')
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- PREVENTIVE_MAINTENANCE
-- ---------------------------------------------------------------------------
alter table public.preventive_maintenance enable row level security;

drop policy if exists pm_select on public.preventive_maintenance;
create policy pm_select on public.preventive_maintenance
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists pm_write on public.preventive_maintenance;
create policy pm_write on public.preventive_maintenance
  for all using (
    organization_id = public.current_org_id() or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- QUOTES
-- ---------------------------------------------------------------------------
alter table public.quotes enable row level security;

drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists quotes_write on public.quotes;
create policy quotes_write on public.quotes
  for all using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin','finance')
    or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin','finance')
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- QUOTE_LINES
-- ---------------------------------------------------------------------------
alter table public.quote_lines enable row level security;

drop policy if exists quote_lines_select on public.quote_lines;
create policy quote_lines_select on public.quote_lines
  for select using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_lines.quote_id
        and (q.organization_id = public.current_org_id() or public.is_super_admin())
    )
  );

drop policy if exists quote_lines_write on public.quote_lines;
create policy quote_lines_write on public.quote_lines
  for all using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_lines.quote_id
        and (q.organization_id = public.current_org_id() or public.is_super_admin())
    )
  ) with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_lines.quote_id
        and (q.organization_id = public.current_org_id() or public.is_super_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- SALES_ORDERS
-- ---------------------------------------------------------------------------
alter table public.sales_orders enable row level security;

drop policy if exists sales_orders_select on public.sales_orders;
create policy sales_orders_select on public.sales_orders
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists sales_orders_write on public.sales_orders;
create policy sales_orders_write on public.sales_orders
  for all using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin','finance')
    or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin','finance')
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- SALES_ORDER_LINES
-- ---------------------------------------------------------------------------
alter table public.sales_order_lines enable row level security;

drop policy if exists sales_order_lines_select on public.sales_order_lines;
create policy sales_order_lines_select on public.sales_order_lines
  for select using (
    exists (
      select 1 from public.sales_orders o
      where o.id = sales_order_lines.order_id
        and (o.organization_id = public.current_org_id() or public.is_super_admin())
    )
  );

drop policy if exists sales_order_lines_write on public.sales_order_lines;
create policy sales_order_lines_write on public.sales_order_lines
  for all using (
    exists (
      select 1 from public.sales_orders o
      where o.id = sales_order_lines.order_id
        and (o.organization_id = public.current_org_id() or public.is_super_admin())
    )
  ) with check (
    exists (
      select 1 from public.sales_orders o
      where o.id = sales_order_lines.order_id
        and (o.organization_id = public.current_org_id() or public.is_super_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- STATEMENTS
-- ---------------------------------------------------------------------------
alter table public.statements enable row level security;

drop policy if exists statements_select on public.statements;
create policy statements_select on public.statements
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists statements_write on public.statements;
create policy statements_write on public.statements
  for all using (
    organization_id = public.current_org_id() or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- PAYMENT_REMINDERS
-- ---------------------------------------------------------------------------
alter table public.payment_reminders enable row level security;

drop policy if exists payment_reminders_select on public.payment_reminders;
create policy payment_reminders_select on public.payment_reminders
  for select using (
    organization_id = public.current_org_id() or public.is_super_admin()
  );

drop policy if exists payment_reminders_write on public.payment_reminders;
create policy payment_reminders_write on public.payment_reminders
  for all using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin','finance')
    or public.is_super_admin()
  ) with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('property_manager','admin','finance')
    or public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- SUBSCRIPTION_TIERS — everyone can read, only super admin writes.
-- ---------------------------------------------------------------------------
alter table public.subscription_tiers enable row level security;

drop policy if exists subscription_tiers_select on public.subscription_tiers;
create policy subscription_tiers_select on public.subscription_tiers
  for select using (true);

drop policy if exists subscription_tiers_write on public.subscription_tiers;
create policy subscription_tiers_write on public.subscription_tiers
  for all using (public.is_super_admin())
  with check (public.is_super_admin());