import { getSupabase } from '../../lib/supabase';
import type { User } from '../../types';
import { auth } from '../auth';

/** Returns the current org id or throws. */
export function requireOrgId(): string {
  const fromOrg = auth.getCurrentOrganization()?.id;
  if (fromOrg) return fromOrg;
  const fromUser = auth.getCurrentUser()?.organization_id;
  if (fromUser) return fromUser;
  throw new Error(
    'No organisation context. Sign out and sign in again, or ask super admin to re-approve the organisation.'
  );
}

export function requireUser(): User {
  const u = auth.getCurrentUser();
  if (!u) throw new Error('Not authenticated.');
  return u;
}

export function sb() {
  return getSupabase();
}

/**
 * Turn cryptic Postgres / PostgREST messages into clear English the user can act on.
 * Always prefer a domain message when you know the cause; use this as the last line of defence.
 */
export function friendlyError(raw: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const msg =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && 'message' in raw
        ? String((raw as { message?: string }).message ?? '')
        : '';

  if (!msg) return fallback;
  const m = msg.toLowerCase();

  // NOT NULL / organization_id cascade issues (common on delete)
  if (
    m.includes('organization_id') &&
    (m.includes('not-null') || m.includes('null value') || m.includes('violates not-null'))
  ) {
    if (m.includes('payment_records') || m.includes('payment')) {
      return 'Cannot delete this invoice because it has payment records linked to it. Cancel the invoice or reverse the payments first.';
    }
    if (m.includes('tickets') || m.includes('ticket')) {
      return 'Cannot complete this action: related tickets still reference this record. Close or reassign those tickets first.';
    }
    if (m.includes('tenants') || m.includes('tenant')) {
      return 'Cannot complete this action: a tenant record is still linked. Unassign the tenant first.';
    }
    return 'Cannot complete this action because related records would lose their organisation link. Remove or reassign those records first.';
  }

  // Foreign key violations
  if (m.includes('foreign key') || m.includes('violates foreign key')) {
    if (m.includes('delete')) {
      return 'Cannot delete this record because other data still depends on it. Remove or reassign the related items first.';
    }
    return 'This action references a record that does not exist or is not available to you.';
  }

  // Unique / duplicate
  if (m.includes('duplicate') || m.includes('unique constraint') || m.includes('already exists')) {
    return 'A record with the same details already exists. Change the unique fields and try again.';
  }

  // RLS / permission
  if (
    m.includes('row-level security') ||
    m.includes('permission denied') ||
    m.includes('not authorized') ||
    m.includes('jwt')
  ) {
    return 'You do not have permission to do that. Check your role or sign in again.';
  }

  // Check constraints
  if (m.includes('check constraint') || m.includes('violates check')) {
    return 'One or more values are outside the allowed range. Review the form and try again.';
  }

  // Network / timeout-ish
  if (m.includes('network') || m.includes('fetch failed') || m.includes('timeout')) {
    return 'Network problem. Check your connection and try again.';
  }

  // Already human-readable domain errors we throw ourselves — pass through
  if (
    !m.includes('violates') &&
    !m.includes('constraint') &&
    !m.includes('null value') &&
    !m.includes('postgres') &&
    !m.includes('pgrst') &&
    !m.includes('code:')
  ) {
    return msg;
  }

  // Generic constraint catch-all
  if (m.includes('violates') || m.includes('constraint')) {
    return 'This action conflicts with existing data rules. Adjust the related records and try again.';
  }

  return msg || fallback;
}

/** Standard unwrap: throw on error (friendly message), return data. */
export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) {
    throw new Error(friendlyError(result.error));
  }
  if (result.data === null) throw new Error('No data returned.');
  return result.data;
}

/** Throw a friendly Error from a PostgREST error object or string. */
export function throwFriendly(error: unknown, fallback?: string): never {
  throw new Error(friendlyError(error, fallback));
}
