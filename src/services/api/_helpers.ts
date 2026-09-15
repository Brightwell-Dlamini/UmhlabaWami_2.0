import { getSupabase } from '../../lib/supabase';
import type { User } from '../../types';
import { auth } from '../auth';

/** Returns the current org id or throws. */
export function requireOrgId(): string {
  const fromOrg = auth.getCurrentOrganization()?.id;
  if (fromOrg) return fromOrg;
  const fromUser = auth.getCurrentUser()?.organization_id;
  if (fromUser) return fromUser;
  throw new Error('No organisation context. Sign out and sign in again, or ask super admin to re-approve the organisation.');
}

export function requireUser(): User {
  const u = auth.getCurrentUser();
  if (!u) throw new Error('Not authenticated.');
  return u;
}

export function sb() {
  return getSupabase();
}

/** Standard unwrap: throw on error, return data. */
export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) {
    const e = result.error as { message?: string };
    throw new Error(e.message || 'Supabase error');
  }
  if (result.data === null) throw new Error('No data returned.');
  return result.data;
}
