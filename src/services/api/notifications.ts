import { sb, unwrap, requireUser, requireOrgId } from './_helpers';
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

  async create(input: {
    user_id: string;
    title: string;
    message: string;
    type?: string;
    link?: string | null;
  }): Promise<NotificationItem | null> {
    try {
      let organizationId: string | null = null;
      try {
        organizationId = requireOrgId();
      } catch {
        organizationId = null;
      }

      const result = await sb()
        .from('notifications')
        .insert({
          user_id: input.user_id,
          organization_id: organizationId,
          title: input.title,
          message: input.message,
          type: input.type ?? 'info',
          link: input.link ?? null,
          link_id: input.link ?? null,
          read: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (result.error) {
        console.warn('[notifications] create failed', result.error.message);
        return null;
      }
      return result.data as unknown as NotificationItem;
    } catch (e) {
      console.warn('[notifications] create exception', e);
      return null;
    }
  },

  async ensureWelcome(): Promise<void> {
    const user = requireUser();
    const { count } = await sb()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if ((count ?? 0) > 0) return;
    await this.create({
      user_id: user.id,
      title: 'Welcome to Umhlaba Wami',
      message:
        'You will see ticket, lease and system alerts here. This is your notification centre.',
      type: 'system',
    });
  },
};
