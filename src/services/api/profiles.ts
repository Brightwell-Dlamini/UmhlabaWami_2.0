import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type { User, UserRole } from '../../types';

export const profiles = {
  async list(orgId = requireOrgId()): Promise<User[]> {
    const result = await sb()
      .from('profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as User[];
  },

  async get(id: string): Promise<User> {
    const result = await sb()
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    return unwrap(result) as unknown as User;
  },

  async me(): Promise<User | null> {
    const { data: { user } } = await sb().auth.getUser();
    if (!user) return null;
    const result = await sb()
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result.data as unknown as User | null;
  },

  async updateSelf(patch: Partial<Pick<User, 'name' | 'phone' | 'avatar_url'>>) {
    const { data: { user } } = await sb().auth.getUser();
    if (!user) throw new Error('Not authenticated.');
    const result = await sb()
      .from('profiles')
      .update(patch)
      .eq('id', user.id)
      .select()
      .single();
    return unwrap(result) as unknown as User;
  },

  async updateAsAdmin(
    userId: string,
    patch: Partial<Pick<User, 'name' | 'email' | 'phone' | 'role' | 'status'>>
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

  /** Invite a new staff member via Edge Function (creates auth user + profile). */
  async invite(args: {
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
  }): Promise<{ userId: string; inviteSent: boolean }> {
    const result = await sb().functions.invoke('invite-staff', {
      body: { ...args, organizationId: requireOrgId() },
    });
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.success) throw new Error(result.data?.error || 'Invite failed');
    return result.data;
  },

  async remove(userId: string): Promise<void> {
    // Deleting the auth user requires the Edge Function; for now we just
    // detach the profile from the org (soft removal). Full deletion is
    // handled by a `delete-staff` Edge Function (add when needed).
    const result = await sb()
      .from('profiles')
      .update({ status: 'Inactive' })
      .eq('id', userId)
      .select()
      .single();
    unwrap(result);
  },
};
