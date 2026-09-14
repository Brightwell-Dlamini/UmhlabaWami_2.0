import { sb, unwrap, requireOrgId } from './_helpers';

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

export const centrePulse = {
  async fetch(orgId = requireOrgId(), shoppingCenterId?: string): Promise<CentrePulseSnapshot> {
    const ticketsQ = sb().from('tickets').select('id, status, priority, sla_status').eq('organization_id', orgId);
    const shopsQ = sb().from('shops').select('id, status').eq('organization_id', orgId);
    const vendorsQ = sb().from('vendors').select('id').eq('organization_id', orgId).eq('status', 'Active');
    const pmQ = sb()
      .from('preventive_maintenance')
      .select('id, next_due_at')
      .eq('organization_id', orgId)
      .lte('next_due_at', new Date(Date.now() + 7 * 86400000).toISOString());
    const shiftsQ = sb()
      .from('staff_shifts')
      .select('id')
      .eq('organization_id', orgId)
      .eq('date', new Date().toISOString().slice(0, 10))
      .eq('status', 'Scheduled');

    const [t, s, v, p, sh] = await Promise.all([
      shoppingCenterId ? ticketsQ.eq('shopping_center_id', shoppingCenterId) : ticketsQ,
      shoppingCenterId ? shopsQ.eq('shopping_center_id', shoppingCenterId) : shopsQ,
      vendorsQ,
      pmQ,
      shiftsQ,
    ]);

    const tickets = (t.data ?? []) as { status: string; priority: string; sla_status: string }[];
    const shops = (s.data ?? []) as { status: string }[];

    const openTickets = tickets.filter((x) =>
      ['Open', 'In Progress', 'Awaiting Approval', 'Reopened'].includes(x.status)
    ).length;
    const overdueTickets = tickets.filter((x) =>
      ['Overdue', 'Escalated'].includes(x.sla_status)
    ).length;
    const emergencyTickets = tickets.filter(
      (x) => x.priority === 'Emergency' && x.status !== 'Closed'
    ).length;
    const occupiedUnits = shops.filter((x) => x.status === 'Occupied').length;
    const availableUnits = shops.filter((x) => x.status === 'Available').length;
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
      occupancyRate: totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
      activeVendors: (v.data ?? []).length,
      pmDueThisWeek: (p.data ?? []).length,
      staffOnDutyToday: (sh.data ?? []).length,
      generatedAt: new Date().toISOString(),
    };
  },
};

// keep the exported name compatible with existing imports
export const fetchCentrePulse = (orgId?: string, centerId?: string) =>
  centrePulse.fetch(orgId, centerId);
