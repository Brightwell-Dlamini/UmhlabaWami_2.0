import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type {
  Ticket,
  TicketPriority,
  TicketCategory,
  TicketStatus,
} from '../../types';
import { notifications } from './notifications';

const TICKET_SELECT = `
  *,
  timeline:ticket_timeline(*),
  attachments:ticket_attachments(*)
`;

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
    const ticket = unwrap(result) as unknown as Ticket;

    try {
      await notifications.notifyMaintenance(
        {
          title: 'New ticket opened',
          message: `${ticket.title} — raised by ${user.name}`,
          type: 'ticket_new',
          link: ticket.id,
        },
        user.id
      );
    } catch (e) {
      console.warn('[tickets] notify new ticket failed', e);
    }

    return ticket;
  },

  async assign(ticketId: string, technicianId: string, technicianName: string) {
    const user = requireUser();
    const status = await loadTicketStatus(ticketId);
    assertStatus(status, ['Open', 'In Progress', 'Reopened'], 'assign');

    const ticket = await this.get(ticketId);

    const { error } = await sb().rpc('assign_ticket', {
      p_ticket_id: ticketId,
      p_technician_id: technicianId,
      p_technician_name: technicianName,
      p_actor_name: user.name,
    });
    if (error) throw new Error(error.message);

    await notifications.create({
      user_id: technicianId,
      title: 'New job assigned',
      message: `You were assigned: ${ticket.title}`,
      type: 'ticket_assigned',
      link: ticketId,
    });

    if (ticket.created_by_user_id && ticket.created_by_user_id !== technicianId) {
      await notifications.create({
        user_id: ticket.created_by_user_id,
        title: 'Ticket assigned',
        message: `${ticket.title} was assigned to ${technicianName}`,
        type: 'ticket_status',
        link: ticketId,
      });
    }
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

    try {
      const ticket = await this.get(ticketId);
      if (ticket.created_by_user_id && ticket.created_by_user_id !== user.id) {
        await notifications.create({
          user_id: ticket.created_by_user_id,
          title: 'Ticket accepted',
          message: `${ticket.title} is now in progress (${user.name})`,
          type: 'ticket_status',
          link: ticketId,
        });
      }
    } catch (e) {
      console.warn('[tickets] notify on accept failed', e);
    }
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

    try {
      const ticket = await this.get(ticketId);
      const targets: string[] = [];
      if (ticket.created_by_user_id) targets.push(ticket.created_by_user_id);
      await notifications.createMany(targets, {
        title: 'Ticket resolved',
        message: `${ticket.title} was marked completed by ${user.name}. Please confirm if the issue is fixed.`,
        type: 'ticket_resolved',
        link: ticketId,
      });
      await notifications.notifyManagers(
        {
          title: 'Ticket resolved',
          message: `${ticket.title} completed by ${user.name}`,
          type: 'ticket_resolved',
          link: ticketId,
        },
        user.id
      );
    } catch (e) {
      console.warn('[tickets] notify on resolve failed', e);
    }
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

    try {
      const ticket = await this.get(ticketId);
      if (ticket.assigned_to && ticket.assigned_to !== user.id) {
        await notifications.create({
          user_id: ticket.assigned_to,
          title: 'Resolution confirmed',
          message: `${ticket.title} confirmed by ${user.name} (rating ${rating}/5)`,
          type: 'ticket_status',
          link: ticketId,
        });
      }
      await notifications.notifyManagers(
        {
          title: 'Ticket closed',
          message: `${ticket.title} confirmed by ${user.name}`,
          type: 'ticket_status',
          link: ticketId,
        },
        user.id
      );
    } catch (e) {
      console.warn('[tickets] notify on confirm failed', e);
    }
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

    try {
      const ticket = await this.get(ticketId);
      if (ticket.assigned_to) {
        await notifications.create({
          user_id: ticket.assigned_to,
          title: 'Ticket reopened',
          message: `${ticket.title} was reopened: ${reason}`,
          type: 'ticket_reopened',
          link: ticketId,
        });
      }
      await notifications.notifyManagers(
        {
          title: 'Ticket reopened',
          message: `${ticket.title}: ${reason}`,
          type: 'ticket_reopened',
          link: ticketId,
        },
        user.id
      );
    } catch (e) {
      console.warn('[tickets] notify on reopen failed', e);
    }
  },

  async runEscalation(orgId = requireOrgId()): Promise<number> {
    const { data, error } = await sb().rpc('run_sla_escalation_pass', {
      p_org_id: orgId,
    });
    if (error) throw new Error(error.message);
    return (data as number) ?? 0;
  },
};
