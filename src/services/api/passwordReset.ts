// src/services/api/passwordReset.ts
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

const GENERIC_SUCCESS =
  'If an account exists for that identifier, a password reset link is on its way. Check your inbox (and spam).';

export interface ForgotPasswordResult {
  /** Always true when the request was accepted — we don't reveal existence. */
  accepted: boolean;
  /** Human-readable message. Safe to display. */
  message: string;
  /** Set only when the underlying call itself failed (network, config). */
  error?: string;
}

export const passwordReset = {
  /**
   * Send a password-reset email for the given org code + username/email.
   * Resolves the identifier to an email via `resolve_login_email` RPC
   * (same RPC used by login). Never reveals whether an account exists.
   */
  async sendReset(
    organizationCode: string,
    identifier: string
  ): Promise<ForgotPasswordResult> {
    if (!isSupabaseConfigured()) {
      return {
        accepted: false,
        message: 'Backend is not configured.',
        error: 'Missing Supabase environment variables.',
      };
    }
    const sb = getSupabase();

    const code = organizationCode.trim().toUpperCase();
    const id = identifier.trim().toLowerCase();

    if (!code || !id) {
      return {
        accepted: false,
        message: 'Please enter your organisation code and username or email.',
      };
    }

    // Platform admin path (SUPER / PLATFORM / ADMIN) — resolve via platform RPC.
    const isPlatform = ['SUPER', 'PLATFORM', 'ADMIN'].includes(code);

    try {
      let email: string | null = null;

      if (isPlatform) {
        // Reuse the platform resolver. If it's not deployed, accept an email
        // identifier as-is.
        try {
          const { data, error } = await sb.rpc('resolve_platform_login_email', {
            p_identifier: id,
          });
          if (!error && data) email = String(data);
        } catch {
          /* fall through */
        }
        if (!email && id.includes('@')) email = id;
      } else {
        const { data, error } = await sb.rpc('resolve_login_email', {
          p_org_code: code,
          p_identifier: id,
        });
        if (error) {
          // Don't surface the specific error — could leak existence.
          return { accepted: true, message: GENERIC_SUCCESS };
        }
        email = (data as string | null) ?? null;
        // Also accept a direct email that matches the code.
        if (!email && id.includes('@')) email = id;
      }

      if (!email) {
        // Silently succeed — never reveal whether the account exists.
        return { accepted: true, message: GENERIC_SUCCESS };
      }

      const redirectTo = `${window.location.origin}/#reset-password`;
      const { error: resetErr } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetErr) {
        // Rate limits get a specific message — safe.
        if (/rate limit|too many/i.test(resetErr.message)) {
          return {
            accepted: false,
            message: 'Too many requests. Please wait a moment and try again.',
          };
        }
        // Network errors are safe to surface.
        if (/fetch|network/i.test(resetErr.message)) {
          return {
            accepted: false,
            message: 'Could not reach the server. Check your connection.',
            error: resetErr.message,
          };
        }
        // Otherwise, treat as accepted to avoid account enumeration.
        return { accepted: true, message: GENERIC_SUCCESS };
      }

      return { accepted: true, message: GENERIC_SUCCESS };
    } catch (e) {
      return {
        accepted: false,
        message: 'Something went wrong. Please try again.',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
};
