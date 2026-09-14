import { sb, unwrap, requireUser } from './_helpers';
import type { TicketComment } from '../../types';

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
    return unwrap(result) as unknown as TicketComment;
  },
};
