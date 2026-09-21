-- ============================================================================
-- 001_initial_schema.sql (Part 2 — finance, comms, admin)
--
-- Assumes 002_enums.sql and 001 Part 1 have run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- INVOICE_ITEMS (catalog of reusable billing items)
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_items (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name text not null,
  description text,
  unit_price numeric(12,2) not null default 0,
  tax_rate numeric(5,4) not null default 0.1500,
  default_quantity numeric(10,2) not null default 1,
  category invoice_item_category,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists invoice_items_org_idx on public.invoice_items (organization_id);
create index if not exists invoice_items_active_idx on public.invoice_items (organization_id) where is_active = true;
create unique index if not exists invoice_items_id_org_unique on public.invoice_items (id, organization_id);

-- ---------------------------------------------------------------------------
-- INVOICES
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_number text not null,
  type invoice_type not null default 'Rent',
  tenant_id uuid,
  tenant_name text,
  shop_id uuid,
  shop_number text,
  issue_date date not null,
  due_date date not null,
  status invoice_status not null default 'Draft',
  currency text not null default 'SZL',
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  notes text,
  salesperson_id uuid,
  salesperson_name text,
  source_quote_id uuid,
  source_order_id uuid,
  invoice_period text,  -- 'YYYY-MM'
  created_at timestamptz not null default now(),
  foreign key (tenant_id, organization_id)
    references public.tenants(id, organization_id) on delete set null,
  foreign key (shop_id, organization_id)
    references public.shops(id, organization_id) on delete set null,
  unique (organization_id, invoice_number)
);

create index if not exists invoices_org_idx on public.invoices (organization_id);
create index if not exists invoices_tenant_idx on public.invoices (tenant_id);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_due_date_idx on public.invoices (due_date);
create index if not exists invoices_period_idx on public.invoices (organization_id, invoice_period);
create unique index if not exists invoices_id_org_unique on public.invoices (id, organization_id);

-- Partial unique index: one rent invoice per tenant per period.
create unique index if not exists invoices_unique_rent_period
  on public.invoices (organization_id, tenant_id, invoice_period)
  where type = 'Rent' and tenant_id is not null;

-- ---------------------------------------------------------------------------
-- INVOICE_LINES
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_lines (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_amount numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  line_order int not null default 0
);

create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id);

-- ---------------------------------------------------------------------------
-- PAYMENT_RECORDS
-- ---------------------------------------------------------------------------
create table if not exists public.payment_records (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid,
  tenant_id uuid,
  amount numeric(12,2) not null,
  method payment_method not null default 'EFT',
  reference text,
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id) on delete set null,
  foreign key (tenant_id, organization_id)
    references public.tenants(id, organization_id) on delete set null
);

create index if not exists payment_records_org_idx on public.payment_records (organization_id);
create index if not exists payment_records_invoice_idx on public.payment_records (invoice_id);
create index if not exists payment_records_tenant_idx on public.payment_records (tenant_id, paid_at desc);

-- ---------------------------------------------------------------------------
-- BANK_TRANSACTIONS
-- ---------------------------------------------------------------------------
create table if not exists public.bank_transactions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  description text,
  amount numeric(12,2) not null,
  direction bank_tx_direction not null,
  reconciled boolean not null default false,
  matched_payment_id uuid references public.payment_records(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists bank_transactions_org_idx on public.bank_transactions (organization_id);
create index if not exists bank_transactions_reconciled_idx on public.bank_transactions (organization_id, reconciled);

-- ---------------------------------------------------------------------------
-- FINANCE_TRANSACTIONS
-- ---------------------------------------------------------------------------
create table if not exists public.finance_transactions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid,
  shop_id uuid,
  tenant_id uuid,
  ticket_id uuid,
  type finance_tx_type not null,
  category text,
  amount numeric(12,2) not null,
  direction finance_tx_direction not null,
  description text not null,
  reference text,
  date date not null default current_date,
  status finance_tx_status not null default 'Paid',
  reconciled boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (property_id, organization_id)
    references public.shopping_centers(id, organization_id) on delete set null
);

create index if not exists finance_transactions_org_idx on public.finance_transactions (organization_id);
create index if not exists finance_transactions_direction_idx on public.finance_transactions (organization_id, direction);
create index if not exists finance_transactions_date_idx on public.finance_transactions (date desc);

-- ---------------------------------------------------------------------------
-- FINANCIAL_REQUESTS
-- ---------------------------------------------------------------------------
create table if not exists public.financial_requests (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid,
  requested_by_name text not null,
  type requisition_type not null default 'Petty Cash',
  amount numeric(12,2) not null,
  purpose text not null,
  status requisition_status not null default 'Pending Approval',
  approved_by text,
  created_at timestamptz not null default now(),
  foreign key (property_id, organization_id)
    references public.shopping_centers(id, organization_id) on delete set null
);

create index if not exists financial_requests_org_idx on public.financial_requests (organization_id);
create index if not exists financial_requests_status_idx on public.financial_requests (status);

-- ---------------------------------------------------------------------------
-- ANNOUNCEMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid,
  title text not null,
  message text not null,
  priority announcement_priority not null default 'General',
  target_audience announcement_audience not null default 'All Tenants',
  created_by_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (property_id, organization_id)
    references public.shopping_centers(id, organization_id) on delete set null
);

create index if not exists announcements_org_idx on public.announcements (organization_id);
create index if not exists announcements_active_idx on public.announcements (organization_id, is_active);

-- ---------------------------------------------------------------------------
-- EMERGENCY_BROADCASTS
-- ---------------------------------------------------------------------------
create table if not exists public.emergency_broadcasts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid,
  type emergency_type not null,
  headline text not null,
  instructions text not null,
  issued_at timestamptz not null default now(),
  issued_by text not null,
  is_active boolean not null default true,
  foreign key (property_id, organization_id)
    references public.shopping_centers(id, organization_id) on delete set null
);

create index if not exists emergency_broadcasts_org_idx on public.emergency_broadcasts (organization_id, is_active);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  role user_role,
  organization_id uuid,
  type notification_type not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  link_id uuid,
  link text,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);
create index if not exists notifications_org_idx on public.notifications (organization_id);

-- ---------------------------------------------------------------------------
-- CONVERSATIONS
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,
  participant_ids uuid[] not null default '{}',
  participant_names text[] not null default '{}',
  last_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_org_idx on public.conversations (organization_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- CHAT_MESSAGES
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null,
  sender_name text not null,
  sender_role user_role not null,
  message text not null,
  read boolean not null default false,
  edited boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at asc);

-- ---------------------------------------------------------------------------
-- AUDIT_LOGS
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid,
  user_id uuid,
  user_name text,
  action text not null,
  entity_type text,
  entity_id text,
  details text,
  timestamp timestamptz not null default now()
);

create index if not exists audit_logs_org_idx on public.audit_logs (organization_id, timestamp desc);
create index if not exists audit_logs_user_idx on public.audit_logs (user_id, timestamp desc);

-- ---------------------------------------------------------------------------
-- VENDORS
-- ---------------------------------------------------------------------------
create table if not exists public.vendors (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null,
  service_category text not null,
  contact_person text not null,
  phone text not null,
  email text not null,
  contract_expiry date,
  performance_rating numeric(3,2) not null default 0,
  status vendor_status not null default 'Active',
  created_at timestamptz not null default now()
);

create index if not exists vendors_org_idx on public.vendors (organization_id);

-- ---------------------------------------------------------------------------
-- STAFF_SHIFTS
-- ---------------------------------------------------------------------------
create table if not exists public.staff_shifts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid,
  staff_id uuid,
  staff_name text not null,
  staff_role staff_role not null,
  date date not null,
  shift_type staff_shift_type not null,
  status staff_shift_status not null default 'Scheduled',
  notes text,
  created_at timestamptz not null default now(),
  foreign key (property_id, organization_id)
    references public.shopping_centers(id, organization_id) on delete set null
);

create index if not exists staff_shifts_org_idx on public.staff_shifts (organization_id, date);
create index if not exists staff_shifts_date_idx on public.staff_shifts (date);

-- ---------------------------------------------------------------------------
-- PREVENTIVE_MAINTENANCE
-- ---------------------------------------------------------------------------
create table if not exists public.preventive_maintenance (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shopping_center_id uuid,
  title text not null,
  category ticket_category not null default 'Other',
  frequency_days int not null default 90,
  next_due_at timestamptz not null,
  last_completed_at timestamptz,
  status pm_status not null default 'Scheduled',
  notes text,
  created_at timestamptz not null default now(),
  foreign key (shopping_center_id, organization_id)
    references public.shopping_centers(id, organization_id) on delete set null
);

create index if not exists preventive_maintenance_org_idx on public.preventive_maintenance (organization_id, next_due_at);

-- ---------------------------------------------------------------------------
-- QUOTES
-- ---------------------------------------------------------------------------
create table if not exists public.quotes (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_number text not null,
  type quote_type not null default 'Other',
  tenant_id uuid,
  prospect_name text,
  prospect_email text,
  prospect_phone text,
  prospect_company text,
  shop_id uuid,
  issue_date date not null,
  valid_until date,
  status quote_status not null default 'Draft',
  currency text not null default 'SZL',
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  terms text,
  salesperson_id uuid,
  salesperson_name text,
  converted_invoice_id uuid,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, quote_number),
  foreign key (tenant_id, organization_id)
    references public.tenants(id, organization_id) on delete set null,
  foreign key (shop_id, organization_id)
    references public.shops(id, organization_id) on delete set null
);

create index if not exists quotes_org_idx on public.quotes (organization_id);

-- ---------------------------------------------------------------------------
-- QUOTE_LINES
-- ---------------------------------------------------------------------------
create table if not exists public.quote_lines (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  item_id uuid,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_amount numeric(12,2) not null default 0,
  tax_rate numeric(5,4) not null default 0.1500,
  amount numeric(12,2) not null default 0,
  line_order int not null default 0
);

create index if not exists quote_lines_quote_idx on public.quote_lines (quote_id);

-- ---------------------------------------------------------------------------
-- SALES_ORDERS
-- ---------------------------------------------------------------------------
create table if not exists public.sales_orders (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_number text not null,
  tenant_id uuid,
  shop_id uuid,
  order_date date not null,
  due_date date,
  status order_status not null default 'Draft',
  currency text not null default 'SZL',
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  salesperson_id uuid,
  salesperson_name text,
  converted_invoice_id uuid,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, order_number),
  foreign key (tenant_id, organization_id)
    references public.tenants(id, organization_id) on delete set null,
  foreign key (shop_id, organization_id)
    references public.shops(id, organization_id) on delete set null
);

create index if not exists sales_orders_org_idx on public.sales_orders (organization_id);

-- ---------------------------------------------------------------------------
-- SALES_ORDER_LINES
-- ---------------------------------------------------------------------------
create table if not exists public.sales_order_lines (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  item_id uuid,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_amount numeric(12,2) not null default 0,
  tax_rate numeric(5,4) not null default 0.1500,
  amount numeric(12,2) not null default 0,
  line_order int not null default 0
);

create index if not exists sales_order_lines_order_idx on public.sales_order_lines (order_id);

-- ---------------------------------------------------------------------------
-- STATEMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.statements (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id uuid not null,
  period_start date not null,
  period_end date not null,
  opening_balance numeric(12,2) not null default 0,
  closing_balance numeric(12,2) not null default 0,
  total_invoiced numeric(12,2) not null default 0,
  total_paid numeric(12,2) not null default 0,
  generated_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_to text,
  foreign key (tenant_id, organization_id)
    references public.tenants(id, organization_id) on delete cascade
);

create index if not exists statements_org_idx on public.statements (organization_id, generated_at desc);
create index if not exists statements_tenant_idx on public.statements (tenant_id);

-- ---------------------------------------------------------------------------
-- PAYMENT_REMINDERS
-- ---------------------------------------------------------------------------
create table if not exists public.payment_reminders (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  reminder_type reminder_type not null,
  sent_at timestamptz not null default now(),
  sent_to text,
  channel reminder_channel not null default 'email',
  notes text
);

create index if not exists payment_reminders_invoice_idx on public.payment_reminders (invoice_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- SUBSCRIPTION_TIERS (configurable from SuperAdminPortal)
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_tiers (
  id uuid primary key default uuid_generate_v4(),
  tier_key text not null unique,
  name text not null,
  price_label text not null,
  property_limit int not null default 2,
  tenant_limit int not null default 50,
  user_limit int not null default 10,
  storage_limit_gb int not null default 5,
  features text[] not null default '{}',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed the three default tiers.
insert into public.subscription_tiers (tier_key, name, price_label, property_limit, tenant_limit, user_limit, storage_limit_gb, features, sort_order)
values
  ('Starter', 'Starter', 'E1,450 / mo', 2, 50, 10, 5,
   array['Up to 2 centres','50 tenants','10 staff users','Basic SLA matrix'], 1),
  ('Professional', 'Professional', 'E3,850 / mo', 10, 250, 40, 25,
   array['10 centres','250 tenants','40 staff users','Commercial engine','Priority support'], 2),
  ('Enterprise', 'Enterprise', 'E8,900 / mo', 999, 9999, 500, 200,
   array['Unlimited centres','Dedicated support','Custom branding','Audit exports'], 3)
on conflict (tier_key) do nothing;