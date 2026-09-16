import { sb, requireOrgId } from './_helpers';

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

    const tickets = (tRes.data ?? []) as {
      status: string;
      priority: string;
      sla_status: string;
    }[];
    const shops = (sRes.data ?? []) as { status: string }[];

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
      organizationId: orgId,
      shoppingCenterId,
      openTickets,
      overdueTickets,
      emergencyTickets,
      occupiedUnits,
      availableUnits,
      totalUnits,
      occupancyRate: totalUnits
        ? Math.round((occupiedUnits / totalUnits) * 100)
        : 0,
      activeVendors: (vRes.data ?? []).length,
      pmDueThisWeek: (pRes.data ?? []).length,
      staffOnDutyToday: (shRes.data ?? []).length,
      generatedAt: new Date().toISOString(),
    };
  },
};

/** Back-compat alias for old imports. */
export const fetchCentrePulse = (orgId?: string, centerId?: string) =>
  centrePulse.fetch(orgId, centerId);
