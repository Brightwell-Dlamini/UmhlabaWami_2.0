import { sb, unwrap } from './_helpers';
import type { Organization, SubscriptionTier } from '../../types';

export interface RegisterOrgInput {
  companyName: string;
  ownerName: string;
  email: string;
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
    const result = await sb().from('organizations').select('*').eq('id', id).single();
    return unwrap(result) as unknown as Organization;
  },

  async register(input: RegisterOrgInput): Promise<Organization> {
    const result = await sb().rpc('register_organization', {
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
    return unwrap(result) as unknown as Organization;
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
        | 'subscription_tier'
        | 'status'
        | 'property_limit'
        | 'tenant_limit'
        | 'user_limit'
        | 'storage_limit'
      >
    >
  ): Promise<Organization> {
    const result = await sb().from('organizations').update(patch).eq('id', id).select().single();
    return unwrap(result) as unknown as Organization;
  },

  async setStatus(
    id: string,
    status: Organization['status']
  ): Promise<Organization> {
    return this.update(id, { status });
  },

  async setTier(id: string, tier: SubscriptionTier): Promise<Organization> {
    // Dynamic limits from super-admin editable plan config
    const { subscriptionPlans } = await import('../subscriptionPlans');
    const limits = subscriptionPlans.limitsFor(tier);
    return this.update(id, { subscription_tier: tier, ...limits });
  },

  async approve(args: {
    organizationId: string;
    approverName: string;
    customCode?: string;
    adminEmail?: string;
    adminName?: string;
    temporaryPassword?: string;
  }): Promise<{
    organizationId: string;
    organizationCode: string;
    adminUserId: string;
    inviteSent: boolean;
  }> {
    const result = await sb().functions.invoke('approve-organization', {
      body: args,
    });
    if (result.error) {
      const ctx = (result.error as { context?: { body?: string } }).context;
      let detail = result.error.message;
      try {
        if (ctx?.body) {
          const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
          if (parsed?.error) detail = parsed.error;
        }
      } catch {
        // keep default message
      }
      throw new Error(detail || 'Approval request failed');
    }
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
