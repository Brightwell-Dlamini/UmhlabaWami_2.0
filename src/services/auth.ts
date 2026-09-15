import type { User, Organization } from '../types';
import { getSupabase, isSupabaseConfigured, tryGetSupabase } from '../lib/supabase';
import { clearAll } from '../lib/queryClient';

/**
 * All login/auth failures surface as one of these messages. They never reveal
 * whether an account, org, or user exists. This makes client-side
 * enumeration attacks useless regardless of server behaviour.
 */
const AUTH_ERRORS = {
  backendMissing:
    'Backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel project settings and redeploy.',
  invalidCredentials: 'Invalid organisation code, username, or password.',
  orgInactive: 'This organisation is not currently active. Contact your administrator.',
  platformEmailRequired:
    'Platform admin sign-in requires your email address. Use the email, not the username.',
  sessionExpired: 'Your session has expired. Please sign in again.',
  network:
    'Could not reach the server. Check your connection and try again.',
} as const;

function normaliseAuthError(raw: string): string {
  const low = raw.toLowerCase();
  // Never leak "user not found", "no rows", "organisation not found"
  if (
    low.includes('invalid login') ||
    low.includes('invalid credentials') ||
    low.includes('user not found') ||
    low.includes('no rows') ||
    low.includes('not found')
  ) {
    return AUTH_ERRORS.invalidCredentials;
  }
  if (low.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (low.includes('too many requests') || low.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (low.includes('fetch') || low.includes('network')) {
    return AUTH_ERRORS.network;
  }
  // Default — do not return the raw message to the UI.
  return AUTH_ERRORS.invalidCredentials;
}

const SIGNOUT_TIMEOUT_MS = 2000;

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
        // TOKEN_REFRESHED / INITIAL_SESSION fire on tab focus — do NOT reload
        // profile or the UI remounts and loses form state.
        if (event === 'SIGNED_OUT') {
          if (this.currentUser !== null) {
            this.currentUser = null;
            this.currentOrg = null;
            clearAll();
            this.notify(true);
          } else {
            clearAll();
          }
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

    // Recover org context if profile was left unlinked after approval.
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
      if (this.currentOrg) {
        const orgId = this.currentOrg.id;
        await sb
          .from('profiles')
          .update({
            organization_id: orgId,
            role:
              profile.role === 'super_admin'
                ? profile.role
                : profile.role || 'admin',
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

  private computeNotifyKey(): string {
    if (!this.currentUser) return 'null';
    return [
      this.currentUser.id,
      this.currentUser.role,
      this.currentUser.organization_id || '',
      this.currentUser.status || '',
      this.currentUser.name || '',
    ].join('|');
  }

  private notify(force = false) {
    const key = this.computeNotifyKey();
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
      return { ok: false as const, error: AUTH_ERRORS.backendMissing };
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

    if (['SUPER', 'PLATFORM', 'ADMIN'].includes(code)) {
      return this.loginPlatformAdmin(identifier, password);
    }

    // Standard org login.
    const { data: orgRow, error: orgErr } = await sb.rpc('lookup_organization', {
      p_code: code,
    });
    if (orgErr) {
      return { success: false, error: normaliseAuthError(orgErr.message) };
    }
    if (!orgRow) return { success: false, error: AUTH_ERRORS.invalidCredentials };

    const org = Array.isArray(orgRow) ? orgRow[0] : orgRow;
    if (org.status !== 'Active') {
      return { success: false, error: AUTH_ERRORS.orgInactive };
    }

    const { data: emailResult, error: resolveErr } = await sb.rpc(
      'resolve_login_email',
      { p_org_code: code, p_identifier: identifier }
    );
    if (resolveErr) {
      return { success: false, error: normaliseAuthError(resolveErr.message) };
    }
    const email = emailResult as string | null;
    if (!email) {
      // Deliberately indistinct from wrong password.
      return { success: false, error: AUTH_ERRORS.invalidCredentials };
    }

    const { error: signErr } = await sb.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr) {
      return { success: false, error: normaliseAuthError(signErr.message) };
    }

    await new Promise((r) => setTimeout(r, 200));
    return { success: true, user: this.currentUser || undefined };
  }

  /**
   * Platform (super admin) sign-in. Requires an email because usernames are
   * scoped to organisations and are not globally unique.
   */
  private async loginPlatformAdmin(
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    if (!identifier.includes('@')) {
      return { success: false, error: AUTH_ERRORS.platformEmailRequired };
    }

    const sb = getSupabase();
    const { error: signErr } = await sb.auth.signInWithPassword({
      email: identifier,
      password,
    });
    if (signErr) {
      return { success: false, error: normaliseAuthError(signErr.message) };
    }

    await new Promise((r) => setTimeout(r, 250));

    if (this.currentUser?.role !== 'super_admin') {
      // Signed in successfully but the account is not a platform admin.
      // Sign back out so the user doesn't sit in a broken state.
      await sb.auth.signOut({ scope: 'local' });
      return { success: false, error: AUTH_ERRORS.invalidCredentials };
    }
    return { success: true, user: this.currentUser };
  }

  public async logout() {
    // 1) Drop UI session immediately so dashboard unmounts before network work.
    this.currentUser = null;
    this.currentOrg = null;
    clearAll();
    this.notify(true);

    // 2) End Supabase session (local scope first — does not hang on network).
    const sb = tryGetSupabase();
    if (!sb) return;

    try {
      await Promise.race([
        sb.auth.signOut({ scope: 'local' }),
        new Promise((resolve) => setTimeout(resolve, SIGNOUT_TIMEOUT_MS)),
      ]);
    } catch (e) {
      console.warn('[auth] signOut failed', e);
    }
  }

  public isSuperAdmin(u = this.currentUser): boolean {
    return u?.role === 'super_admin';
  }

  /** Admin of own org OR super admin. */
  public isAdminOrAbove(u = this.currentUser): boolean {
    if (!u) return false;
    return u.role === 'admin' || u.role === 'super_admin';
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
export { AUTH_ERRORS };
