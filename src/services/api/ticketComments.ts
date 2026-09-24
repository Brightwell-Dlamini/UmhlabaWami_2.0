import { sb, unwrap, requireUser } from './_helpers';
import type { TicketComment } from '../../types';
import { notifications } from './notifications';
import { tickets } from './tickets';

export const ticketComments = {
  async list(ticketId: string): Promise<TicketComment[]> {
    const result = await sb()
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    return unwrap(result) as unknown as TicketComment[];
  },

  async add(ticketId: string, comment: string): Promise<TicketComment> {
    const user = requireUser();
    const result = await sb()
      .from('ticket_comments')
      .insert({
        ticket_id: ticketId,
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        comment,
      })
      .select()
      .single();
    const row = unwrap(result) as unknown as TicketComment;

    try {
      const ticket = await tickets.get(ticketId);
      const targets = new Set<string>();
      if (ticket.created_by_user_id) targets.add(ticket.created_by_user_id);
      if (ticket.assigned_to) targets.add(ticket.assigned_to);
      targets.delete(user.id);
      const preview =
        comment.length > 120 ? `${comment.slice(0, 117)}…` : comment;
      await notifications.createMany([...targets], {
        title: 'New ticket comment',
        message: `${user.name} on ${ticket.title}: ${preview}`,
        type: 'ticket_status',
        link: ticketId,
      });
    } catch (e) {
      console.warn('[ticketComments] notify failed', e);
    }

    return row;
  },
};
