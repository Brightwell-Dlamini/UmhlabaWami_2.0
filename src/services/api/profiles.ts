import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type { User, UserRole } from '../../types';
import { auth } from '../auth';

export const profiles = {
  /** List profiles for one organisation (org admin / manager scope). */
  async list(orgId = requireOrgId()): Promise<User[]> {
    const result = await sb()
      .from('profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as User[];
  },

  /** Platform-wide directory — intended for super_admin (RLS must allow). */
  async listAll(): Promise<User[]> {
    const result = await sb()
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as User[];
  },

  async listByOrg(orgId: string): Promise<User[]> {
    const result = await sb()
      .from('profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as User[];
  },

  async get(id: string): Promise<User> {
    const result = await sb().from('profiles').select('*').eq('id', id).single();
    return unwrap(result) as unknown as User;
  },

  async me(): Promise<User | null> {
    const {
      data: { user },
    } = await sb().auth.getUser();
    if (!user) return null;
    const result = await sb().from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result.data as unknown as User | null;
  },

  async updateSelf(patch: Partial<Pick<User, 'name' | 'phone' | 'avatar_url'>>) {
    const {
      data: { user },
    } = await sb().auth.getUser();
    if (!user) throw new Error('Not authenticated.');
    const result = await sb().from('profiles').update(patch).eq('id', user.id).select().single();
    return unwrap(result) as unknown as User;
  },

  /**
   * Full admin update of any profile fields.
   * Super admin (and RLS) can change any user; org admins limited by RLS.
   */
  async updateAsAdmin(
    userId: string,
    patch: Partial<
      Pick<User, 'name' | 'email' | 'phone' | 'role' | 'status' | 'organization_id' | 'username'>
    >
  ): Promise<User> {
    const result = await sb().from('profiles').update(patch).eq('id', userId).select().single();
    return unwrap(result) as unknown as User;
  },

  /**
   * Change role. Prefers RPC (audit trail) when present; falls back to direct
   * update so super_admin always works even if the RPC is missing in the DB.
   */
  async setRole(userId: string, role: UserRole): Promise<User> {
    const actor = requireUser();
    try {
      const { data, error } = await sb().rpc('set_profile_role', {
        p_user_id: userId,
        p_new_role: role,
        p_actor_name: actor.name,
      });
      if (!error && data) return data as unknown as User;
    } catch {
      // RPC may not exist — fall through
    }
    // Direct update (RLS allows super_admin and same-org admin)
    const result = await sb()
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();
    return unwrap(result) as unknown as User;
  },

  /**
   * Change status. Same robust pattern as setRole.
   */
  async setStatus(userId: string, status: string): Promise<User> {
    const actor = requireUser();
    try {
      const { data, error } = await sb().rpc('set_profile_status', {
        p_user_id: userId,
        p_new_status: status,
        p_actor_name: actor.name,
      });
      if (!error && data) return data as unknown as User;
    } catch {
      // RPC may not exist — fall through
    }
    const result = await sb()
      .from('profiles')
      .update({ status })
      .eq('id', userId)
      .select()
      .single();
    return unwrap(result) as unknown as User;
  },

  /**
   * Invite staff. Super admin may pass any organizationId, or omit it for a
   * platform-level user (no org). Org admins always require their own org.
   */
  async invite(args: {
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
    organizationId?: string | null;
  }): Promise<{ userId: string; inviteSent: boolean }> {
    const isSuper = auth.isSuperAdmin();
    let organizationId: string | null | undefined = args.organizationId;

    if (!isSuper) {
      organizationId = organizationId || requireOrgId();
    }
    // Super admin may intentionally invite with no org (platform user)
    if (!isSuper && !organizationId) {
      throw new Error('Organisation is required to invite a user.');
    }

    const result = await sb().functions.invoke('invite-staff', {
      body: {
        email: args.email,
        name: args.name,
        role: args.role,
        phone: args.phone,
        organizationId: organizationId || null,
      },
    });
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.success) throw new Error(result.data?.error || 'Invite failed');
    return result.data;
  },

  /** Soft-deactivate (status → Inactive). */
  async remove(userId: string): Promise<void> {
    const result = await sb()
      .from('profiles')
      .update({ status: 'Inactive' })
      .eq('id', userId)
      .select()
      .single();
    unwrap(result);
  },

  /**
   * Super-admin only: hard-clear organization link and set Inactive.
   * Does not delete the auth user (that requires service role).
   */
  async purge(userId: string): Promise<void> {
    if (!auth.isSuperAdmin()) throw new Error('Only super admin can purge users.');
    const result = await sb()
      .from('profiles')
      .update({ status: 'Inactive', organization_id: null })
      .eq('id', userId)
      .select()
      .single();
    unwrap(result);
  },

  async assignOrganization(userId: string, organizationId: string | null): Promise<User> {
    const result = await sb()
      .from('profiles')
      .update({ organization_id: organizationId })
      .eq('id', userId)
      .select()
      .single();
    return unwrap(result) as unknown as User;
  },
};
