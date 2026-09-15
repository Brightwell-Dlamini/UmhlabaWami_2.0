import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type { User, UserRole } from '../../types';
import { auth } from '../auth';

export const profiles = {
  async list(orgId = requireOrgId()): Promise<User[]> {
    const result = await sb()
      .from('profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as User[];
  },

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
    patch: Partial<
      Pick<User, 'name' | 'email' | 'phone' | 'role' | 'status' | 'organization_id' | 'username'>
    >
  ): Promise<User> {
    const result = await sb().from('profiles').update(patch).eq('id', userId).select().single();
    return unwrap(result) as unknown as User;
  },

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
      // fall through
    }
    const result = await sb()
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();
    return unwrap(result) as unknown as User;
  },

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
      /* fall through */
    }
    if (status === 'Active') {
      try {
        const { data, error } = await sb().rpc('activate_profile', {
          p_user_id: userId,
          p_actor_name: actor.name,
        });
        if (!error && data) return data as unknown as User;
      } catch {
        /* fall through */
      }
    }
    const result = await sb().from('profiles').update({ status }).eq('id', userId).select().single();
    return unwrap(result) as unknown as User;
  },

  async activate(userId: string): Promise<User> {
    return this.setStatus(userId, 'Active');
  },

 async invite(args: {
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
}): Promise<{ userId: string; inviteSent: boolean }> {
  const result = await sb().functions.invoke('invite-staff', {
    body: {
      ...args,
      organizationId: requireOrgId(),
      appUrl: window.location.origin,
    },
  });
  if (result.error) throw new Error(result.error.message);
  if (!result.data?.success) throw new Error(result.data?.error || 'Invite failed');
  return result.data;
}
    const { createClient } = await import('@supabase/supabase-js');
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const isolated = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const tempPassword =
      'Uw!' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 4).toUpperCase() + '9';

    const { data: signed, error: signErr } = await isolated.auth.signUp({
      email: args.email.toLowerCase(),
      password: tempPassword,
      options: {
        data: {
          name: args.name,
          username: args.email.split('@')[0],
          role: args.role,
          phone: args.phone,
          status: 'Active',
          organization_id: organizationId || null,
        },
      },
    });

    if (signErr) throw new Error(signErr.message);
    const userId = signed.user?.id;
    if (!userId) throw new Error('Could not create auth user');

    await sb().from('profiles').upsert(
      {
        id: userId,
        email: args.email.toLowerCase(),
        name: args.name,
        username: args.email.split('@')[0],
        role: args.role,
        phone: args.phone ?? null,
        organization_id: organizationId || null,
        status: 'Active',
      },
      { onConflict: 'id' }
    );

    return { userId, inviteSent: false, temporaryPassword: tempPassword };
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
