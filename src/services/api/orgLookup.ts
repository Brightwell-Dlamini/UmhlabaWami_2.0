// src/services/api/orgLookup.ts
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export interface OrgLookupResult {
  /** True when a matching, Active org was found. */
  found: boolean;
  /** Present only when `found` is true. */
  code?: string;
  /** Human-readable status message. */
  message: string;
  /** Optional: used for debugging in dev only. */
  error?: string;
}

const NOT_FOUND =
  'No active organisation matches that company name and email. Double-check your spelling, or contact your organisation administrator.';

export const orgLookup = {
  /**
   * Look up an org code from company name + owner email.
   *
   * Uses the `lookup_organization_code` RPC, which requires BOTH fields to
   * match (prevents enumeration). Falls back to a strict direct query if the
   * RPC isn't deployed — the direct query is safe because RLS only exposes
   * Active orgs to anonymous callers via that view.
   */
  async findByCompanyAndEmail(
    companyName: string,
    ownerEmail: string
  ): Promise<OrgLookupResult> {
    if (!isSupabaseConfigured()) {
      return {
        found: false,
        message: 'Backend is not configured.',
        error: 'Missing Supabase environment variables.',
      };
    }
    const sb = getSupabase();

    const name = companyName.trim();
    const email = ownerEmail.trim().toLowerCase();

    if (!name || !email) {
      return {
        found: false,
        message: 'Please enter both the company name and the registered owner email.',
      };
    }

    try {
      const { data, error } = await sb.rpc('lookup_organization_code', {
        p_company_name: name,
        p_owner_email: email,
      });
      if (!error) {
        const code = (data as string | null) ?? null;
        if (code) {
          return {
            found: true,
            code,
            message: `Found it — your organisation code is ${code}.`,
          };
        }
        return { found: false, message: NOT_FOUND };
      }

      // RPC missing — fall back to a strict query against Active orgs only.
      if (/could not find the function|function .* does not exist/i.test(error.message)) {
        const { data: rows } = await sb
          .from('organizations')
          .select('organization_code')
          .ilike('company_name', name)
          .ilike('email', email)
          .eq('status', 'Active')
          .limit(1);
        const code = rows?.[0]?.organization_code ?? null;
        if (code) {
          return {
            found: true,
            code,
            message: `Found it — your organisation code is ${code}.`,
          };
        }
        return { found: false, message: NOT_FOUND };
      }

      return {
        found: false,
        message: 'Could not search right now. Please try again in a moment.',
        error: error.message,
      };
    } catch (e) {
      return {
        found: false,
        message: 'Something went wrong. Please try again.',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
};
