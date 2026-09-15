import { createClient } from '@supabase/supabase-js';
import { sb, unwrap } from './_helpers';
import type { Organization, SubscriptionTier } from '../../types';
import { auth } from '../auth';

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

/** Isolated client so signUp does not steal the super-admin session. */
function anonAuthClient() {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
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
      .eq('status', 'Pending')
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as Organization[];
  },

  async get(id: string): Promise<Organization> {
    const result = await sb().from('organizations').select('*').eq('id', id).single();
    return unwrap(result) as unknown as Organization;
  },

  async register(input: RegisterOrgInput): Promise<Organization> {
    const result = await sb()
      .from('organizations')
      .insert({
        company_name: input.companyName,
        owner_name: input.ownerName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        subscription_tier: input.tier,
        status: 'Pending',
        organization_code: 'PENDING',
        estimated_monthly_rent: input.estimatedMonthlyRent ?? null,
        property_count: input.propertyCount ?? null,
        tenant_count: input.tenantCount ?? null,
        staff_breakdown: input.staffBreakdown ?? null,
      })
      .select('*')
      .single();
    return unwrap(result) as unknown as Organization;
  },

  async update(
    id: string,
    patch: Partial<{
      company_name: string;
      owner_name: string;
      email: string;
      phone: string;
      address: string;
      subscription_tier: SubscriptionTier;
      status: string;
      organization_code: string;
      property_limit: number;
      tenant_limit: number;
      user_limit: number;
      storage_limit_gb: number;
    }>
  ): Promise<Organization> {
    const result = await sb().from('organizations').update(patch).eq('id', id).select('*').single();
    return unwrap(result) as unknown as Organization;
  },

  async setTier(id: string, tier: SubscriptionTier): Promise<Organization> {
    let limits: Partial<Organization> = {};
    try {
      const { data } = await sb()
        .from('subscription_tiers')
        .select('*')
        .eq('tier_key', tier)
        .maybeSingle();
      if (data) {
        limits = {
          property_limit: data.property_limit,
          tenant_limit: data.tenant_limit,
          user_limit: data.user_limit,
          storage_limit_gb: data.storage_limit_gb,
        };
      }
    } catch {
      /* defaults */
    }
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
    temporaryPassword?: string;
  }> {
    // 1) Primary path: deployed edge function (service role — creates auth user + profile)
    try {
      const { data, error } = await sb().functions.invoke('approve-organization', {
        body: {
          organizationId: args.organizationId,
          approverName: args.approverName || 'Super Admin',
          customCode: args.customCode || undefined,
          adminEmail: args.adminEmail || undefined,
          adminName: args.adminName || undefined,
          temporaryPassword: args.temporaryPassword || undefined,
        },
      });
      if (!error && data && !(data as { error?: string }).error) {
        const d = data as {
          organizationId: string;
          organizationCode: string;
          adminUserId: string;
          inviteSent?: boolean;
          temporaryPassword?: string;
        };
        return {
          organizationId: d.organizationId,
          organizationCode: d.organizationCode,
          adminUserId: d.adminUserId || '',
          inviteSent: !!d.inviteSent,
          temporaryPassword: d.temporaryPassword || args.temporaryPassword,
        };
      }
      // Edge returned an application error or transport error — fall through to local path
      if (error) {
        console.warn('[approve] edge function failed, using fallback:', error.message);
      } else if ((data as { error?: string })?.error) {
        console.warn('[approve] edge function error body:', (data as { error: string }).error);
      }
    } catch (e) {
      console.warn('[approve] edge function invoke threw, using fallback:', e);
    }

    // 2) Fallback: RPC or direct update + isolated signUp (works without edge function)
    const { data: org, error: orgLoadErr } = await sb()
      .from('organizations')
      .select('*')
      .eq('id', args.organizationId)
      .single();
    if (orgLoadErr || !org) throw new Error(orgLoadErr?.message || 'Organisation not found');
    if (org.status === 'Active') throw new Error('Organisation already active');

    let updatedOrg: Organization | null = null;

    try {
      const { data, error } = await sb().rpc('approve_organization', {
        p_org_id: args.organizationId,
        p_approver_name: args.approverName || 'Super Admin',
        p_custom_code: args.customCode ?? null,
      });
      if (!error && data) {
        updatedOrg = (Array.isArray(data) ? data[0] : data) as Organization;
      }
    } catch {
      // RPC missing — fall through
    }

    if (!updatedOrg) {
      let code =
        (args.customCode || '').trim().toUpperCase() ||
        (org.organization_code && !String(org.organization_code).startsWith('PENDING')
          ? org.organization_code
          : generateOrgCode(org.company_name));

      const { data: patched, error: patchErr } = await sb()
        .from('organizations')
        .update({
          status: 'Active',
          organization_code: code,
          approved_at: new Date().toISOString(),
          approved_by: auth.getCurrentUser()?.id ?? null,
        })
        .eq('id', args.organizationId)
        .select('*')
        .single();

      if (patchErr || !patched) {
        throw new Error(
          patchErr?.message ||
            'Could not activate organisation. Ensure you are signed in as super_admin and RLS allows updates.'
        );
      }
      updatedOrg = patched as unknown as Organization;
    }

    const adminEmail = (args.adminEmail || org.email).toLowerCase().trim();
    const adminName = args.adminName || org.owner_name || 'Org Admin';
    const tempPassword =
      args.temporaryPassword ||
      'Uw!' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 4).toUpperCase() + '9';

    let adminUserId: string | null = null;
    let inviteSent = false;

    try {
      const inv = await sb().functions.invoke('invite-staff', {
        body: {
          email: adminEmail,
          name: adminName,
          role: 'admin',
          organizationId: updatedOrg.id,
        },
      });
      if (!inv.error && inv.data && !(inv.data as { error?: string }).error) {
        const d = inv.data as { userId?: string; id?: string };
        adminUserId = d.userId || d.id || null;
        inviteSent = true;
      }
    } catch {
      // ignore — fall through to signUp
    }

    if (!adminUserId) {
      const isolated = anonAuthClient();
      const { data: signed, error: signErr } = await isolated.auth.signUp({
        email: adminEmail,
        password: tempPassword,
        options: {
          data: {
            name: adminName,
            username: adminEmail.split('@')[0],
            role: 'admin',
            status: 'Active',
            organization_id: updatedOrg.id,
          },
        },
      });

      if (signErr) {
        const { data: existing } = await sb()
          .from('profiles')
          .select('id')
          .eq('email', adminEmail)
          .maybeSingle();
        if (existing?.id) {
          adminUserId = existing.id;
        } else {
          throw new Error(
            `Organisation approved (code ${updatedOrg.organization_code}), but admin user could not be created: ${signErr.message}. Create the user from User Directory or ask them to register with ${adminEmail}.`
          );
        }
      } else {
        adminUserId = signed.user?.id ?? null;
      }
    }

    if (!adminUserId) {
      return {
        organizationId: updatedOrg.id,
        organizationCode: updatedOrg.organization_code,
        adminUserId: '',
        inviteSent: false,
        temporaryPassword: tempPassword,
      };
    }

    const { error: profileErr } = await sb().from('profiles').upsert(
      {
        id: adminUserId,
        organization_id: updatedOrg.id,
        role: 'admin',
        name: adminName,
        email: adminEmail,
        username: adminEmail.split('@')[0],
        status: 'Active',
      },
      { onConflict: 'id' }
    );

    if (profileErr) {
      await sb()
        .from('profiles')
        .update({
          organization_id: updatedOrg.id,
          role: 'admin',
          status: 'Active',
          name: adminName,
        })
        .eq('id', adminUserId);
    }

    try {
      await sb().from('notifications').insert({
        user_id: adminUserId,
        role: 'admin',
        organization_id: updatedOrg.id,
        type: 'approval',
        title: 'Welcome to Umhlaba Wami',
        message: `Your organisation ${updatedOrg.company_name} is approved. Org code: ${updatedOrg.organization_code}.`,
        read: false,
      });
    } catch {
      // ignore
    }

    return {
      organizationId: updatedOrg.id,
      organizationCode: updatedOrg.organization_code,
      adminUserId,
      inviteSent,
      temporaryPassword: inviteSent ? undefined : tempPassword,
    };
  },

  async reject(args: {
    organizationId: string;
    approverName: string;
    reason: string;
  }): Promise<void> {
    const rpc = await sb().rpc('reject_organization', {
      p_org_id: args.organizationId,
      p_approver_name: args.approverName,
      p_reason: args.reason,
    });
    if (!rpc.error) return;

    const { error } = await sb()
      .from('organizations')
      .update({ status: 'Rejected' })
      .eq('id', args.organizationId);
    if (error) throw new Error(error.message);
  },
};
