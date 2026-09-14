/**
 * Supabase-generated types (hand-written until gen types runs).
 * These mirror the SQL schema exactly. Domain types in src/types/index.ts
 * remain the source of truth for the app — these are for the client SDK.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole =
  | 'tenant' | 'property_manager' | 'maintenance'
  | 'finance' | 'admin' | 'super_admin';

export type UnitStatus = 'Available' | 'Occupied' | 'Reserved' | 'Under Maintenance';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Emergency';
export type TicketStatus =
  | 'Open' | 'In Progress' | 'Awaiting Approval' | 'Resolved'
  | 'Closed' | 'Reopened' | 'Cancelled';
export type SlaStatus = 'Compliant' | 'Warning' | 'Overdue' | 'Escalated';
export type SubscriptionTier = 'Starter' | 'Professional' | 'Enterprise';
export type OrgStatus = 'Pending Approval' | 'Active' | 'Suspended' | 'Rejected';

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          organization_code: string;
          company_name: string;
          owner_name: string;
          email: string;
          phone: string;
          address: string;
          subscription_tier: SubscriptionTier;
          status: OrgStatus;
          property_limit: number;
          tenant_limit: number;
          user_limit: number;
          storage_limit: number;
          monthly_fee_estimate: number | null;
          logo_url: string | null;
          custom_branding_color: string | null;
          created_at: string;
          approved_at: string | null;
          approved_by: string | null;
        };
        Insert: Partial<Database['public']['Tables']['organizations']['Row']> & {
          company_name: string;
          owner_name: string;
          email: string;
          phone: string;
          address: string;
        };
        Update: Partial<Database['public']['Tables']['organizations']['Row']>;
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string | null;
          username: string;
          name: string;
          email: string;
          phone: string | null;
          role: UserRole;
          property_id: string | null;
          shopping_center_id: string | null;
          shop_id: string | null;
          status: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id: string; username: string; name: string; email: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      // ... (all other tables follow the same shape — I'll add them all in the actual file)
    };
  };
}
