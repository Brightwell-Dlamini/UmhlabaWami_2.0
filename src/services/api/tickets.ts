// src/services/api/tickets.ts
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

/**
 * Slim projection for list views. No timeline/attachments join.
 * Order of columns is not important — only what's included.
 */
const TICKET_LITE_SELECT = `
  id,
  ticket_number,
  organization_id,
  shopping_center_id,
  property_id,
  shop_id, exact_location_description,
  tenant_id,
  title,
  description,
  priority,
  category,
  status,
  assigned_to,
  assigned_to_name,
  created_by_user_id,
  created_at,
  response_deadline,
  resolution_deadline,
  responded_at,
  resolved_at,
  closed_at,
  sla_status,
  tenant_confirmed_fixed
`;

/** Lite variant — everything except timeline, attachments, image arrays, costs. */
export type TicketListItem = Omit<Ticket, 'timeline' | 'attachments'>;

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
  /** Full graph — use only in the detail modal. */
  async list(orgId = requireOrgId()): Promise<Ticket[]> {
    const result = await sb()
      .from('tickets')
      .select(TICKET_SELECT)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as Ticket[];
  },

  /**
   * Slim list for dashboards and list views. No timeline/attachments join.
   * Returns a TicketListItem[] where the heavy fields are absent.
   */
  async listLite(orgId = requireOrgId()): Promise<TicketListItem[]> {
    const result = await sb()
      .from('tickets')
      .select(TICKET_LITE_SELECT)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as TicketListItem[];
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
        ticket_number: '', // trigger fills
        status: 'Open' as TicketStatus,
        ...input,
      })
      .select(TICKET_SELECT)
      .single();
    return unwrap(result) as unknown as Ticket;
  },

  async assign(ticketId: string, technicianId: string, technicianName: string) {
    const user = requireUser();
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
    const { error } = await sb().rpc('reopen_ticket', {
      p_ticket_id: ticketId,
      p_actor_name: user.name,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
  },

  /** Client calls this periodically. Also runnable server-side via cron. */
  async runEscalation(orgId = requireOrgId()): Promise<number> {
    const { data, error } = await sb().rpc('run_sla_escalation_pass', {
      p_org_id: orgId,
    });
    if (error) throw new Error(error.message);
    return (data as number) ?? 0;
  },
};
