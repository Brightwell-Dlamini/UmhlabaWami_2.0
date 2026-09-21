// src/types/index.ts
export type UserRole =
  | 'tenant'
  | 'property_manager'
  | 'maintenance'
  | 'finance'
  | 'admin'
  | 'super_admin';

export type UnitStatus =
  | 'Available'
  | 'Occupied'
  | 'Reserved'
  | 'Under Maintenance';

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Emergency';

export type TicketStatus =
  | 'Open'
  | 'In Progress'
  | 'Awaiting Approval'
  | 'Resolved'
  | 'Closed'
  | 'Reopened'
  | 'Cancelled';

export type TicketCategory =
  | 'Plumbing'
  | 'Electrical'
  | 'Air Conditioning'
  | 'Cleaning'
  | 'Security'
  | 'Parking'
  | 'Noise Complaint'
  | 'Structural Damage'
  | 'Water Leak'
  | 'Signage'
  | 'Internet / Network'
  | 'Other';

export type SubscriptionTier = 'Starter' | 'Professional' | 'Enterprise';

export interface SubscriptionConfig {
  tier: SubscriptionTier;
  name: string;
  propertyLimit: number;
  tenantLimit: number;
  userLimit: number;
  storageLimitGb: number;
  pricePerMonthE: number;
  features: string[];
}

export interface Organization {
  id: string;
  organization_code: string;
  company_name: string;
  owner_name: string;
  email: string;
  phone: string;
  address: string;
  subscription_tier: SubscriptionTier;
  status: 'Pending Approval' | 'Active' | 'Suspended' | 'Rejected';
  property_limit: number;
  tenant_limit: number;
  user_limit: number;
  storage_limit: number;
  monthly_fee_estimate?: number;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  logo_url?: string;
  custom_branding_color?: string;
}

export interface User {
  id: string;
  organization_id?: string;
  username: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  property_id?: string;
  shopping_center_id?: string;
  shop_id?: string;
  /**
   * Account lifecycle:
   *   Active    — normal sign-in allowed
   *   Pending   — created but not activated (owner approval flows)
   *   Suspended — temporarily blocked (login must reject)
   *   Inactive  — deactivated / archived (login must reject)
   */
  status: 'Active' | 'Inactive' | 'Pending' | 'Suspended';
  avatar_url?: string;
  created_at: string;
}

export interface ShoppingCenter {
  id: string;
  organization_id: string;
  name: string;
  address: string;
  location: string;
  description: string;
  image: string;
  status: 'Active' | 'Under Renovation' | 'Planned';
  operating_hours: string;
  parking_bays: number;
  amenities: string[];
}

export interface Property {
  id: string;
  organization_id: string;
  shopping_center_id: string;
  name: string;
  type:
    | 'Retail shop'
    | 'Office'
    | 'Warehouse'
    | 'Restaurant'
    | 'Kiosk'
    | 'Commercial unit'
    | 'House'
    | 'Apartment'
    | 'Mixed-use property';
  address: string;
  description: string;
  status: 'Active' | 'Archived';
}

export interface Shop {
  id: string;
  organization_id: string;
  property_id: string;
  shopping_center_id: string;
  shop_number: string;
  floor: string;
  size_sqm: number;
  rental_amount: number;
  deposit_amount: number;
  status: UnitStatus;
  public_listing: boolean;
  public_featured?: boolean;
  qr_code: string;
  images: string[];
  features: string[];
  property_type: Property['type'];
  description: string;
  power_specs?: string;
  parking_allocated?: number;
  available_from?: string;
}

export interface Tenant {
  id: string;
  organization_id: string;
  property_id: string;
  shopping_center_id: string;
  shop_id: string;
  business_name: string;
  contact_person: string;
  phone: string;
  email: string;
  status: 'Active' | 'Notice Given' | 'Evicted' | 'Pending';
  trade_type: string;
  move_in_date: string;
  user_id?: string;
}

export interface Lease {
  id: string;
  tenant_id: string;
  shop_id: string;
  organization_id: string;
  start_date: string;
  end_date: string;
  rental_amount: number;
  deposit: number;
  renewal_status:
    | 'Active'
    | 'Pending Renewal'
    | 'Renewed'
    | 'Expired'
    | 'Terminated';
  document_url: string;
  document_title: string;
  is_digitally_signed: boolean;
  signed_at?: string;
  signer_name?: string;
  last_reminder_sent?: string;
}

export interface SlaRule {
  priority: TicketPriority;
  response_minutes: number;
  resolution_minutes: number;
}

export interface SlaAgreement {
  id: string;
  tenant_id: string;
  property_id: string;
  organization_id: string;
  emergency_response_mins: number;
  high_response_mins: number;
  medium_response_mins: number;
  low_response_mins: number;
  expiry_date: string;
  signed_at?: string;
  signer_name?: string;
}

export interface TicketTimelineItem {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  actor_name: string;
  actor_role: string;
  type:
    | 'creation'
    | 'assignment'
    | 'acceptance'
    | 'progress'
    | 'resolution'
    | 'confirmation'
    | 'reopened'
    | 'escalation';
}

export interface TicketAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  storage_url: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  organization_id: string;
  shopping_center_id: string;
  property_id: string;
  shop_id: string;
  tenant_id: string;
  title: string;
  description: string;
  exact_location_description?: string;
  priority: TicketPriority;
  category: TicketCategory;
  status: TicketStatus;
  assigned_to?: string;
  assigned_to_name?: string;
  created_by_user_id: string;
  created_at: string;
  response_deadline: string;
  resolution_deadline: string;
  responded_at?: string;
  resolved_at?: string;
  closed_at?: string;
  sla_status: 'Compliant' | 'Warning' | 'Overdue' | 'Escalated';
  attachments: TicketAttachment[];
  timeline: TicketTimelineItem[];
  repair_notes?: string;
  materials_used?: string;
  time_spent_hours?: number;
  cost?: number;
  before_images?: string[];
  /** Storage URLs (public or signed) — never arbitrary user-pasted links. */
  after_images?: string[];
  tenant_rating?: number;
  tenant_feedback?: string;
  tenant_confirmed_fixed?: boolean;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  comment: string;
  created_at: string;
}

export interface StaffShift {
  id: string;
  organization_id: string;
  property_id: string;
  staff_id: string;
  staff_name: string;
  staff_role:
    | 'Manager'
    | 'Maintenance'
    | 'Security'
    | 'Cleaning'
    | 'Finance';
  date: string;
  shift_type:
    | 'Morning (07:00-15:00)'
    | 'Afternoon (14:00-22:00)'
    | 'Night (22:00-07:00)'
    | 'General (08:00-17:00)';
  status: 'Scheduled' | 'Completed' | 'Leave' | 'On-Call';
  notes?: string;
}

export interface Vendor {
  id: string;
  organization_id: string;
  company_name: string;
  service_category: string;
  contact_person: string;
  phone: string;
  email: string;
  contract_expiry: string;
  performance_rating: number;
  status: 'Active' | 'Under Review' | 'Inactive';
}

export interface FinanceTransaction {
  id: string;
  organization_id: string;
  property_id: string;
  shop_id?: string;
  tenant_id?: string;
  ticket_id?: string;
  type:
    | 'Rent Collection'
    | 'Maintenance Expense'
    | 'Utility Payment'
    | 'Vendor Payout'
    | 'Security Deposit';
  category?: string;
  amount: number;
  direction: 'income' | 'expense';
  description: string;
  reference: string;
  date: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  reconciled: boolean;
}

export interface FinancialRequest {
  id: string;
  organization_id: string;
  property_id: string;
  requested_by_name: string;
  type:
    | 'Petty Cash'
    | 'Purchase Request'
    | 'Maintenance Funding'
    | 'Vendor Payment';
  amount: number;
  purpose: string;
  status: 'Pending Approval' | 'Approved' | 'Rejected' | 'Disbursed';
  created_at: string;
  approved_by?: string;
}

export interface Announcement {
  id: string;
  organization_id: string;
  property_id: string;
  title: string;
  message: string;
  priority: 'General' | 'Important' | 'Emergency';
  target_audience: 'All Tenants' | 'Specific Property' | 'Specific Floor';
  created_by_name: string;
  created_at: string;
  is_active: boolean;
}

export interface EmergencyBroadcast {
  id: string;
  organization_id: string;
  property_id: string;
  type:
    | 'Fire'
    | 'Security'
    | 'Water Outage'
    | 'Power Outage'
    | 'Evacuation'
    | 'Major Maintenance';
  headline: string;
  instructions: string;
  issued_at: string;
  issued_by: string;
  is_active: boolean;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  role?: UserRole;
  organization_id?: string;
  type:
    | 'registration'
    | 'approval'
    | 'ticket_new'
    | 'ticket_assigned'
    | 'ticket_status'
    | 'ticket_resolved'
    | 'ticket_reopened'
    | 'sla_warning'
    | 'sla_breach'
    | 'announcement'
    | 'emergency'
    | 'lease_reminder';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  link_id?: string;
  link?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: UserRole;
  message: string;
  created_at: string;
  read: boolean;
  edited?: boolean;
}

export interface Conversation {
  id: string;
  organization_id: string;
  ticket_id?: string;
  participant_ids: string[];
  participant_names: string[];
  last_message?: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id?: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  details?: string;
}

// Phase 4 — Commercial engine
export type InvoiceStatus =
  | 'Draft'
  | 'Sent'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'Cancelled';

export type InvoiceType = 'Rent' | 'Service Charge' | 'Deposit' | 'Other';

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unit_amount: number;
  amount: number;
}

export interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  type: InvoiceType;
  tenant_id: string;
  tenant_name: string;
  shop_id?: string;
  shop_number?: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  lines: InvoiceLine[];
  notes?: string;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  organization_id: string;
  invoice_id?: string;
  tenant_id?: string;
  amount: number;
  method: 'EFT' | 'Cash' | 'Card' | 'Other';
  reference?: string;
  paid_at: string;
  notes?: string;
}

export interface BankTransaction {
  id: string;
  organization_id: string;
  date: string;
  description: string;
  amount: number;
  direction: 'credit' | 'debit';
  reconciled: boolean;
  matched_payment_id?: string;
}
