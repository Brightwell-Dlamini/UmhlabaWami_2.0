import { sb, unwrap } from './_helpers';
import { isMemoryMode, getMemoryDb } from './mode';
import type { Organization, SubscriptionTier } from '../../types';
import { getSupabase } from '../../lib/supabase';

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
  async list(): Promise<Organization[]> {
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      return [...db.organizations].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    const result = await sb()
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as Organization[];
  },

  async pending(): Promise<Organization[]> {
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      return db.organizations.filter((o) => o.status === 'Pending Approval');
    }
    const result = await sb()
      .from('organizations')
      .select('*')
      .eq('status', 'Pending Approval')
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as Organization[];
  },

  async get(id: string): Promise<Organization> {
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      const found = db.organizations.find((o) => o.id === id);
      if (!found) throw new Error('Organisation not found.');
      return found;
    }
    const result = await sb().from('organizations').select('*').eq('id', id).single();
    return unwrap(result) as unknown as Organization;
  },

  /**
   * Public registration flow:
   *  1. Create auth user with chosen password.
   *  2. Insert org via register_organization RPC (status = Pending Approval).
   *  3. Sign out so they land on public site until approved.
   *
   * Memory mode: writes directly to db.organizations with status Pending.
   */
  async register(input: RegisterOrgInput): Promise<Organization> {
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      const created = db.registerOrganization({
        company_name: input.companyName,
        owner_name: input.ownerName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        subscription_tier: input.tier,
        property_count: input.propertyCount,
        tenant_count: input.tenantCount,
        estimated_rental_income: input.estimatedMonthlyRent,
      });
      return created;
    }

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
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      const org = db.organizations.find((o) => o.id === id);
      if (!org) throw new Error('Organisation not found.');
      Object.assign(org, patch);
      db.saveToStorage();
      return org;
    }
    const result = await sb()
      .from('organizations')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as Organization;
  },

  /**
   * Approve a pending organisation. Prefers the `approve_organization` RPC
   * (which generates the code server-side). Falls back to a direct update
   * + profile link if the RPC is missing.
   *
   * Both paths converge on the same end state:
   *   - org.status = 'Active'
   *   - org.organization_code issued
   *   - owner profile linked (role='admin', status='Active', organization_id set)
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
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      const code = db.approveOrganization(
        args.organizationId,
        args.approverName,
        undefined,
        args.customCode ? { organization_code: args.customCode } : undefined
      );
      // db.approveOrganization also provisions the admin user
      const org = db.organizations.find((o) => o.id === args.organizationId);
      const admin = db.users.find(
        (u) => u.organization_id === args.organizationId && u.role === 'admin'
      );
      return {
        organizationId: args.organizationId,
        organizationCode: code || org?.organization_code || '',
        adminUserId: admin?.id || '',
      };
    }

    const rpcResult = await sb().rpc('approve_organization', {
      p_org_id: args.organizationId,
      p_approver_name: args.approverName || 'Super Admin',
      p_custom_code: args.customCode ?? null,
    });

    if (!rpcResult.error && rpcResult.data) {
      const org = (Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data) as
        Organization & { owner_auth_user_id?: string };
      return {
        organizationId: org.id,
        organizationCode: org.organization_code,
        adminUserId: org.owner_auth_user_id || '',
      };
    }

    // Fallback path: RPC missing or failed.
    const { data: org, error: loadErr } = await sb()
      .from('organizations')
      .select('*')
      .eq('id', args.organizationId)
      .single();
    if (loadErr || !org) {
      throw new Error(
        rpcResult.error?.message ||
          loadErr?.message ||
          'Org not found during approval.'
      );
    }
    if (org.status === 'Active') {
      throw new Error('Organisation already active.');
    }

    const code =
      (args.customCode || '').trim().toUpperCase() || generateOrgCode(org.company_name);

    const { data: patched, error: patchErr } = await sb()
      .from('organizations')
      .update({
        status: 'Active',
        organization_code: code,
        approved_at: new Date().toISOString(),
        approved_by: args.approverName,
      })
      .eq('id', args.organizationId)
      .select('*')
      .single();

    if (patchErr || !patched) {
      throw new Error(
        patchErr?.message ||
          rpcResult.error?.message ||
          'Approval failed. Run migration 006_simple_approval.sql in Supabase.'
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
  },

  async reject(args: {
    organizationId: string;
    approverName: string;
    reason: string;
  }): Promise<void> {
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      db.rejectOrganization(args.organizationId, args.approverName, args.reason);
      return;
    }
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

/** Generate an organisation code: PREFIX-DDMMYY-#### */
export function generateOrgCode(companyName: string): string {
  const prefix =
    (companyName || 'ORG').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() ||
    'ORG';
  const d = new Date();
  const date =
    String(d.getDate()).padStart(2, '0') +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getFullYear()).slice(-2);
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${date}-${rand}`;
}
