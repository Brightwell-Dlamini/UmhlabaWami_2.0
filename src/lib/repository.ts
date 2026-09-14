/**
 * Data repository — Phase 2
 *
 * Abstracts data access. When Supabase is configured, all reads/writes go
 * through the Supabase client with RLS providing organisation isolation.
 * The in-memory db remains available only when Supabase is not configured
 * (local demonstration). Production must configure Supabase.
 */

import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './supabase';
import type {
  Organization,
  User,
  ShoppingCenter,
  Shop,
  Ticket,
  Tenant,
  Lease,
  Vendor,
  SlaRule,
} from '../types';

export const backendMode = (): 'supabase' | 'memory' =>
  isSupabaseConfigured() ? 'supabase' : 'memory';

export async function fetchOrganizations(): Promise<Organization[]> {
  if (!isSupabaseConfigured()) {
    const { db } = await import('../services/db');
    return [...db.organizations];
  }
  const { data, error } = await getSupabase().from('organizations').select('*');
  if (error) throw error;
  return (data || []) as Organization[];
}

export async function approveOrganization(orgId: string, approvedBy: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const { db } = await import('../services/db');
    const org = db.organizations.find((o) => o.id === orgId);
    if (org) {
      org.status = 'Active';
      org.approved_at = new Date().toISOString();
      org.approved_by = approvedBy;
      db.notify();
    }
    return;
  }
  const { error } = await getSupabase()
    .from('organizations')
    .update({
      status: 'Active',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .eq('id', orgId);
  if (error) throw error;
}

export async function loginWithOrgCode(
  organizationCode: string,
  username: string,
  password?: string
): Promise<{ success: boolean; error?: string; user?: User }> {
  if (!isSupabaseConfigured()) {
    const { auth } = await import('../services/auth');
    return auth.login(organizationCode, username, password);
  }

  const supabase = getSupabase();
  const code = organizationCode.trim().toUpperCase();
  const user = username.trim().toLowerCase();

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('*')
    .eq('organization_code', code)
    .maybeSingle();

  if (orgErr) return { success: false, error: orgErr.message };
  if (!org && code !== 'SUPER' && code !== 'ADMIN') {
    return { success: false, error: 'Organisation code not found.' };
  }
  if (org && org.status !== 'Active') {
    return { success: false, error: `Organisation is ${org.status}.` };
  }

  let profileQuery = supabase.from('profiles').select('*').eq('username', user);
  if (org) profileQuery = profileQuery.eq('organization_id', org.id);

  const { data: profile, error: profileErr } = await profileQuery.maybeSingle();
  if (profileErr) return { success: false, error: profileErr.message };
  if (!profile) return { success: false, error: 'User not found for this organisation.' };

  if (password && profile.email) {
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    });
    if (signErr) return { success: false, error: signErr.message };
  }

  return { success: true, user: profile as User };
}

export interface CentrePulseSnapshot {
  organizationId: string;
  shoppingCenterId?: string;
  openTickets: number;
  overdueTickets: number;
  emergencyTickets: number;
  occupiedUnits: number;
  availableUnits: number;
  totalUnits: number;
  occupancyRate: number;
  activeVendors: number;
  pmDueThisWeek: number;
  staffOnDutyToday: number;
  generatedAt: string;
}

export async function fetchCentrePulse(
  organizationId: string,
  shoppingCenterId?: string
): Promise<CentrePulseSnapshot> {
  if (!isSupabaseConfigured()) {
    const { db } = await import('../services/db');
    const tickets = db.tickets.filter(
      (t) =>
        t.organization_id === organizationId &&
        (!shoppingCenterId || t.shopping_center_id === shoppingCenterId)
    );
    const shops = db.shops.filter(
      (s) =>
        s.organization_id === organizationId &&
        (!shoppingCenterId || s.shopping_center_id === shoppingCenterId)
    );
    const openTickets = tickets.filter((t) =>
      ['Open', 'In Progress', 'Awaiting Approval', 'Reopened'].includes(t.status)
    ).length;
    const overdueTickets = tickets.filter((t) => t.sla_status === 'Overdue' || t.sla_status === 'Escalated').length;
    const emergencyTickets = tickets.filter((t) => t.priority === 'Emergency' && t.status !== 'Closed').length;
    const occupiedUnits = shops.filter((s) => s.status === 'Occupied').length;
    const availableUnits = shops.filter((s) => s.status === 'Available').length;
    const totalUnits = shops.length;
    const today = new Date().toISOString().slice(0, 10);
    const staffOnDutyToday = (db.staffShifts || []).filter(
      (s: { organization_id: string; date: string; status: string }) =>
        s.organization_id === organizationId && s.date === today && s.status === 'Scheduled'
    ).length;
    const activeVendors = (db.vendors || []).filter(
      (v: { organization_id: string; status: string }) =>
        v.organization_id === organizationId && v.status === 'Active'
    ).length;

    return {
      organizationId,
      shoppingCenterId,
      openTickets,
      overdueTickets,
      emergencyTickets,
      occupiedUnits,
      availableUnits,
      totalUnits,
      occupancyRate: totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
      activeVendors,
      pmDueThisWeek: 0,
      staffOnDutyToday,
      generatedAt: new Date().toISOString(),
    };
  }

  const supabase = getSupabase();
  let ticketsQuery = supabase
    .from('tickets')
    .select('id, status, priority, sla_status')
    .eq('organization_id', organizationId);
  if (shoppingCenterId) ticketsQuery = ticketsQuery.eq('shopping_center_id', shoppingCenterId);

  let shopsQuery = supabase
    .from('shops')
    .select('id, status')
    .eq('organization_id', organizationId);
  if (shoppingCenterId) shopsQuery = shopsQuery.eq('shopping_center_id', shoppingCenterId);

  const [ticketsRes, shopsRes, vendorsRes] = await Promise.all([
    ticketsQuery,
    shopsQuery,
    supabase.from('vendors').select('id').eq('organization_id', organizationId).eq('status', 'Active'),
  ]);

  const tickets = ticketsRes.data || [];
  const shops = shopsRes.data || [];
  const openTickets = tickets.filter((t) =>
    ['Open', 'In Progress', 'Awaiting Approval', 'Reopened'].includes(t.status)
  ).length;
  const overdueTickets = tickets.filter((t) => t.sla_status === 'Overdue' || t.sla_status === 'Escalated').length;
  const emergencyTickets = tickets.filter((t) => t.priority === 'Emergency' && t.status !== 'Closed').length;
  const occupiedUnits = shops.filter((s) => s.status === 'Occupied').length;
  const availableUnits = shops.filter((s) => s.status === 'Available').length;
  const totalUnits = shops.length;

  return {
    organizationId,
    shoppingCenterId,
    openTickets,
    overdueTickets,
    emergencyTickets,
    occupiedUnits,
    availableUnits,
    totalUnits,
    occupancyRate: totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
    activeVendors: (vendorsRes.data || []).length,
    pmDueThisWeek: 0,
    staffOnDutyToday: 0,
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchSlaMatrix(organizationId: string): Promise<SlaRule[]> {
  if (!isSupabaseConfigured()) {
    return [
      { priority: 'Emergency', response_minutes: 30, resolution_minutes: 120 },
      { priority: 'High', response_minutes: 120, resolution_minutes: 480 },
      { priority: 'Medium', response_minutes: 480, resolution_minutes: 1440 },
      { priority: 'Low', response_minutes: 1440, resolution_minutes: 4320 },
    ];
  }
  const { data, error } = await getSupabase()
    .from('sla_matrix')
    .select('priority, response_minutes, resolution_minutes')
    .eq('organization_id', organizationId);
  if (error) throw error;
  return (data || []) as SlaRule[];
}

export async function upsertSlaMatrix(
  organizationId: string,
  rules: SlaRule[]
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }
  const rows = rules.map((r) => ({
    organization_id: organizationId,
    priority: r.priority,
    response_minutes: r.response_minutes,
    resolution_minutes: r.resolution_minutes,
  }));
  const { error } = await getSupabase().from('sla_matrix').upsert(rows, {
    onConflict: 'organization_id,priority',
  });
  if (error) throw error;
}

export async function fetchPublicShops(): Promise<Shop[]> {
  if (!isSupabaseConfigured()) {
    const { db } = await import('../services/db');
    return db.shops.filter((s) => s.public_listing);
  }
  const { data, error } = await getSupabase()
    .from('shops')
    .select('*')
    .eq('public_listing', true)
    .eq('status', 'Available');
  if (error) throw error;
  return (data || []) as Shop[];
}

export { isSupabaseConfigured, tryGetSupabase };
