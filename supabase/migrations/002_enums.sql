-- ============================================================================
-- 002_enums.sql
-- All enum types used by the schema. Run before 001_initial_schema.sql.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Identity / org
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum (
    'tenant',
    'property_manager',
    'maintenance',
    'finance',
    'admin',
    'super_admin'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('Active', 'Inactive', 'Pending', 'Suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type org_status as enum ('Pending Approval', 'Active', 'Suspended', 'Rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_tier as enum ('Starter', 'Professional', 'Enterprise');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Property
-- ---------------------------------------------------------------------------
do $$ begin
  create type unit_status as enum ('Available', 'Occupied', 'Reserved', 'Under Maintenance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type center_status as enum ('Active', 'Under Renovation', 'Planned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type property_status as enum ('Active', 'Archived');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tenants + leases
-- ---------------------------------------------------------------------------
do $$ begin
  create type tenant_status as enum ('Active', 'Notice Given', 'Evicted', 'Pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lease_renewal_status as enum (
    'Active', 'Pending Renewal', 'Renewed', 'Expired', 'Terminated'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------
do $$ begin
  create type ticket_priority as enum ('Low', 'Medium', 'High', 'Emergency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum (
    'Open', 'In Progress', 'Awaiting Approval', 'Resolved',
    'Closed', 'Reopened', 'Cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_category as enum (
    'Plumbing', 'Electrical', 'Air Conditioning', 'Cleaning', 'Security',
    'Parking', 'Noise Complaint', 'Structural Damage', 'Water Leak',
    'Signage', 'Internet / Network', 'Other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type sla_status as enum ('Compliant', 'Warning', 'Overdue', 'Escalated');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
do $$ begin
  create type staff_role as enum ('Manager', 'Maintenance', 'Security', 'Cleaning', 'Finance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_shift_type as enum (
    'Morning (07:00-15:00)',
    'Afternoon (14:00-22:00)',
    'Night (22:00-07:00)',
    'General (08:00-17:00)'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_shift_status as enum ('Scheduled', 'Completed', 'Leave', 'On-Call');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vendor_status as enum ('Active', 'Under Review', 'Inactive');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------
do $$ begin
  create type invoice_status as enum (
    'Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_type as enum ('Rent', 'Service Charge', 'Deposit', 'Other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('EFT', 'Cash', 'Card', 'Other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type finance_tx_type as enum (
    'Rent Collection', 'Maintenance Expense', 'Utility Payment',
    'Vendor Payout', 'Security Deposit'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type finance_tx_direction as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type finance_tx_status as enum ('Paid', 'Pending', 'Overdue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bank_tx_direction as enum ('credit', 'debit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type requisition_type as enum (
    'Petty Cash', 'Purchase Request', 'Maintenance Funding', 'Vendor Payment'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type requisition_status as enum (
    'Pending Approval', 'Approved', 'Rejected', 'Disbursed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_type as enum ('Friendly', 'Firm', 'Final Notice');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_channel as enum ('email', 'sms', 'print');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Quotes + orders
-- ---------------------------------------------------------------------------
do $$ begin
  create type quote_type as enum (
    'Lease Proposal', 'Fitout Works', 'Once-off Service', 'Other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type quote_status as enum (
    'Draft', 'Sent', 'Accepted', 'Declined', 'Expired', 'Converted'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'Draft', 'Confirmed', 'In Progress', 'Fulfilled', 'Cancelled', 'Invoiced'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- PM
-- ---------------------------------------------------------------------------
do $$ begin
  create type pm_status as enum ('Scheduled', 'In Progress', 'Completed', 'Overdue');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Announcements + emergencies
-- ---------------------------------------------------------------------------
do $$ begin
  create type announcement_priority as enum ('General', 'Important', 'Emergency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type announcement_audience as enum (
    'All Tenants', 'Specific Property', 'Specific Floor'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type emergency_type as enum (
    'Fire', 'Security', 'Water Outage', 'Power Outage', 'Evacuation', 'Major Maintenance'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
do $$ begin
  create type notification_type as enum (
    'registration', 'approval',
    'ticket_new', 'ticket_assigned', 'ticket_status',
    'ticket_resolved', 'ticket_reopened',
    'sla_warning', 'sla_breach',
    'announcement', 'emergency', 'lease_reminder'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Quote/sales line items
-- ---------------------------------------------------------------------------
do $$ begin
  create type invoice_item_category as enum (
    'Rent', 'Service Charge', 'Utility', 'Parking', 'Signage',
    'Penalty', 'Deposit', 'Fitout', 'Other'
  );
exception when duplicate_object then null; end $$;