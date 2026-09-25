import { sb, unwrap } from './_helpers';
import type { Organization, SubscriptionTier } from '../../types';
import { getSupabase } from '../../lib/supabase';
import { auditLogs } from './auditLogs';
import { auth } from '../auth';

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
  staffBreakdown?: Record<string, number | string>;
}

async function writeAudit(action: string, entityId: string, details: string, orgId?: string) {
  const u = auth.getCurrentUser();
  if (!u) return;
  await auditLogs.create({
    user_id: u.id,
    user_name: u.name || 'Super Admin',
    action,
    entity_type: 'organization',
    entity_id: entityId,
    organization_id: orgId ?? entityId,
    details,
  });
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
      p_company_name: String(input.companyName ?? '').trim(),
      p_owner_name: String(input.ownerName ?? '').trim(),
      p_email: String(input.email ?? '').trim().toLowerCase(),
      p_phone: String(input.phone ?? '').trim(),
      p_address: String(input.address ?? '').trim(),
      p_subscription_tier: input.tier || 'Starter',
      p_estimated_monthly_rent: Number(input.estimatedMonthlyRent) || 0,
      p_property_count: Math.max(1, Number(input.propertyCount) || 1),
      p_tenant_count: Math.max(0, Number(input.tenantCount) || 0),
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
        | 'subscription_tier'
        | 'status'
        | 'property_limit'
        | 'tenant_limit'
        | 'user_limit'
        | 'storage_limit'
      >
    >
  ): Promise<Organization> {
    const result = await sb().from('organizations').update(patch).eq('id', id).select('*').single();
    const org = unwrap(result) as unknown as Organization;
    await writeAudit('update', id, `Updated organisation ${org.company_name}`, id);
    return org;
  },

  async approve(id: string): Promise<Organization> {
    const result = await sb()
      .from('organizations')
      .update({ status: 'Active' })
      .eq('id', id)
      .select('*')
      .single();
    const org = unwrap(result) as unknown as Organization;
    await writeAudit('approve', id, `Approved organisation ${org.company_name}`, id);
    return org;
  },

  async reject(id: string, reason?: string): Promise<Organization> {
    const result = await sb()
      .from('organizations')
      .update({ status: 'Rejected' })
      .eq('id', id)
      .select('*')
      .single();
    const org = unwrap(result) as unknown as Organization;
    await writeAudit(
      'reject',
      id,
      `Rejected organisation ${org.company_name}${reason ? `: ${reason}` : ''}`,
      id
    );
    return org;
  },

  async suspend(id: string): Promise<Organization> {
    const result = await sb()
      .from('organizations')
      .update({ status: 'Suspended' })
      .eq('id', id)
      .select('*')
      .single();
    const org = unwrap(result) as unknown as Organization;
    await writeAudit('suspend', id, `Suspended organisation ${org.company_name}`, id);
    return org;
  },
}
