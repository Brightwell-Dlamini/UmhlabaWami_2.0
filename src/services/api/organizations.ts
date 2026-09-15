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
   * Public registration:
   *  1. Create auth user with the password they chose.
   *  2. Insert org via register_organization RPC (status = Pending Approval).
   *  3. Sign out so they land on the public site until approved.
   */
  async register(input: RegisterOrgInput): Promise<Organization> {
    const supabase = getSupabase();

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

    await supabase.auth.signOut();

    return data as unknown as Organization;
  },

  /** Update editable fields (RLS: admin-of-own-org or super_admin). */
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
   * Approve a pending organisation — no edge function.
   * Calls security-definer RPC approve_organization which:
   *   - sets status Active + issues org code
   *   - attaches the owner profile (role admin, status Active, org linked)
   * Owner logs in with the password they set at registration + the new org code.
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
    const { data, error } = await sb().rpc('approve_organization', {
      p_org_id: args.organizationId,
      p_approver_name: args.approverName || 'Super Admin',
      p_custom_code: args.customCode ?? null,
    });

    if (error) {
      // Fallback if RPC missing / old signature: direct update + profile link
      const { data: org, error: loadErr } = await sb()
        .from('organizations')
        .select('*')
        .eq('id', args.organizationId)
        .single();
      if (loadErr || !org) throw new Error(error.message || loadErr?.message || 'Org not found');
      if (org.status === 'Active') throw new Error('Organisation already active');

      const code =
        (args.customCode || '').trim().toUpperCase() ||
        generateOrgCode(org.company_name);

      const { data: patched, error: patchErr } = await sb()
        .from('organizations')
        .update({
          status: 'Active',
          organization_code: code,
          approved_at: new Date().toISOString(),
        })
        .eq('id', args.organizationId)
        .select('*')
        .single();

      if (patchErr || !patched) {
        throw new Error(
          patchErr?.message ||
            error.message ||
            'Approval failed. Run migration 006_simple_approval.sql in Supabase SQL editor.'
        );
      }

      const ownerId =
        (org as { owner_auth_user_id?: string }).owner_auth_user_id ||
        (
          await sb()
            .from('profiles')
            .select('id')
            .eq('email', String(org.email).toLowerCase())
            .maybeSingle()
        ).data?.id;

      if (ownerId) {
        await sb()
          .from('profiles')
          .update({
            organization_id: patched.id,
            role: 'admin',
            status: 'Active',
          })
          .eq('id', ownerId);
      }

      return {
        organizationId: patched.id,
        organizationCode: patched.organization_code,
        adminUserId: ownerId || '',
      };
    }

    const org = (Array.isArray(data) ? data[0] : data) as Organization & {
      owner_auth_user_id?: string;
    };

    return {
      organizationId: org.id,
      organizationCode: org.organization_code,
      adminUserId: org.owner_auth_user_id || '',
    };
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
    if (result.error) {
      const { error } = await sb()
        .from('organizations')
        .update({ status: 'Rejected' })
        .eq('id', args.organizationId);
      if (error) throw new Error(result.error.message || error.message);
    }
  },
};

function generateOrgCode(companyName: string): string {
  const prefix =
    (companyName || 'ORG').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'ORG';
  const d = new Date();
  const date =
    String(d.getDate()).padStart(2, '0') +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getFullYear()).slice(-2);
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${date}-${rand}`;
}
