import { getSupabase } from '../../lib/supabase';
import { sb, unwrap } from './_helpers';
import type { Organization, SubscriptionTier } from '../../types';

export interface RegisterOrgInput {
  companyName: string;
  ownerName: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  tier: SubscriptionTier;
  estimatedMonthlyRent?: number;
  propertyCount?: number;
  tenantCount?: number;
  staffBreakdown?: Record<string, number>;
}

export const organizations = {
  /** List all organisations the caller can see (super admin sees all). */
  async list(): Promise<Organization[]> {
    const result = await sb()
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as Organization[];
  },

  async pending(): Promise<Organization[]> {
    const result = await sb()
      .from('organizations')
      .select('*')
      .eq('status', 'Pending Approval')
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as Organization[];
  },

  async get(id: string): Promise<Organization> {
    const result = await sb()
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();
    return unwrap(result) as unknown as Organization;
  },

  /**
   * Public registration flow:
   *  1. Create the auth user (owner) with the password they chose.
   *  2. Insert the organisations row linked to that auth user.
   *  3. Sign out so the pending user lands on the public site.
   *
   * The super admin approval step later flips status to Active and
   * attaches the profile to the org as admin. No password is ever
   * generated or transmitted by the system.
   */
  async register(input: RegisterOrgInput): Promise<Organization> {
    const supabase = getSupabase();

    // 1) Create the auth user
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: {
          name: input.ownerName,
          username: input.email.split('@')[0].toLowerCase(),
          role: 'admin',
        },
      },
    });

    if (signUpErr) throw new Error(signUpErr.message);

    const userId = signUpData.user?.id;
    if (!userId) {
      throw new Error(
        'Signup did not return a user id. Check that email confirmation is disabled ' +
          'or that the email has not already been registered.'
      );
    }

    // 2) Insert the org linked to this user
    const { data, error } = await supabase.rpc('register_organization', {
      p_owner_auth_user_id: userId,
      p_company_name: input.companyName,
      p_owner_name: input.ownerName,
      p_email: input.email,
      p_phone: input.phone,
      p_address: input.address,
      p_subscription_tier: input.tier,
      p_estimated_monthly_rent: input.estimatedMonthlyRent ?? 0,
      p_property_count: input.propertyCount ?? 1,
      p_tenant_count: input.tenantCount ?? 0,
      p_staff_breakdown: input.staffBreakdown ?? {},
    });
    if (error) throw new Error(error.message);

    // 3) Sign out — the pending user shouldn't wander into a blank dashboard
    await supabase.auth.signOut();

    return data as unknown as Organization;
  },

  /** Update editable fields (RLS restricts to admin-of-own-org or super_admin). */
  async update(
    id: string,
    patch: Partial<
      Pick<
        Organization,
        | 'company_name'
        | 'owner_name'
        | 'email'
        | 'phone'
        | 'address'
        | 'logo_url'
        | 'custom_branding_color'
        | 'monthly_fee_estimate'
      >
    >
  ): Promise<Organization> {
    const result = await sb()
      .from('organizations')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as Organization;
  },

  /**
   * Approve a pending org via the Edge Function.
   * Requires the caller to be a super admin. Only the org code is
   * returned — passwords are never issued by the platform.
   */
  async approve(args: {
    organizationId: string;
    approverName: string;
    customCode?: string;
  }): Promise<{
    organizationId: string;
    organizationCode: string;
    adminUserId: string;
  }> {
    const result = await sb().functions.invoke('approve-organization', {
      body: args,
    });
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.success) {
      throw new Error(result.data?.error || 'Approval failed');
    }
    return result.data;
  },

  async reject(args: {
    organizationId: string;
    approverName: string;
    reason: string;
  }): Promise<void> {
    const result = await sb().rpc('reject_organization', {
      p_org_id: args.organizationId,
      p_approver_name: args.approverName,
      p_reason: args.reason,
    });
    if (result.error) throw new Error(result.error.message);
  },
};
