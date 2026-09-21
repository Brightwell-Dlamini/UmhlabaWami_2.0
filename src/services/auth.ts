// src/services/auth.ts
import type { User, Organization } from '../types';
import {
  getSupabase,
  isSupabaseConfigured,
  tryGetSupabase,
} from '../lib/supabase';
import { clearAll } from '../lib/queryClient';
// Tab hash is cleared on logout via Navbar calling clearPersistedTab

/**
 * All login/auth failures surface as one of these messages. They never reveal
 * whether an account, org, or user exists. This makes client-side
 * enumeration attacks useless regardless of server behaviour.
 */
const AUTH_ERRORS = {
  backendMissing:
    'Backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel project settings and redeploy.',
  invalidCredentials: 'Invalid organisation code, username, or password.',
  orgInactive:
    'This organisation is not currently active. Contact your administrator.',
  platformEmailRequired:
    'Enter your platform admin email or username.',
  sessionExpired: 'Your session has expired. Please sign in again.',
  network: 'Could not reach the server. Check your connection and try again.',
  accountInactive:
    'Your account is not active. Contact your organisation administrator.',
  notPlatformAdmin:
    'This account is not a platform admin. In Supabase → profiles, set role to exactly: super_admin and status to Active.',
} as const;

function normaliseAuthError(raw: string): string {
  const low = raw.toLowerCase();
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
  return AUTH_ERRORS.invalidCredentials;
}

const BLOCKED_USER_STATUSES = new Set(['Suspended', 'Inactive']);
const SIGNOUT_TIMEOUT_MS = 2000;

function normaliseRole(role: unknown): string {
  return String(role ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function isSuperAdminRole(role: unknown): boolean {
  const r = normaliseRole(role);
  return r === 'super_admin' || r === 'superadmin';
}

function toAppRole(role: unknown): User['role'] {
  if (isSuperAdminRole(role)) return 'super_admin';
  const r = normaliseRole(role);
  const allowed = [
    'tenant',
    'property_manager',
    'maintenance',
    'finance',
    'admin',
    'super_admin',
  ] as const;
  return (allowed.includes(r as (typeof allowed)[number]) ? r : 'tenant') as User['role'];
}

class AuthService {
  private currentUser: User | null = null;
  private currentOrg: Organization | null = null;
  private lastNotifiedKey: string | null = null;
  private listeners = new Set<(u: User | null) => void>();
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;
  /** When true, onAuthStateChange must not load/clear profile — login owns the flow. */
  private loginInProgress = false;
  private profileLoadGen = 0;

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
        if (event === 'SIGNED_OUT') {
          // Ignore SIGNED_OUT while login is still running (e.g. failed attempt cleanup).
          if (this.loginInProgress) return;
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
        // Login handler loads the profile itself — skip concurrent loads that
        // race and wipe the session (the old "flash then kick to landing" bug).
        if (this.loginInProgress) return;
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

  private async loadProfile(userId: string, opts?: { allowClear?: boolean }) {
    const sb = tryGetSupabase();
    if (!sb) return;

    const gen = ++this.profileLoadGen;
    const allowClear = opts?.allowClear !== false;

    const { data: profile, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    // Stale response — a newer load started.
    if (gen !== this.profileLoadGen) return;

    if (error) {
      console.error('[auth] profile load failed', error);
      // Never wipe an established session on a transient read error.
      return;
    }
    if (!profile) {
      console.warn('[auth] no profile row for', userId);
      if (!allowClear) return;
      // Only clear if this user is the one currently shown.
      if (this.currentUser && this.currentUser.id !== userId) return;
      this.currentUser = null;
      this.currentOrg = null;
      this.notify(true);
      return;
    }

    if (BLOCKED_USER_STATUSES.has(String(profile.status))) {
      console.warn('[auth] blocked status detected', profile.status);
      this.currentUser = null;
      this.currentOrg = null;
      clearAll();
      this.notify(true);
      try {
        await sb.auth.signOut({ scope: 'local' });
      } catch {
        /* non-fatal */
      }
      return;
    }

    const normalised: User = {
      ...(profile as unknown as User),
      role: toAppRole(profile.role),
    };

    this.currentUser = normalised;
    this.currentOrg = null;

    if (profile.organization_id) {
      const { data: org } = await sb
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .maybeSingle();
      if (gen !== this.profileLoadGen) return;
      this.currentOrg = (org as unknown as Organization) || null;
    }

    // Super admins intentionally have no organisation.
    if (!this.currentOrg && profile.email && !isSuperAdminRole(profile.role)) {
      const { data: byOwner } = await sb
        .from('organizations')
        .select('*')
        .eq('owner_auth_user_id', userId)
        .maybeSingle();
      if (gen !== this.profileLoadGen) return;
      if (byOwner) {
        this.currentOrg = byOwner as unknown as Organization;
      } else {
        const { data: byEmail } = await sb
          .from('organizations')
          .select('*')
          .ilike('email', String(profile.email))
          .eq('status', 'Active')
          .maybeSingle();
        if (gen !== this.profileLoadGen) return;
        if (byEmail) this.currentOrg = byEmail as unknown as Organization;
      }
      if (this.currentOrg) {
        const orgId = this.currentOrg.id;
        await sb
          .from('profiles')
          .update({
            organization_id: orgId,
            role: profile.role || 'admin',
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

  /** Soft-update cached org (e.g. after logo or settings save) without full re-login. */
  public setCurrentOrganization(org: Organization | null) {
    this.currentOrg = org;
    this.notify(true);
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

  private async verifyProfileActiveAfterSignIn(): Promise<
    | { ok: true; profile: User }
    | { ok: false; error: string }
  > {
    const sb = getSupabase();
    const {
      data: { user: authUser },
    } = await sb.auth.getUser();
    if (!authUser) {
      return { ok: false, error: AUTH_ERRORS.invalidCredentials };
    }
    const { data: profile, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();
    if (error) {
      console.error('[auth] post-login profile read failed', error);
      await sb.auth.signOut({ scope: 'local' });
      return { ok: false, error: AUTH_ERRORS.invalidCredentials };
    }
    if (!profile) {
      console.warn('[auth] no profiles row for auth user', authUser.id);
      await sb.auth.signOut({ scope: 'local' });
      return {
        ok: false,
        error:
          'Signed in to Auth but no profiles row exists. Create a profiles row with id = auth user UUID, role = super_admin, status = Active.',
      };
    }
    if (BLOCKED_USER_STATUSES.has(String(profile.status))) {
      await sb.auth.signOut({ scope: 'local' });
      return { ok: false, error: AUTH_ERRORS.accountInactive };
    }
    return { ok: true, profile: profile as unknown as User };
  }

  /**
   * Resolve platform-admin email from email or username.
   * Prefers RPC (works pre-auth); falls back to direct email if identifier has @.
   */
  private async resolvePlatformEmail(identifier: string): Promise<string | null> {
    const id = identifier.trim().toLowerCase();
    if (!id) return null;

    const sb = getSupabase();

    // Prefer security-definer RPC so username works before session exists.
    try {
      const { data, error } = await sb.rpc('resolve_platform_login_email', {
        p_identifier: id,
      });
      if (!error && data) return String(data);
    } catch {
      /* RPC may not be deployed yet */
    }

    if (id.includes('@')) return id;
    return null;
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

    this.loginInProgress = true;
    try {
      const { data: orgRow, error: orgErr } = await sb.rpc('lookup_organization', {
        p_code: code,
      });
      if (orgErr) {
        return { success: false, error: normaliseAuthError(orgErr.message) };
      }
      if (!orgRow) {
        return { success: false, error: AUTH_ERRORS.invalidCredentials };
      }

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
        return { success: false, error: AUTH_ERRORS.invalidCredentials };
      }

      const { error: signErr } = await sb.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr) {
        return { success: false, error: normaliseAuthError(signErr.message) };
      }

      const status = await this.verifyProfileActiveAfterSignIn();
      if (!status.ok) {
        return { success: false, error: status.error };
      }

      await this.loadProfile(status.profile.id, { allowClear: false });
      if (!this.currentUser) {
        this.currentUser = {
          ...status.profile,
          role: toAppRole(status.profile.role),
        };
        this.notify(true);
      }
      return { success: true, user: this.currentUser };
    } finally {
      this.loginInProgress = false;
    }
  }

  /**
   * Platform (super admin) sign-in with SUPER / PLATFORM / ADMIN code.
   * Accepts email OR username (via resolve_platform_login_email RPC).
   */
  private async loginPlatformAdmin(
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    if (!identifier) {
      return { success: false, error: AUTH_ERRORS.platformEmailRequired };
    }

    this.loginInProgress = true;
    const sb = getSupabase();

    try {
      const email = await this.resolvePlatformEmail(identifier);
      if (!email) {
        return {
          success: false,
          error: identifier.includes('@')
            ? AUTH_ERRORS.invalidCredentials
            : 'Username login needs the resolve_platform_login_email function in Supabase (see migration 012). Or sign in with your email.',
        };
      }

      const { error: signErr } = await sb.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr) {
        return { success: false, error: normaliseAuthError(signErr.message) };
      }

      const status = await this.verifyProfileActiveAfterSignIn();
      if (!status.ok) {
        return { success: false, error: status.error };
      }

      if (!isSuperAdminRole(status.profile.role)) {
        console.warn(
          '[auth] platform login denied: role is',
          status.profile.role,
          '(expected super_admin)'
        );
        await sb.auth.signOut({ scope: 'local' });
        return { success: false, error: AUTH_ERRORS.notPlatformAdmin };
      }

      // Own the session state — do not rely on onAuthStateChange.
      await this.loadProfile(status.profile.id, { allowClear: false });

      if (!this.currentUser || !isSuperAdminRole(this.currentUser.role)) {
        this.currentUser = {
          ...status.profile,
          role: 'super_admin',
        };
        this.currentOrg = null;
        this.notify(true);
      }

      return { success: true, user: this.currentUser };
    } finally {
      this.loginInProgress = false;
    }
  }

  public async logout() {
    this.currentUser = null;
    this.currentOrg = null;
    clearAll();
    this.notify(true);

    // Drop role-specific navigation so the next login is not trapped on a foreign tab.
    try {
      sessionStorage.removeItem('uw_sidebar_tab');
    } catch {
      /* ignore */
    }
    try {
      const path = `${window.location.pathname}${window.location.search}`;
      if (window.location.hash) {
        window.history.replaceState(null, '', path);
      }
    } catch {
      /* ignore */
    }

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
    return isSuperAdminRole(u?.role);
  }

  public isAdminOrAbove(u = this.currentUser): boolean {
    if (!u) return false;
    return u.role === 'admin' || isSuperAdminRole(u.role);
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
