import type { User, UserRole, Organization } from '../types';
import { getSupabase } from '../lib/supabase';
import { clearAll } from '../lib/queryClient';

class AuthService {
  private currentUser: User | null = null;
  private currentOrg: Organization | null = null;
  private listeners = new Set<(u: User | null) => void>();
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;

  constructor() {
    this.readyPromise = new Promise((res) => (this.resolveReady = res));
    void this.bootstrap();
  }

  /** Resolves once the initial session + profile load finishes. */
  public whenReady(): Promise<void> {
    return this.readyPromise;
  }

  private async bootstrap() {
    const sb = getSupabase();
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) await this.loadProfile(session.user.id);
    } catch (e) {
      console.warn('[auth] session restore failed', e);
    }

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.currentOrg = null;
        clearAll();
        this.notify();
        return;
      }
      if (session?.user) {
        await this.loadProfile(session.user.id);
      }
    });

    this.resolveReady();
  }

  private async loadProfile(userId: string) {
    const sb = getSupabase();
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
    this.notify();
  }

  public subscribe(listener: (u: User | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l(this.currentUser));
  }

  public getCurrentUser(): User | null { return this.currentUser; }
  public getCurrentOrganization(): Organization | null { return this.currentOrg; }
  public isAuthenticated(): boolean { return this.currentUser !== null; }

  /**
   * Login with organisation code + username + password.
   * The username may be either a username or an email.
   */
  public async login(
    organizationCode: string,
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    const sb = getSupabase();
    const code = organizationCode.trim().toUpperCase();
    const identifier = username.trim().toLowerCase();

    // 1) Resolve organisation (public lookup via SECURITY DEFINER function)
    const { data: org, error: orgErr } = await sb.rpc('lookup_organization', { p_code: code });
    if (orgErr) return { success: false, error: orgErr.message };
    if (!org) return { success: false, error: 'Organisation code not found.' };

    const orgRow = Array.isArray(org) ? org[0] : org;
    if (orgRow.status !== 'Active') {
      return { success: false, error: `Organisation is ${orgRow.status}.` };
    }

    // 2) Resolve email from username within org — needs a SECURITY DEFINER helper
    const { data: emailResult, error: resolveErr } = await sb.rpc('resolve_login_email', {
      p_org_code: code,
      p_identifier: identifier,
    });
    if (resolveErr) return { success: false, error: resolveErr.message };
    const email = emailResult as string | null;
    if (!email) return { success: false, error: 'User not found for this organisation.' };

    // 3) Sign in
    const { error: signErr } = await sb.auth.signInWithPassword({ email, password });
    if (signErr) return { success: false, error: signErr.message };

    // Wait one tick for onAuthStateChange → loadProfile
    await new Promise((r) => setTimeout(r, 200));
    return { success: true, user: this.currentUser || undefined };
  }

  public async logout() {
    await getSupabase().auth.signOut();
    this.currentUser = null;
    this.currentOrg = null;
    clearAll();
    this.notify();
  }

  // ----- role helpers -----
  public canCreateTicket(u = this.currentUser) {
    return !!u && ['tenant','property_manager','admin','super_admin'].includes(u.role);
  }
  public canAssignTicket(u = this.currentUser) {
    return !!u && ['property_manager','admin','super_admin'].includes(u.role);
  }
  public canManageProperties(u = this.currentUser) {
    return !!u && ['property_manager','admin','super_admin'].includes(u.role);
  }
  public canManageUsers(u = this.currentUser) {
    return !!u && ['admin','super_admin'].includes(u.role);
  }
  public canAccessFinancials(u = this.currentUser) {
    return !!u && ['property_manager','finance','admin','super_admin'].includes(u.role);
  }
  public canApproveOrganizations(u = this.currentUser) {
    return u?.role === 'super_admin';
  }
  public canManageSubscriptions(u = this.currentUser) {
    return u?.role === 'super_admin';
  }
  public canManagePublicListings(u = this.currentUser) {
    return !!u && ['admin','super_admin'].includes(u.role);
  }
}

export const auth = new AuthService();
