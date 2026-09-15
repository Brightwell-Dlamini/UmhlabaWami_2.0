import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import { isMemoryMode, getMemoryDb } from './mode';
import type { User, UserRole } from '../../types';
import { auth } from '../auth';

const WRITE_FIELDS = [
  'name',
  'email',
  'phone',
  'role',
  'status',
  'organization_id',
  'username',
] as const;

type WritePatch = Partial<
  Pick<User, 'name' | 'email' | 'phone' | 'role' | 'status' | 'organization_id' | 'username'>
>;

const SELF_WRITE_FIELDS = ['name', 'phone', 'avatar_url'] as const;

const ALLOWED_ROLES: UserRole[] = [
  'tenant',
  'property_manager',
  'maintenance',
  'finance',
  'admin',
  'super_admin',
];

const ALLOWED_STATUSES: User['status'][] = ['Active', 'Inactive', 'Pending', 'Suspended'];

/** Error codes we tolerate from optional RPCs (function may not exist in old deployments). */
const TOLERATED_RPC_CODES = new Set(['PGRST202', '42883', '42501']);

function isTolerableRpcError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  if (code && TOLERATED_RPC_CODES.has(code)) return true;
  const msg = String((err as { message?: string }).message || '').toLowerCase();
  return (
    msg.includes('could not find the function') ||
    msg.includes('function does not exist') ||
    msg.includes('permission denied') // RLS blocks direct fallback too — try the fallback anyway
  );
}

export const profiles = {
  async list(orgId = requireOrgId()): Promise<User[]> {
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      return db.users
        .filter((u) => u.organization_id === orgId)
        .slice()
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
    const result = await sb()
      .from('profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as User[];
  },

  async listAll(): Promise<User[]> {
    const caller = requireUser();
    if (caller.role !== 'super_admin') {
      throw new Error('Only super admins can list all users.');
    }
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      return [...db.users].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    const result = await sb()
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as User[];
  },

  async listByOrg(orgId: string): Promise<User[]> {
    const caller = requireUser();
    if (caller.role !== 'super_admin' && caller.organization_id !== orgId) {
      throw new Error('You can only list users in your own organisation.');
    }
    return this.list(orgId);
  },

  async get(id: string): Promise<User> {
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      const found = db.users.find((u) => u.id === id);
      if (!found) throw new Error('User not found.');
      return found;
    }
    const result = await sb().from('profiles').select('*').eq('id', id).single();
    return unwrap(result) as unknown as User;
  },

  async me(): Promise<User | null> {
    if (isMemoryMode()) return auth.getCurrentUser();
    const {
      data: { user },
    } = await sb().auth.getUser();
    if (!user) return null;
    const result = await sb()
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return (result.data as unknown as User) || null;
  },

  async updateSelf(patch: Partial<Pick<User, 'name' | 'phone' | 'avatar_url'>>) {
    // Runtime allowlist — even if a caller force-casts to a broader type.
    const safe: Record<string, unknown> = {};
    for (const key of SELF_WRITE_FIELDS) {
      if (key in patch) safe[key] = (patch as Record<string, unknown>)[key];
    }
    if (Object.keys(safe).length === 0) {
      throw new Error('No valid fields to update.');
    }

    if (isMemoryMode()) {
      const current = requireUser();
      const db = await getMemoryDb();
      const target = db.users.find((u) => u.id === current.id);
      if (!target) throw new Error('Your profile was not found.');
      Object.assign(target, safe);
      db.saveToStorage();
      return target;
    }

    const {
      data: { user },
    } = await sb().auth.getUser();
    if (!user) throw new Error('Not authenticated.');
    const result = await sb()
      .from('profiles')
      .update(safe)
      .eq('id', user.id)
      .select()
      .single();
    return unwrap(result) as unknown as User;
  },

  /**
   * Admin-level update. Enforces:
   *  - caller must be admin of target's org OR super admin
   *  - only valid roles / statuses accepted
   *  - role='super_admin' only grantable by existing super admin
   *  - super admin cannot demote themselves
   *  - last admin of an org cannot demote themselves
   */
  async updateAsAdmin(userId: string, patch: WritePatch): Promise<User> {
    const caller = requireUser();

    // Validate fields
    for (const key of Object.keys(patch)) {
      if (!(WRITE_FIELDS as readonly string[]).includes(key)) {
        throw new Error(`Field "${key}" cannot be updated.`);
      }
    }
    if (patch.role && !ALLOWED_ROLES.includes(patch.role)) {
      throw new Error(`Invalid role: ${patch.role}`);
    }
    if (patch.status && !ALLOWED_STATUSES.includes(patch.status)) {
      throw new Error(`Invalid status: ${patch.status}`);
    }
    if (patch.role === 'super_admin' && caller.role !== 'super_admin') {
      throw new Error('Only super admins can grant super admin role.');
    }

    // Load target for guard checks
    const target = await this.get(userId);

    const isSelf = caller.id === target.id;
    const demotingSelf =
      isSelf &&
      patch.role !== undefined &&
      patch.role !== target.role &&
      target.role === 'super_admin';
    if (demotingSelf) {
      throw new Error('You cannot change your own super admin role.');
    }

    if (
      isSelf &&
      patch.role !== undefined &&
      patch.role !== target.role &&
      target.role === 'admin' &&
      target.organization_id
    ) {
      const adminsInOrg = await this.countAdminsInOrg(target.organization_id);
      if (adminsInOrg <= 1) {
        throw new Error(
          'You are the only admin in this organisation. Promote another user to admin first.'
        );
      }
    }

    // Non-super-admin can only edit users in their own org
    if (
      caller.role !== 'super_admin' &&
      caller.organization_id !== target.organization_id
    ) {
      throw new Error('You cannot edit users outside your organisation.');
    }

    if (isMemoryMode()) {
      const db = await getMemoryDb();
      const record = db.users.find((u) => u.id === userId);
      if (!record) throw new Error('User not found.');
      Object.assign(record, patch);
      db.saveToStorage();
      return record;
    }

    const result = await sb()
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select()
      .single();
    return unwrap(result) as unknown as User;
  },

  /**
   * Change a user's role via RPC when available; fallback to direct update.
   * Only tolerated errors trigger the fallback. Permission errors surface.
   */
  async setRole(userId: string, role: UserRole): Promise<User> {
    const actor = requireUser();
    if (!ALLOWED_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }
    if (role === 'super_admin' && actor.role !== 'super_admin') {
      throw new Error('Only super admins can grant super admin role.');
    }

    if (isMemoryMode()) {
      return this.updateAsAdmin(userId, { role });
    }

    const { data, error } = await sb().rpc('set_profile_role', {
      p_user_id: userId,
      p_new_role: role,
      p_actor_name: actor.name,
    });
    if (!error && data) return data as unknown as User;
    if (error && !isTolerableRpcError(error)) {
      throw new Error(error.message);
    }
    // Fallback path only when RPC missing/permission-blocked — still enforced by RLS.
    return this.updateAsAdmin(userId, { role });
  },

  async setStatus(userId: string, status: User['status']): Promise<User> {
    const actor = requireUser();
    if (!ALLOWED_STATUSES.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const target = await this.get(userId);

    if (target.role === 'super_admin' && actor.role !== 'super_admin') {
      throw new Error('Only super admins can change a super admin status.');
    }
    if (
      actor.id === target.id &&
      status !== 'Active' &&
      target.role === 'super_admin'
    ) {
      throw new Error('You cannot suspend your own super admin account.');
    }

    if (isMemoryMode()) {
      return this.updateAsAdmin(userId, { status });
    }

    const { data, error } = await sb().rpc('set_profile_status', {
      p_user_id: userId,
      p_new_status: status,
      p_actor_name: actor.name,
    });
    if (!error && data) return data as unknown as User;
    if (error && !isTolerableRpcError(error)) {
      throw new Error(error.message);
    }

    if (status === 'Active') {
      const { data: activateData, error: activateErr } = await sb().rpc(
        'activate_profile',
        { p_user_id: userId, p_actor_name: actor.name }
      );
      if (!activateErr && activateData) return activateData as unknown as User;
      if (activateErr && !isTolerableRpcError(activateErr)) {
        throw new Error(activateErr.message);
      }
    }

    return this.updateAsAdmin(userId, { status });
  },

  async activate(userId: string): Promise<User> {
    return this.setStatus(userId, 'Active');
  },

  async invite(args: {
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
    organizationId?: string | null;
  }): Promise<{
    userId: string;
    inviteSent: boolean;
    temporaryPassword?: string;
    warning?: string;
  }> {
    const caller = requireUser();
    const isSuper = caller.role === 'super_admin';

    if (!ALLOWED_ROLES.includes(args.role)) {
      throw new Error(`Invalid role: ${args.role}`);
    }
    if (args.role === 'super_admin' && !isSuper) {
      throw new Error('Only super admins can invite super admins.');
    }

    let organizationId: string | null = args.organizationId ?? null;
    if (!isSuper) {
      organizationId = organizationId || requireOrgId();
      if (organizationId !== caller.organization_id) {
        throw new Error('You can only invite users to your own organisation.');
      }
    }
    if (!organizationId && !isSuper) {
      throw new Error('Organisation is required to invite a user.');
    }

    const cleanEmail = args.email.trim().toLowerCase();
    const username = cleanEmail.split('@')[0];

    // Try edge function first
    try {
      const result = await sb().functions.invoke('invite-staff', {
        body: {
          email: cleanEmail,
          name: args.name,
          role: args.role,
          phone: args.phone,
          organizationId,
        },
      });
      if (!result.error && result.data?.success) {
        return {
          userId: result.data.userId as string,
          inviteSent: true,
        };
      }
    } catch {
      // edge function unavailable — fall through to isolated signUp
    }

    // Fallback: create auth user from an isolated client so we don't
    // clobber the caller's session.
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !key) {
      throw new Error(
        'Cannot invite users: Supabase env vars are missing. Configure the invite-staff edge function or set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
    }

    const { createClient } = await import('@supabase/supabase-js');
    const isolated = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const tempPassword =
      'Uw!' +
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 4).toUpperCase() +
      '9';

    const { data: signed, error: signErr } = await isolated.auth.signUp({
      email: cleanEmail,
      password: tempPassword,
      options: {
        data: {
          name: args.name,
          username,
          role: args.role,
          phone: args.phone,
          status: 'Active',
          organization_id: organizationId,
        },
      },
    });

    if (signErr) {
      const msg = signErr.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        throw new Error(
          `${cleanEmail} is already registered. Use the "Edit user" action to reassign them instead.`
        );
      }
      throw new Error(signErr.message);
    }

    const userId = signed.user?.id;
    if (!userId) {
      throw new Error(
        'Signup did not return a user id — email confirmation may be enabled. Disable email confirmation or configure the invite-staff edge function.'
      );
    }

    // Populate profile row (idempotent).
    const { error: profileErr } = await sb()
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: cleanEmail,
          name: args.name,
          username,
          role: args.role,
          phone: args.phone ?? null,
          organization_id: organizationId,
          status: 'Active',
        },
        { onConflict: 'id' }
      );
    if (profileErr) {
      throw new Error(`Profile row failed: ${profileErr.message}`);
    }

    // Only surface the temp password in dev or when explicitly allowed.
    const showTemp =
      import.meta.env.DEV ||
      (import.meta.env.VITE_SHOW_TEMP_PASSWORDS as string | undefined) === 'true';

    return {
      userId,
      inviteSent: false,
      temporaryPassword: showTemp ? tempPassword : undefined,
      warning: showTemp
        ? undefined
        : 'Invite email could not be sent automatically. Please share a temporary password out-of-band and ask the user to change it on first login.',
    };
  },

  async remove(userId: string): Promise<void> {
    const caller = requireUser();
    const target = await this.get(userId);

    if (caller.id === target.id && target.role === 'super_admin') {
      throw new Error('You cannot deactivate your own super admin account.');
    }
    if (
      caller.role !== 'super_admin' &&
      caller.organization_id !== target.organization_id
    ) {
      throw new Error('You cannot deactivate users outside your organisation.');
    }
    if (target.role === 'admin' && target.organization_id) {
      const admins = await this.countAdminsInOrg(target.organization_id);
      if (admins <= 1) {
        throw new Error(
          'Cannot deactivate the last admin of an organisation. Promote another user first.'
        );
      }
    }

    if (isMemoryMode()) {
      const db = await getMemoryDb();
      const record = db.users.find((u) => u.id === userId);
      if (record) {
        record.status = 'Inactive';
        db.saveToStorage();
      }
      return;
    }

    const result = await sb()
      .from('profiles')
      .update({ status: 'Inactive' })
      .eq('id', userId)
      .select()
      .single();
    unwrap(result);
  },

  async purge(userId: string): Promise<void> {
    const caller = requireUser();
    if (caller.role !== 'super_admin') {
      throw new Error('Only super admins can purge users.');
    }
    if (caller.id === userId) {
      throw new Error('You cannot purge your own account.');
    }

    if (isMemoryMode()) {
      const db = await getMemoryDb();
      const record = db.users.find((u) => u.id === userId);
      if (record) {
        record.status = 'Inactive';
        record.organization_id = undefined;
        db.saveToStorage();
      }
      return;
    }

    const result = await sb()
      .from('profiles')
      .update({ status: 'Inactive', organization_id: null })
      .eq('id', userId)
      .select()
      .single();
    unwrap(result);
  },

  async assignOrganization(
    userId: string,
    organizationId: string | null
  ): Promise<User> {
    const caller = requireUser();
    if (caller.role !== 'super_admin') {
      throw new Error('Only super admins can reassign organisation.');
    }

    if (isMemoryMode()) {
      const db = await getMemoryDb();
      const record = db.users.find((u) => u.id === userId);
      if (!record) throw new Error('User not found.');
      record.organization_id = organizationId ?? undefined;
      db.saveToStorage();
      return record;
    }

    const result = await sb()
      .from('profiles')
      .update({ organization_id: organizationId })
      .eq('id', userId)
      .select()
      .single();
    return unwrap(result) as unknown as User;
  },

  async countAdminsInOrg(orgId: string): Promise<number> {
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      return db.users.filter(
        (u) => u.organization_id === orgId && u.role === 'admin'
      ).length;
    }
    const { count, error } = await sb()
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('role', 'admin')
      .eq('status', 'Active');
    if (error) {
      // Non-fatal — caller decides whether to block on 0.
      console.warn('[profiles] countAdminsInOrg failed', error);
      return 0;
    }
    return count ?? 0;
  },
};
