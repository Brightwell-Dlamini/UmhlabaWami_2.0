import { sb, unwrap, requireUser } from './_helpers';
import type { NotificationItem } from '../../types';

export const notifications = {
  async list(): Promise<NotificationItem[]> {
    const user = requireUser();
    const result = await sb()
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    return unwrap(result) as unknown as NotificationItem[];
  },

  async unreadCount(): Promise<number> {
    const user = requireUser();
    const { count, error } = await sb()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async markRead(id: string): Promise<void> {
    const { error } = await sb().from('notifications').update({ read: true }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async markAllRead(): Promise<void> {
    const user = requireUser();
    const { error } = await sb()
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    if (error) throw new Error(error.message);
  },
};
