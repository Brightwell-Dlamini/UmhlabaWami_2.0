-- =========================================================
-- Umhlaba Wami — Initial Schema
-- All tables scoped to organisation_id with RLS.
-- =========================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
create type user_role as enum ('tenant','property_manager','maintenance','finance','admin','super_admin');
create type unit_status as enum ('Available','Occupied','Reserved','Under Maintenance');
create type ticket_priority as enum ('Low','Medium','High','Emergency');
create type ticket_status as enum ('Open','In Progress','Awaiting Approval','Resolved','Closed','Reopened','Cancelled');
create type ticket_category as enum (
  'Plumbing','Electrical','Air Conditioning','Cleaning','Security','Parking',
  'Noise Complaint','Structural Damage','Water Leak','Signage','Internet / Network','Other'
);
create type subscription_tier as enum ('Starter','Professional','Enterprise');
create type org_status as enum ('Pending Approval','Active','Suspended','Rejected');
create type sla_status as enum ('Compliant','Warning','Overdue','Escalated');
create type invoice_status as enum ('Draft','Sent','Partially Paid','Paid','Overdue','Cancelled');
create type invoice_type as enum ('Rent','Service Charge','Deposit','Other');

-- ---------- ORGANIZATIONS ----------
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  organization_code text unique not null,
  company_name text not null,
  owner_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  subscription_tier subscription_tier not null default 'Starter',
  status org_status not null default 'Pending Approval',
  property_limit int not null default 3,
  tenant_limit int not null default 100,
  user_limit int not null default 10,
  storage_limit int not null default 10,
  monthly_fee_estimate numeric(12,2),
  logo_url text,
  custom_branding_color text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid
);

-- ---------- PROFILES (extends auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  username text not null,
  name text not null,
  email text not null,
  phone text,
  role user_role not null default 'tenant',
  property_id uuid,
  shopping_center_id uuid,
  shop_id uuid,
  status text not null default 'Active',
  avatar_url text,
  created_at timestamptz not null default now(),
  unique (organization_id, username)
);

-- Auto-create profile on auth signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, username, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'tenant')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- SHOPPING CENTERS ----------
create table shopping_centers (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  address text not null,
  location text not null,
  description text,
  image text,
  status text not null default 'Active',
  operating_hours text,
  parking_bays int default 0,
  amenities text[] default '{}',
  created_at timestamptz not null default now()
);

-- ---------- PROPERTIES ----------
create table properties (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  shopping_center_id uuid references shopping_centers(id) on delete cascade,
  name text not null,
  type text not null,
  address text not null,
  description text,
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

-- ---------- SHOPS ----------
create table shops (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  shopping_center_id uuid not null references shopping_centers(id) on delete cascade,
  shop_number text not null,
  floor text,
  size_sqm numeric(10,2),
  rental_amount numeric(12,2) not null,
  deposit_amount numeric(12,2),
  status unit_status not null default 'Available',
  public_listing boolean not null default false,
  public_featured boolean not null default false,
  qr_code text,
  images text[] default '{}',
  features text[] default '{}',
  property_type text not null,
  description text,
  power_specs text,
  parking_allocated int default 0,
  available_from timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- TENANTS ----------
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  shopping_center_id uuid references shopping_centers(id) on delete set null,
  shop_id uuid references shops(id) on delete set null,
  business_name text not null,
  contact_person text not null,
  phone text,
  email text,
  status text not null default 'Active',
  trade_type text,
  move_in_date date,
  user_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- LEASES ----------
create table leases (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  rental_amount numeric(12,2) not null,
  deposit numeric(12,2),
  renewal_status text not null default 'Active',
  document_url text,
  document_title text,
  is_digitally_signed boolean default false,
  signed_at timestamptz,
  signer_name text,
  last_reminder_sent timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- SLA MATRIX ----------
create table sla_matrix (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  priority ticket_priority not null,
  response_minutes int not null,
  resolution_minutes int not null,
  unique (organization_id, priority)
);

-- ---------- TICKETS ----------
create table tickets (
  id uuid primary key default uuid_generate_v4(),
  ticket_number text unique not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  shopping_center_id uuid references shopping_centers(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  shop_id uuid references shops(id) on delete set null,
  tenant_id uuid references tenants(id) on delete set null,
  title text not null,
  description text not null,
  exact_location_description text,
  priority ticket_priority not null,
  category ticket_category not null,
  status ticket_status not null default 'Open',
  assigned_to uuid references profiles(id) on delete set null,
  created_by_user_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  response_deadline timestamptz,
  resolution_deadline timestamptz,
  responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  escalated_at timestamptz,
  sla_status sla_status default 'Compliant',
  repair_notes text,
  materials_used text,
  time_spent_hours numeric(6,2),
  cost numeric(12,2),
  before_images text[] default '{}',
  after_images text[] default '{}',
  tenant_rating int,
  tenant_feedback text,
  tenant_confirmed_fixed boolean
);

create table ticket_timeline (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  timestamp timestamptz not null default now(),
  title text not null,
  description text,
  actor_name text,
  actor_role text,
  type text not null
);

create table ticket_attachments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  file_name text not null,
  file_type text,
  file_size_bytes bigint,
  storage_url text not null,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

create table ticket_comments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  user_name text,
  user_role user_role,
  comment text not null,
  created_at timestamptz not null default now()
);

-- ---------- STAFF SHIFTS ----------
create table staff_shifts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  staff_id uuid references profiles(id) on delete set null,
  staff_name text not null,
  staff_role text not null,
  date date not null,
  shift_type text not null,
  status text not null default 'Scheduled',
  notes text
);

-- ---------- VENDORS ----------
create table vendors (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  company_name text not null,
  service_category text not null,
  contact_person text,
  phone text,
  email text,
  assigned_property_ids uuid[] default '{}',
  contract_expiry date,
  performance_rating numeric(3,2) default 5.0,
  status text not null default 'Active'
);

-- ---------- FINANCE ----------
create table finance_transactions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  shop_id uuid references shops(id) on delete set null,
  tenant_id uuid references tenants(id) on delete set null,
  ticket_id uuid references tickets(id) on delete set null,
  type text not null,
  category text,
  amount numeric(12,2) not null,
  direction text not null check (direction in ('income','expense')),
  description text,
  reference text,
  date date not null,
  status text not null default 'Pending',
  reconciled boolean default false
);

create table financial_requests (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  requested_by_name text,
  type text not null,
  amount numeric(12,2) not null,
  purpose text,
  status text not null default 'Pending Approval',
  created_at timestamptz not null default now(),
  approved_by text
);

create table invoices (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_number text unique not null,
  type invoice_type not null,
  tenant_id uuid references tenants(id) on delete set null,
  tenant_name text,
  shop_id uuid references shops(id) on delete set null,
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
  created_at timestamptz not null default now()
);

create table invoice_lines (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_amount numeric(12,2) not null,
  amount numeric(12,2) not null
);

create table payment_records (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  tenant_id uuid references tenants(id) on delete set null,
  amount numeric(12,2) not null,
  method text not null,
  reference text,
  paid_at timestamptz not null default now(),
  notes text
);

create table bank_transactions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  date date not null,
  description text,
  amount numeric(12,2) not null,
  direction text not null check (direction in ('credit','debit')),
  reconciled boolean default false,
  matched_payment_id uuid references payment_records(id) on delete set null
);

-- ---------- COMMUNICATIONS ----------
create table announcements (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  title text not null,
  message text not null,
  priority text not null default 'General',
  target_audience text not null default 'All Tenants',
  created_by_name text,
  created_at timestamptz not null default now(),
  is_active boolean default true
);

create table emergency_broadcasts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  type text not null,
  headline text not null,
  instructions text,
  issued_at timestamptz not null default now(),
  issued_by text,
  is_active boolean default true
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  role user_role,
  organization_id uuid references organizations(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  read boolean default false,
  created_at timestamptz not null default now(),
  link_id text,
  link text
);

create table conversations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  ticket_id uuid references tickets(id) on delete set null,
  participant_ids uuid[] default '{}',
  participant_names text[] default '{}',
  last_message text,
  updated_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  sender_name text,
  sender_role user_role,
  message text not null,
  created_at timestamptz not null default now(),
  read boolean default false,
  edited boolean default false
);

-- ---------- AUDIT / LEADS ----------
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete set null,
  user_id uuid,
  user_name text,
  action text not null,
  entity_type text,
  entity_id text,
  timestamp timestamptz not null default now(),
  details text
);

create table property_leads (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  company text,
  phone text,
  email text,
  property_count int default 0,
  tenant_count int default 0,
  location text,
  property_type text,
  submitted_at timestamptz not null default now(),
  status text not null default 'New'
);

-- ---------- INDEXES ----------
create index idx_profiles_org on profiles(organization_id);
create index idx_shops_org on shops(organization_id);
create index idx_shops_public on shops(public_listing) where public_listing = true;
create index idx_tickets_org on tickets(organization_id);
create index idx_tickets_status on tickets(status);
create index idx_tickets_assigned on tickets(assigned_to);
create index idx_tickets_sla on tickets(sla_status);
create index idx_tenants_org on tenants(organization_id);
create index idx_notifications_user on notifications(user_id, read);
create index idx_audit_org on audit_logs(organization_id, timestamp desc);
