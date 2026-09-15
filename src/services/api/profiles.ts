import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type { User, UserRole } from '../../types';

export interface InviteUserInput {
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  organizationId?: string | null;
}

export const profiles = {
  async list(orgId = requireOrgId()): Promise<User[]> {
    const result = await sb()
      .from('profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('name', { ascending: true });
    return unwrap(result) as unknown as User[];
  },

  async listAll(): Promise<User[]> {
    const result = await sb()
      .from('profiles')
      .select('*')
      .order('name', { ascending: true });
    return unwrap(result) as unknown as User[];
  },

  async get(id: string): Promise<User> {
    const result = await sb().from('profiles').select('*').eq('id', id).single();
    return unwrap(result) as unknown as User;
  },

  async updateAsAdmin(
    userId: string,
    patch: Partial<{
      name: string;
      email: string;
      phone: string;
      role: UserRole;
      status: string;
      organization_id: string | null;
      username: string;
    }>
  ): Promise<User> {
    const result = await sb()
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('*')
      .single();
    return unwrap(result) as unknown as User;
  },

  async setRole(userId: string, role: UserRole): Promise<User> {
    const { data, error } = await sb().rpc('set_profile_role', {
      p_user_id: userId,
      p_role: role,
    });
    if (error) {
      // fallback for super_admin when RPC missing
      const result = await sb()
        .from('profiles')
        .update({ role })
        .eq('id', userId)
        .select('*')
        .single();
      return unwrap(result) as unknown as User;
    }
    return (Array.isArray(data) ? data[0] : data) as unknown as User;
  },

  async setStatus(userId: string, status: string): Promise<User> {
    const { data, error } = await sb().rpc('set_profile_status', {
      p_user_id: userId,
      p_status: status,
    });
    if (error) {
      const result = await sb()
        .from('profiles')
        .update({ status })
        .eq('id', userId)
        .select('*')
        .single();
      return unwrap(result) as unknown as User;
    }
    return (Array.isArray(data) ? data[0] : data) as unknown as User;
  },

  async activate(userId: string): Promise<User> {
    const { data, error } = await sb().rpc('activate_profile', {
      p_user_id: userId,
      p_actor_name: requireUser().name,
    });
    if (error) {
      return this.setStatus(userId, 'Active');
    }
    return (Array.isArray(data) ? data[0] : data) as unknown as User;
  },

  async invite(input: InviteUserInput): Promise<{ userId?: string; inviteSent?: boolean }> {
    const orgId = input.organizationId !== undefined ? input.organizationId : requireOrgId();
    try {
      const result = await sb().functions.invoke('invite-staff', {
        body: {
          email: input.email.trim().toLowerCase(),
          name: input.name,
          role: input.role,
          phone: input.phone,
          organizationId: orgId,
        },
      });
      if (result.error) throw new Error(result.error.message);
      if (result.data?.error) throw new Error(result.data.error);
      return {
        userId: result.data?.userId || result.data?.id,
        inviteSent: result.data?.inviteSent ?? true,
      };
    } catch (e) {
      // Client-side fallback is intentionally limited; prefer edge function
      throw e instanceof Error ? e : new Error(String(e));
    }
  },

  async purge(userId: string): Promise<void> {
    const { error } = await sb().from('profiles').delete().eq('id', userId);
    if (error) throw new Error(error.message);
  },

  async remove(userId: string): Promise<void> {
    return this.purge(userId);
  },
};
