import type { User, UserRole, Organization } from '../types';
import { getSupabase, isSupabaseConfigured, tryGetSupabase } from '../lib/supabase';
import { clearAll } from '../lib/queryClient';

class AuthService {
  private currentUser: User | null = null;
  private currentOrg: Organization | null = null;
  private lastNotifiedKey: string | null = null;
  private listeners = new Set<(u: User | null) => void>();
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;

  constructor() {
    this.readyPromise = new Promise((res) => (this.resolveReady = res));
    void this.bootstrap();
  }

  public whenReady(): Promise<void> {
    return this.readyPromise;
  }

  private async bootstrap() {
    try {
      const sb = tryGetSupabase();
      if (!sb) {
        console.warn(
          '[auth] Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel Environment Variables, then redeploy.'
        );
        return;
      }

      const {
        data: { session },
      } = await sb.auth.getSession();
      if (session?.user) await this.loadProfile(session.user.id);

      sb.auth.onAuthStateChange(async (event, session) => {
        // TOKEN_REFRESHED / INITIAL_SESSION fire when switching browser tabs —
        // do NOT reload profile or they remount the whole UI and wipe form state.
        if (event === 'SIGNED_OUT') {
          this.currentUser = null;
          this.currentOrg = null;
          clearAll();
          this.notify(true);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (session?.user) await this.loadProfile(session.user.id);
        }
      });
    } catch (e) {
      console.warn('[auth] bootstrap failed', e);
    } finally {
      this.resolveReady();
    }
  }

  private async loadProfile(userId: string) {
    const sb = tryGetSupabase();
    if (!sb) return;

    const { data: profile, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[auth] profile load failed', error);
      return;
    }
    if (!profile) {
      console.warn('[auth] no profile row for', userId);
      this.currentUser = null;
      this.currentOrg = null;
      this.notify();
      return;
    }
    this.currentUser = profile as unknown as User;
    this.currentOrg = null;

    if (profile.organization_id) {
      const { data: org } = await sb
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .maybeSingle();
      this.currentOrg = (org as unknown as Organization) || null;
    }

    // Recover org context if profile was left unlinked after approval
    if (!this.currentOrg && profile.email) {
      const { data: byOwner } = await sb
        .from('organizations')
        .select('*')
        .eq('owner_auth_user_id', userId)
        .maybeSingle();
      if (byOwner) {
        this.currentOrg = byOwner as unknown as Organization;
      } else {
        const { data: byEmail } = await sb
          .from('organizations')
          .select('*')
          .ilike('email', String(profile.email))
          .eq('status', 'Active')
          .maybeSingle();
        if (byEmail) this.currentOrg = byEmail as unknown as Organization;
      }
      // Heal profile.organization_id so RLS current_org_id() works
      if (this.currentOrg) {
        const orgId = this.currentOrg.id;
        await sb
          .from('profiles')
          .update({
            organization_id: orgId,
            role: profile.role === 'super_admin' ? profile.role : (profile.role || 'admin'),
            status: 'Active',
          })
          .eq('id', userId);
        this.currentUser = {
          ...(this.currentUser as User),
          organization_id: orgId,
        };
      }
    }
    this.notify();
  }

  public subscribe(listener: (u: User | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(force = false) {
    const key = this.currentUser
      ? `${this.currentUser.id}|${this.currentUser.role}|${this.currentUser.organization_id || ''}|${this.currentUser.status || ''}`
      : 'null';
    if (!force && key === this.lastNotifiedKey) return;
    this.lastNotifiedKey = key;
    this.listeners.forEach((l) => l(this.currentUser));
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }
  public getCurrentOrganization(): Organization | null {
    return this.currentOrg;
  }
  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  private requireSupabase() {
    if (!isSupabaseConfigured()) {
      return {
        ok: false as const,
        error:
          'Backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel project settings and redeploy.',
      };
    }
    return { ok: true as const, sb: getSupabase() };
  }

  public async login(
    organizationCode: string,
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    const cfg = this.requireSupabase();
    if (!cfg.ok) return { success: false, error: cfg.error };
    const sb = cfg.sb;

    const code = organizationCode.trim().toUpperCase();
    const identifier = username.trim().toLowerCase();

    // Platform super-admin path: code SUPER / PLATFORM / ADMIN
    if (['SUPER', 'PLATFORM', 'ADMIN'].includes(code)) {
      const emailGuess = identifier.includes('@') ? identifier : null;
      if (emailGuess) {
        const { error: signErr } = await sb.auth.signInWithPassword({
          email: emailGuess,
          password,
        });
        if (signErr) return { success: false, error: signErr.message };
        await new Promise((r) => setTimeout(r, 250));
        if (this.currentUser?.role === 'super_admin') {
          return { success: true, user: this.currentUser };
        }
        // If signed in but not super_admin, still return success — profile load is source of truth
        return { success: true, user: this.currentUser || undefined };
      }
    }

    const { data: org, error: orgErr } = await sb.rpc('lookup_organization', { p_code: code });
    if (orgErr) return { success: false, error: orgErr.message };
    if (!org) return { success: false, error: 'Organisation code not found.' };

    const orgRow = Array.isArray(org) ? org[0] : org;
    if (orgRow.status !== 'Active') {
      return { success: false, error: `Organisation is ${orgRow.status}.` };
    }

    const { data: emailResult, error: resolveErr } = await sb.rpc('resolve_login_email', {
      p_org_code: code,
      p_identifier: identifier,
    });
    if (resolveErr) return { success: false, error: resolveErr.message };
    const email = emailResult as string | null;
    if (!email) return { success: false, error: 'User not found for this organisation.' };

    const { error: signErr } = await sb.auth.signInWithPassword({ email, password });
    if (signErr) return { success: false, error: signErr.message };

    await new Promise((r) => setTimeout(r, 200));
    return { success: true, user: this.currentUser || undefined };
  }

  public async logout() {
    const sb = tryGetSupabase();
    if (sb) {
      try {
        await sb.auth.signOut();
      } catch (e) {
        console.warn('[auth] signOut failed', e);
      }
    }
    this.currentUser = null;
    this.currentOrg = null;
    clearAll();
    this.notify(true);
  }

  // ----- role helpers (super_admin has every capability) -----
  public isSuperAdmin(u = this.currentUser): boolean {
    return u?.role === 'super_admin';
  }

  public canCreateTicket(u = this.currentUser) {
    if (this.isSuperAdmin(u)) return true;
    return !!u && ['tenant', 'property_manager', 'admin'].includes(u.role);
  }
  public canAssignTicket(u = this.currentUser) {
    if (this.isSuperAdmin(u)) return true;
    return !!u && ['property_manager', 'admin'].includes(u.role);
  }
  public canManageProperties(u = this.currentUser) {
    if (this.isSuperAdmin(u)) return true;
    return !!u && ['property_manager', 'admin'].includes(u.role);
  }
  public canManageUsers(u = this.currentUser) {
    if (this.isSuperAdmin(u)) return true;
    return !!u && u.role === 'admin';
  }
  public canAccessFinancials(u = this.currentUser) {
    if (this.isSuperAdmin(u)) return true;
    return !!u && ['property_manager', 'finance', 'admin'].includes(u.role);
  }
  public canApproveOrganizations(u = this.currentUser) {
    return this.isSuperAdmin(u);
  }
  public canManageSubscriptions(u = this.currentUser) {
    return this.isSuperAdmin(u);
  }
  public canManagePublicListings(u = this.currentUser) {
    if (this.isSuperAdmin(u)) return true;
    return !!u && u.role === 'admin';
  }
  /** Super admin may act across any organisation and any module. */
  public canAccessEverything(u = this.currentUser) {
    return this.isSuperAdmin(u);
  }
  public canManageAnyUser(u = this.currentUser) {
    return this.isSuperAdmin(u);
  }
  public canChangeAnyRole(u = this.currentUser) {
    return this.isSuperAdmin(u);
  }
}

export const auth = new AuthService();
