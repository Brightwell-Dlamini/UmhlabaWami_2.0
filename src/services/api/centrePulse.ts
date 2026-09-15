import { sb, requireOrgId } from './_helpers';
import { isMemoryMode, getMemoryDb } from './mode';

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

const OPEN_TICKET_STATUSES = ['Open', 'In Progress', 'Awaiting Approval', 'Reopened'] as const;
const OVERDUE_SLA_STATUSES = ['Overdue', 'Escalated'] as const;

export const centrePulse = {
  async fetch(
    orgId = requireOrgId(),
    shoppingCenterId?: string
  ): Promise<CentrePulseSnapshot> {
    if (isMemoryMode()) return fetchFromMemory(orgId, shoppingCenterId);
    return fetchFromSupabase(orgId, shoppingCenterId);
  },
};

async function fetchFromMemory(
  orgId: string,
  shoppingCenterId?: string
): Promise<CentrePulseSnapshot> {
  const db = await getMemoryDb();

  const tickets = db.tickets.filter(
    (t) =>
      t.organization_id === orgId &&
      (!shoppingCenterId || t.shopping_center_id === shoppingCenterId)
  );
  const shops = db.shops.filter(
    (s) =>
      s.organization_id === orgId &&
      (!shoppingCenterId || s.shopping_center_id === shoppingCenterId)
  );
  const vendors = db.vendors.filter(
    (v) => v.organization_id === orgId && v.status === 'Active'
  );

  const today = new Date().toISOString().slice(0, 10);
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString();

  const staffOnDutyToday = db.shifts.filter(
    (s) => s.organization_id === orgId && s.date === today && s.status === 'Scheduled'
  ).length;

  // No PM tasks in memory seed — return 0 but the shape is correct.
  const pmDueThisWeek = 0;

  return buildSnapshot({
    organizationId: orgId,
    shoppingCenterId,
    tickets,
    shops,
    activeVendors: vendors.length,
    pmDueThisWeek,
    staffOnDutyToday,
  });
}

async function fetchFromSupabase(
  orgId: string,
  shoppingCenterId?: string
): Promise<CentrePulseSnapshot> {
  const client = sb();

  const ticketsQ = client
    .from('tickets')
    .select('id, status, priority, sla_status')
    .eq('organization_id', orgId);
  const shopsQ = client
    .from('shops')
    .select('id, status')
    .eq('organization_id', orgId);
  const vendorsQ = client
    .from('vendors')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'Active');
  const pmQ = client
    .from('preventive_maintenance')
    .select('id')
    .eq('organization_id', orgId)
    .lte('next_due_at', new Date(Date.now() + 7 * 86400000).toISOString());
  const shiftsQ = client
    .from('staff_shifts')
    .select('id')
    .eq('organization_id', orgId)
    .eq('date', new Date().toISOString().slice(0, 10))
    .eq('status', 'Scheduled');

  const [tRes, sRes, vRes, pRes, shRes] = await Promise.all([
    shoppingCenterId ? ticketsQ.eq('shopping_center_id', shoppingCenterId) : ticketsQ,
    shoppingCenterId ? shopsQ.eq('shopping_center_id', shoppingCenterId) : shopsQ,
    vendorsQ,
    pmQ,
    shiftsQ,
  ]);

  if (tRes.error) throw new Error(tRes.error.message);
  if (sRes.error) throw new Error(sRes.error.message);
  if (vRes.error) throw new Error(vRes.error.message);
  if (pRes.error) throw new Error(pRes.error.message);
  if (shRes.error) throw new Error(shRes.error.message);

  return buildSnapshot({
    organizationId: orgId,
    shoppingCenterId,
    tickets: (tRes.data ?? []) as { status: string; priority: string; sla_status: string }[],
    shops: (sRes.data ?? []) as { status: string }[],
    activeVendors: (vRes.data ?? []).length,
    pmDueThisWeek: (pRes.data ?? []).length,
    staffOnDutyToday: (shRes.data ?? []).length,
  });
}

function buildSnapshot(args: {
  organizationId: string;
  shoppingCenterId?: string;
  tickets: { status: string; priority: string; sla_status: string }[];
  shops: { status: string }[];
  activeVendors: number;
  pmDueThisWeek: number;
  staffOnDutyToday: number;
}): CentrePulseSnapshot {
  const {
    organizationId,
    shoppingCenterId,
    tickets,
    shops,
    activeVendors,
    pmDueThisWeek,
    staffOnDutyToday,
  } = args;

  const openTickets = tickets.filter((t) =>
    (OPEN_TICKET_STATUSES as readonly string[]).includes(t.status)
  ).length;
  const overdueTickets = tickets.filter((t) =>
    (OVERDUE_SLA_STATUSES as readonly string[]).includes(t.sla_status)
  ).length;
  const emergencyTickets = tickets.filter(
    (t) => t.priority === 'Emergency' && t.status !== 'Closed'
  ).length;
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
    activeVendors,
    pmDueThisWeek,
    staffOnDutyToday,
    generatedAt: new Date().toISOString(),
  };
}

/** Back-compat alias for old imports. */
export const fetchCentrePulse = (orgId?: string, centerId?: string) =>
  centrePulse.fetch(orgId, centerId);
