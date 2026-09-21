-- ============================================================================
-- 001_initial_schema.sql (Part 1 — core operational tables)
--
-- Assumes 002_enums.sql has already run.
-- Idempotent-ish: uses IF NOT EXISTS where Postgres supports it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ORGANIZATIONS
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default uuid_generate_v4(),
  organization_code text unique not null,
  company_name text not null,
  owner_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  subscription_tier subscription_tier not null default 'Starter',
  status org_status not null default 'Pending Approval',
  property_limit int not null default 2,
  tenant_limit int not null default 50,
  user_limit int not null default 10,
  storage_limit int not null default 5,
  monthly_fee_estimate numeric(12,2),
  logo_url text,
  custom_branding_color text,
  owner_auth_user_id uuid,
  -- Phase 8 financial settings
  escalation_rate_pct numeric(5,2) not null default 8.0,
  grace_period_days int not null default 7,
  utility_markup_pct numeric(5,2) not null default 5.0,
  auto_invoice_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  constraint organizations_escalation_rate_range check (escalation_rate_pct between 0 and 50),
  constraint organizations_grace_period_range check (grace_period_days between 0 and 90),
  constraint organizations_utility_markup_range check (utility_markup_pct between 0 and 50)
);

create index if not exists organizations_status_idx on public.organizations (status);
create unique index if not exists organizations_id_org_unique on public.organizations (id);

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key,  -- references auth.users(id), added below
  organization_id uuid references public.organizations(id) on delete set null,
  username text not null,
  name text not null,
  email text not null,
  phone text,
  role user_role not null default 'tenant',
  property_id uuid,
  shopping_center_id uuid,
  shop_id uuid,
  status user_status not null default 'Active',
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('tenant','property_manager','maintenance','finance','admin','super_admin'))
);

create index if not exists profiles_org_idx on public.profiles (organization_id);
create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_username_org_idx on public.profiles (username, organization_id);
create unique index if not exists profiles_id_org_unique on public.profiles (id);

-- ---------------------------------------------------------------------------
-- SHOPPING_CENTERS
-- ---------------------------------------------------------------------------
create table if not exists public.shopping_centers (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text not null,
  location text not null,
  description text,
  image text,
  status center_status not null default 'Active',
  operating_hours text,
  parking_bays int not null default 0,
  amenities text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists shopping_centers_org_idx on public.shopping_centers (organization_id);
create unique index if not exists shopping_centers_id_org_unique on public.shopping_centers (id, organization_id);

-- ---------------------------------------------------------------------------
-- PROPERTIES
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shopping_center_id uuid not null,
  name text not null,
  type text not null,  -- 'Retail shop' | 'Office' | ... (free text per TS type union)
  address text not null,
  description text,
  status property_status not null default 'Active',
  created_at timestamptz not null default now(),
  foreign key (shopping_center_id, organization_id)
    references public.shopping_centers(id, organization_id) on delete cascade
);

create index if not exists properties_org_idx on public.properties (organization_id);
create index if not exists properties_center_idx on public.properties (shopping_center_id);
create unique index if not exists properties_id_org_unique on public.properties (id, organization_id);

-- ---------------------------------------------------------------------------
-- SHOPS (units)
-- ---------------------------------------------------------------------------
create table if not exists public.shops (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null,
  shopping_center_id uuid not null,
  shop_number text not null,
  floor text not null default 'Ground Floor',
  size_sqm numeric(10,2) not null default 0,
  rental_amount numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  status unit_status not null default 'Available',
  public_listing boolean not null default false,
  public_featured boolean not null default false,
  qr_code text,
  images text[] not null default '{}',
  features text[] not null default '{}',
  property_type text not null default 'Retail shop',
  description text,
  power_specs text,
  parking_allocated int,
  available_from date,
  created_at timestamptz not null default now(),
  foreign key (shopping_center_id, organization_id)
    references public.shopping_centers(id, organization_id) on delete cascade,
  foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete cascade
);

create index if not exists shops_org_idx on public.shops (organization_id);
create index if not exists shops_center_idx on public.shops (shopping_center_id);
create index if not exists shops_status_idx on public.shops (status);
create index if not exists shops_public_idx on public.shops (public_listing) where public_listing = true;
create unique index if not exists shops_id_org_unique on public.shops (id, organization_id);

-- ---------------------------------------------------------------------------
-- TENANTS
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null,
  shopping_center_id uuid not null,
  shop_id uuid not null,
  business_name text not null,
  contact_person text not null,
  phone text not null,
  email text not null,
  status tenant_status not null default 'Active',
  trade_type text not null default 'Retail',
  move_in_date date not null default current_date,
  user_id uuid,
  created_at timestamptz not null default now(),
  foreign key (shopping_center_id, organization_id)
    references public.shopping_centers(id, organization_id) on delete cascade,
  foreign key (shop_id, organization_id)
    references public.shops(id, organization_id) on delete cascade
);

create index if not exists tenants_org_idx on public.tenants (organization_id);
create index if not exists tenants_shop_idx on public.tenants (shop_id);
create index if not exists tenants_user_idx on public.tenants (user_id);
create unique index if not exists tenants_id_org_unique on public.tenants (id, organization_id);

-- ---------------------------------------------------------------------------
-- LEASES
-- ---------------------------------------------------------------------------
create table if not exists public.leases (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id uuid not null,
  shop_id uuid not null,
  start_date date not null,
  end_date date not null,
  rental_amount numeric(12,2) not null default 0,
  deposit numeric(12,2) not null default 0,
  renewal_status lease_renewal_status not null default 'Active',
  document_url text,
  document_title text not null,
  is_digitally_signed boolean not null default false,
  signed_at timestamptz,
  signer_name text,
  last_reminder_sent timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, organization_id)
    references public.tenants(id, organization_id) on delete cascade,
  foreign key (shop_id, organization_id)
    references public.shops(id, organization_id) on delete cascade
);

create index if not exists leases_org_idx on public.leases (organization_id);
create index if not exists leases_tenant_idx on public.leases (tenant_id);
create index if not exists leases_end_date_idx on public.leases (end_date);
create unique index if not exists leases_id_org_unique on public.leases (id, organization_id);

-- ---------------------------------------------------------------------------
-- SLA_MATRIX
-- ---------------------------------------------------------------------------
create table if not exists public.sla_matrix (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  priority ticket_priority not null,
  response_minutes int not null,
  resolution_minutes int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, priority)
);

-- ---------------------------------------------------------------------------
-- TICKETS
-- ---------------------------------------------------------------------------
create table if not exists public.tickets (
  id uuid primary key default uuid_generate_v4(),
  ticket_number text unique not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shopping_center_id uuid not null,
  property_id uuid,
  shop_id uuid,
  tenant_id uuid,
  title text not null,
  description text not null,
  exact_location_description text,
  priority ticket_priority not null default 'Medium',
  category ticket_category not null default 'Other',
  status ticket_status not null default 'Open',
  assigned_to uuid,
  assigned_to_name text,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  response_deadline timestamptz not null,
  resolution_deadline timestamptz not null,
  responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  sla_status sla_status not null default 'Compliant',
  repair_notes text,
  materials_used text,
  time_spent_hours numeric(6,2),
  cost numeric(12,2),
  before_images text[] not null default '{}',
  after_images text[] not null default '{}',
  tenant_rating int,
  tenant_feedback text,
  tenant_confirmed_fixed boolean,
  foreign key (shopping_center_id, organization_id)
    references public.shopping_centers(id, organization_id) on delete cascade,
  foreign key (shop_id, organization_id)
    references public.shops(id, organization_id) on delete set null,
  foreign key (tenant_id, organization_id)
    references public.tenants(id, organization_id) on delete set null
);

create index if not exists tickets_org_idx on public.tickets (organization_id);
create index if not exists tickets_status_idx on public.tickets (status);
create index if not exists tickets_priority_idx on public.tickets (priority);
create index if not exists tickets_assigned_idx on public.tickets (assigned_to);
create index if not exists tickets_deadline_idx on public.tickets (resolution_deadline);
create index if not exists tickets_sla_idx on public.tickets (sla_status);
create unique index if not exists tickets_id_org_unique on public.tickets (id);

-- ---------------------------------------------------------------------------
-- TICKET_TIMELINE
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_timeline (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  timestamp timestamptz not null default now(),
  title text not null,
  description text,
  actor_name text not null,
  actor_role text not null,
  type text not null,  -- 'creation' | 'assignment' | ...
  created_at timestamptz not null default now()
);

create index if not exists ticket_timeline_ticket_idx on public.ticket_timeline (ticket_id, timestamp desc);

-- ---------------------------------------------------------------------------
-- TICKET_ATTACHMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_attachments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size_bytes bigint not null default 0,
  storage_url text not null,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now()
);

create index if not exists ticket_attachments_ticket_idx on public.ticket_attachments (ticket_id);

-- ---------------------------------------------------------------------------
-- TICKET_COMMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_comments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid not null,
  user_name text not null,
  user_role text not null,
  comment text not null,
  created_at timestamptz not null default now()
);

create index if not exists ticket_comments_ticket_idx on public.ticket_comments (ticket_id, created_at asc);