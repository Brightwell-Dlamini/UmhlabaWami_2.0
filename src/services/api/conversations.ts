import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import { notifications } from './notifications';
import type { Conversation, ChatMessage } from '../../types';

export const conversations = {
  async list(orgId = requireOrgId()): Promise<Conversation[]> {
    const result = await sb()
      .from('conversations')
      .select('*')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false });
    return unwrap(result) as unknown as Conversation[];
  },

  async messages(conversationId: string): Promise<ChatMessage[]> {
    const result = await sb()
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    return unwrap(result) as unknown as ChatMessage[];
  },

  async send(conversationId: string, message: string): Promise<ChatMessage> {
    const user = requireUser();
    const { data, error } = await sb().rpc('send_chat_message', {
      p_conversation_id: conversationId,
      p_message: message,
    });
    if (error) throw new Error(error.message);
    const msg = data as unknown as ChatMessage;

    // Notify other participants
    try {
      const convResult = await sb()
        .from('conversations')
        .select('participant_ids')
        .eq('id', conversationId)
        .single();
      const ids =
        (convResult.data as { participant_ids?: string[] } | null)?.participant_ids ?? [];
      const others = ids.filter((id) => id && id !== user.id);
      const preview = message.length > 120 ? `${message.slice(0, 117)}…` : message;
      await notifications.createMany(others, {
        title: 'New message',
        message: `${user.name}: ${preview}`,
        type: 'announcement',
        link: conversationId,
      });
    } catch (e) {
      console.warn('[conversations] notify participants failed', e);
    }

    return msg;
  },

  async create(input: {
    participant_ids: string[];
    participant_names: string[];
    ticket_id?: string;
  }): Promise<Conversation> {
    const result = await sb()
      .from('conversations')
      .insert({
        organization_id: requireOrgId(),
        participant_ids: input.participant_ids,
        participant_names: input.participant_names,
        ticket_id: input.ticket_id ?? null,
      })
      .select()
      .single();
    return unwrap(result) as unknown as Conversation;
  },
};
