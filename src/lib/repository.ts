// src/lib/repository.ts
/**
 * Memory-mode fallback shim — Phase 2 cleanup.
 *
 * IMPORTANT: Production paths MUST use `services/api/*` which go through
 * Supabase with RLS. This file only exists for offline demos and tests.
 *
 * Every exported function here throws if Supabase is configured, so any
 * accidental prod import fails loudly instead of forking state.
 */

import { isSupabaseConfigured } from './supabase';
import type {
  Organization,
  User,
  Shop,
  SlaRule,
} from '../types';

function assertMemoryMode(fn: string) {
  if (isSupabaseConfigured()) {
    throw new Error(
      `[repository.${fn}] Called in Supabase mode. Use services/api/* instead. ` +
        `This module is memory-mode only.`
    );
  }
}

export const backendMode = (): 'supabase' | 'memory' =>
  isSupabaseConfigured() ? 'supabase' : 'memory';

export async function fetchOrganizations(): Promise<Organization[]> {
  assertMemoryMode('fetchOrganizations');
  const { db } = await import('../services/db');
  return [...db.organizations];
}

export async function approveOrganization(
  orgId: string,
  approvedBy: string
): Promise<void> {
  assertMemoryMode('approveOrganization');
  const { db } = await import('../services/db');
  const org = db.organizations.find((o) => o.id === orgId);
  if (org) {
    org.status = 'Active';
    org.approved_at = new Date().toISOString();
    org.approved_by = approvedBy;
    db.notify();
  }
}

export async function loginWithOrgCode(
  organizationCode: string,
  username: string,
  password?: string
): Promise<{ success: boolean; error?: string; user?: User }> {
  if (isSupabaseConfigured()) {
    throw new Error(
      '[repository.loginWithOrgCode] Use auth.login() from services/auth instead.'
    );
  }
  const { auth } = await import('../services/auth');
  return auth.login(organizationCode, username, password ?? '');
}

/**
 * NOTE: fetchCentrePulse, fetchSlaMatrix, upsertSlaMatrix, and
 * fetchPublicShops were removed. Use:
 *   - services/api/centrePulse
 *   - services/api/slaMatrix
 *   - services/api/shops
 */

export async function fetchSlaMatrixForDemo(): Promise<SlaRule[]> {
  assertMemoryMode('fetchSlaMatrixForDemo');
  return [
    { priority: 'Emergency', response_minutes: 30, resolution_minutes: 120 },
    { priority: 'High', response_minutes: 120, resolution_minutes: 480 },
    { priority: 'Medium', response_minutes: 480, resolution_minutes: 1440 },
    { priority: 'Low', response_minutes: 1440, resolution_minutes: 4320 },
  ];
}

export async function fetchPublicShopsForDemo(): Promise<Shop[]> {
  assertMemoryMode('fetchPublicShopsForDemo');
  const { db } = await import('../services/db');
  return db.shops.filter((s) => s.public_listing);
}

export { isSupabaseConfigured };
