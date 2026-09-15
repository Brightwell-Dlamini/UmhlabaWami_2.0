import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type { User, UserRole } from '../../types';
import { auth } from '../auth';

export const profiles = {
  /** Org-scoped staff list. */
  async list(orgId?: string): Promise<User[]> {
    const oid = orgId || requireOrgId();
    const result = await sb()
      .from('profiles')
      .select('*')
      .eq('organization_id', oid)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as User[];
  },

  /** Platform-wide directory — super_admin only (RLS enforced). */
  async listAll(): Promise<User[]> {
    const result = await sb()
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as User[];
  },

  async get(id: string): Promise<User> {
    const result = await sb().from('profiles').select('*').eq('id', id).single();
    return unwrap(result) as unknown as User;
  },

  async updateSelf(patch: Partial<Pick<User, 'name' | 'phone' | 'avatar_url'>>): Promise<User> {
    const me = requireUser();
    const result = await sb()
      .from('profiles')
      .update(patch)
      .eq('id', me.id)
      .select()
      .single();
    return unwrap(result) as unknown as User;
  },

  /**
   * Full admin edit — any field including role, status, organisation.
   * Super admin can edit anyone; org admin limited by RLS.
   */
  async updateAsAdmin(
    userId: string,
    patch: Partial<
      Pick<User, 'name' | 'phone' | 'email' | 'username' | 'role' | 'status' | 'organization_id' | 'avatar_url'>
    >
  ): Promise<User> {
    const result = await sb()
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select()
      .single();
    return unwrap(result) as unknown as User;
  },

  async setRole(userId: string, role: UserRole): Promise<User> {
    // Prefer RPC if present; fall back to direct update (super_admin RLS allows it)
    const { data, error } = await sb().rpc('set_profile_role', {
      p_user_id: userId,
      p_role: role,
    });
    if (!error && data) return data as unknown as User;

    const result = await sb()
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();
    return unwrap(result) as unknown as User;
  },

  async setStatus(userId: string, status: User['status']): Promise<User> {
    const { data, error } = await sb().rpc('set_profile_status', {
      p_user_id: userId,
      p_status: status,
    });
    if (!error && data) return data as unknown as User;

    const result = await sb()
      .from('profiles')
      .update({ status })
      .eq('id', userId)
      .select()
      .single();
    return unwrap(result) as unknown as User;
  },

  /**
   * Invite a user.
   * - Org staff: pass organizationId (or omit to use current org).
   * - Platform user (super_admin only): pass organizationId: null.
   */
  async invite(args: {
    email: string;
    name: string;
    role: UserRole;
    organizationId?: string | null;
  }): Promise<{ userId: string; temporaryPassword?: string }> {
    const body: Record<string, unknown> = {
      email: args.email,
      name: args.name,
      role: args.role,
    };
    if (args.organizationId === null) {
      body.organizationId = null;
    } else if (args.organizationId) {
      body.organizationId = args.organizationId;
    } else {
      body.organizationId = requireOrgId();
    }

    const result = await sb().functions.invoke('invite-staff', { body });
    if (result.error) throw new Error(result.error.message);
    if (result.data?.error) throw new Error(result.data.error);
    return result.data;
  },

  /** Soft-remove from org (clears organization_id, keeps auth account). */
  async removeFromOrg(userId: string): Promise<void> {
    const { error } = await sb()
      .from('profiles')
      .update({ organization_id: null, status: 'Inactive' })
      .eq('id', userId);
    if (error) throw new Error(error.message);
  },

  /** Hard-delete profile row (super_admin). Auth user may remain. */
  async purge(userId: string): Promise<void> {
    const { error } = await sb().from('profiles').delete().eq('id', userId);
    if (error) throw new Error(error.message);
  },
};
