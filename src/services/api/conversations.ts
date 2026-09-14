import { sb, unwrap, requireOrgId } from './_helpers';
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
    const { data, error } = await sb().rpc('send_chat_message', {
      p_conversation_id: conversationId,
      p_message: message,
    });
    if (error) throw new Error(error.message);
    return data as unknown as ChatMessage;
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
