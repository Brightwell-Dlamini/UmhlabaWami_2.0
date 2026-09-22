import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type {
  Ticket,
  TicketPriority,
  TicketCategory,
  TicketStatus,
} from '../../types';

const TICKET_SELECT = `
  *,
  timeline:ticket_timeline(*),
  attachments:ticket_attachments(*)
`;

/** Allowed status transitions — prevents double-resolve, assign-on-closed, etc. */
async function loadTicketStatus(ticketId: string): Promise<string> {
  const result = await sb()
    .from('tickets')
    .select('status')
    .eq('id', ticketId)
    .single();
  if (result.error) throw new Error(result.error.message);
  return (result.data as { status: string }).status;
}

function assertStatus(
  current: string,
  allowed: string[],
  action: string
): void {
  if (!allowed.includes(current)) {
    throw new Error(
      `Cannot ${action} a ticket that is "${current}". Allowed: ${allowed.join(', ')}.`
    );
  }
}

export interface CreateTicketInput {
  shopping_center_id: string;
  property_id: string;
  shop_id: string;
  tenant_id: string;
  title: string;
  description: string;
  exact_location_description?: string;
  priority: TicketPriority;
  category: TicketCategory;
  before_images?: string[];
}

export const tickets = {
  async list(orgId = requireOrgId()): Promise<Ticket[]> {
    const result = await sb()
      .from('tickets')
      .select(TICKET_SELECT)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as Ticket[];
  },

  /** Lightweight list without timeline/attachments for desk views. */
  async listLite(orgId = requireOrgId()): Promise<Ticket[]> {
    const result = await sb()
      .from('tickets')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as Ticket[];
  },

  async get(id: string): Promise<Ticket> {
    const result = await sb()
      .from('tickets')
      .select(TICKET_SELECT)
      .eq('id', id)
      .single();
    return unwrap(result) as unknown as Ticket;
  },

  async create(input: CreateTicketInput): Promise<Ticket> {
    const user = requireUser();
    const orgId = requireOrgId();
    const result = await sb()
      .from('tickets')
      .insert({
        organization_id: orgId,
        created_by_user_id: user.id,
        ticket_number: '',
        status: 'Open' as TicketStatus,
        ...input,
      })
      .select(TICKET_SELECT)
      .single();
    return unwrap(result) as unknown as Ticket;
  },

  async assign(ticketId: string, technicianId: string, technicianName: string) {
    const user = requireUser();
    const status = await loadTicketStatus(ticketId);
    assertStatus(status, ['Open', 'In Progress', 'Reopened'], 'assign');
    const { error } = await sb().rpc('assign_ticket', {
      p_ticket_id: ticketId,
      p_technician_id: technicianId,
      p_technician_name: technicianName,
      p_actor_name: user.name,
    });
    if (error) throw new Error(error.message);
  },

  async accept(ticketId: string) {
    const user = requireUser();
    const status = await loadTicketStatus(ticketId);
    assertStatus(status, ['Open', 'Reopened'], 'accept');
    const { error } = await sb().rpc('accept_ticket', {
      p_ticket_id: ticketId,
      p_actor_name: user.name,
    });
    if (error) throw new Error(error.message);
  },

  async resolve(
    ticketId: string,
    payload: {
      repair_notes: string;
      materials_used?: string;
      time_spent_hours?: number;
      cost?: number;
      after_images?: string[];
    }
  ) {
    const user = requireUser();
    const status = await loadTicketStatus(ticketId);
    assertStatus(status, ['In Progress', 'Open', 'Reopened'], 'mark as completed');
    const { error } = await sb().rpc('resolve_ticket', {
      p_ticket_id: ticketId,
      p_actor_name: user.name,
      p_repair_notes: payload.repair_notes,
      p_materials_used: payload.materials_used ?? null,
      p_time_spent_hours: payload.time_spent_hours ?? null,
      p_cost: payload.cost ?? null,
      p_after_images: payload.after_images ?? [],
    });
    if (error) throw new Error(error.message);
  },

  async confirm(ticketId: string, rating: number, feedback: string) {
    const user = requireUser();
    const status = await loadTicketStatus(ticketId);
    assertStatus(status, ['Resolved'], 'confirm resolution of');
    const { error } = await sb().rpc('confirm_ticket_resolution', {
      p_ticket_id: ticketId,
      p_actor_name: user.name,
      p_rating: rating,
      p_feedback: feedback,
    });
    if (error) throw new Error(error.message);
  },

  async reopen(ticketId: string, reason: string) {
    const user = requireUser();
    const status = await loadTicketStatus(ticketId);
    assertStatus(status, ['Resolved', 'Closed'], 'reopen');
    const { error } = await sb().rpc('reopen_ticket', {
      p_ticket_id: ticketId,
      p_actor_name: user.name,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
  },

  async runEscalation(orgId = requireOrgId()): Promise<number> {
    const { data, error } = await sb().rpc('run_sla_escalation_pass', {
      p_org_id: orgId,
    });
    if (error) throw new Error(error.message);
    return (data as number) ?? 0;
  },
};
