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

  async updateAsAdmin(
    userId: string,
    patch: Partial<Pick<User, 'name' | 'email' | 'phone' | 'role' | 'status' | 'organization_id'>>
  ): Promise<User> {
    const result = await sb().from('profiles').update(patch).eq('id', userId).select().single();
    return unwrap(result) as unknown as User;
  },

  async setRole(userId: string, role: UserRole): Promise<User> {
    const actor = requireUser();
    const { data, error } = await sb().rpc('set_profile_role', {
      p_user_id: userId,
      p_new_role: role,
      p_actor_name: actor.name,
    });
    if (error) throw new Error(error.message);
    return data as unknown as User;
  },

  async setStatus(userId: string, status: string): Promise<User> {
    const actor = requireUser();
    const { data, error } = await sb().rpc('set_profile_status', {
      p_user_id: userId,
      p_new_status: status,
      p_actor_name: actor.name,
    });
    if (error) throw new Error(error.message);
    return data as unknown as User;
  },

  /** Invite staff. Super admin may pass any organizationId. */
  async invite(args: {
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
    organizationId?: string;
  }): Promise<{ userId: string; inviteSent: boolean }> {
    const organizationId =
      args.organizationId ||
      (auth.isSuperAdmin() ? args.organizationId : undefined) ||
      requireOrgId();
    if (!organizationId) throw new Error('Organisation is required to invite a user.');

    const result = await sb().functions.invoke('invite-staff', {
      body: {
        email: args.email,
        name: args.name,
        role: args.role,
        phone: args.phone,
        organizationId,
      },
    });
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.success) throw new Error(result.data?.error || 'Invite failed');
    return result.data;
  },

  async remove(userId: string): Promise<void> {
    const result = await sb()
      .from('profiles')
      .update({ status: 'Inactive' })
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
