import { sb, unwrap, requireUser, requireOrgId } from './_helpers';
import type { NotificationItem, UserRole } from '../../types';
import { profiles } from './profiles';

/** DB enum `notification_type` — must match supabase/migrations/002_enums.sql */
export type NotificationType = NotificationItem['type'];

const VALID_TYPES = new Set<string>([
  'registration',
  'approval',
  'ticket_new',
  'ticket_assigned',
  'ticket_status',
  'ticket_resolved',
  'ticket_reopened',
  'sla_warning',
  'sla_breach',
  'announcement',
  'emergency',
  'lease_reminder',
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeType(raw?: string): NotificationType {
  if (raw && VALID_TYPES.has(raw)) return raw as NotificationType;
  return 'announcement';
}

function asUuidOrNull(value?: string | null): string | null {
  if (!value) return null;
  return UUID_RE.test(value) ? value : null;
}

export type NotifyPayload = {
  title: string;
  message: string;
  type?: string;
  link?: string | null;
};

async function activeUserIds(
  predicate: (role: UserRole) => boolean,
  excludeUserId?: string | null
): Promise<string[]> {
  try {
    const staff = await profiles.list();
    return staff
      .filter(
        (u) =>
          u.status === 'Active' &&
          predicate(u.role) &&
          (!excludeUserId || u.id !== excludeUserId)
      )
      .map((u) => u.id);
  } catch (e) {
    console.warn('[notifications] list profiles failed', e);
    return [];
  }
}

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
    const user = requireUser();
    const { error } = await sb()
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', user.id);
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
    if (!input.user_id || !input.title?.trim()) return null;

    try {
      let organizationId: string | null = null;
      try {
        organizationId = requireOrgId();
      } catch {
        organizationId = null;
      }

      const type = normalizeType(input.type);
      const linkId = asUuidOrNull(input.link);
      const link = input.link ?? null;

      const result = await sb()
        .from('notifications')
        .insert({
          user_id: input.user_id,
          organization_id: organizationId,
          title: input.title.trim(),
          message: (input.message ?? '').trim() || input.title.trim(),
          type,
          link,
          link_id: linkId,
          read: false,
        })
        .select()
        .single();

      if (result.error) {
        console.warn(
          '[notifications] create failed:',
          result.error.message,
          result.error.code,
          { type, user_id: input.user_id }
        );
        return null;
      }
      return result.data as unknown as NotificationItem;
    } catch (e) {
      console.warn('[notifications] create exception', e);
      return null;
    }
  },

  async createMany(userIds: string[], payload: NotifyPayload): Promise<number> {
    const unique = [...new Set(userIds.filter(Boolean))];
    let ok = 0;
    for (const uid of unique) {
      const row = await this.create({ ...payload, user_id: uid });
      if (row) ok += 1;
    }
    return ok;
  },

  /** Notify all Active users with any of the given roles. */
  async notifyRoles(
    roles: UserRole[],
    payload: NotifyPayload,
    excludeUserId?: string | null
  ): Promise<number> {
    const set = new Set(roles);
    const ids = await activeUserIds((r) => set.has(r), excludeUserId);
    return this.createMany(ids, payload);
  },

  /** Property managers + admins (ops ownership). */
  async notifyManagers(payload: NotifyPayload, excludeUserId?: string | null) {
    return this.notifyRoles(['admin', 'property_manager'], payload, excludeUserId);
  },

  /** Maintenance staff + managers who oversee tickets. */
  async notifyMaintenance(payload: NotifyPayload, excludeUserId?: string | null) {
    return this.notifyRoles(
      ['maintenance', 'admin', 'property_manager'],
      payload,
      excludeUserId
    );
  },

  /** Finance + admin. */
  async notifyFinance(payload: NotifyPayload, excludeUserId?: string | null) {
    return this.notifyRoles(['finance', 'admin'], payload, excludeUserId);
  },

  /** All Active users in the current org (emergency / org-wide). */
  async notifyOrg(payload: NotifyPayload, excludeUserId?: string | null) {
    const ids = await activeUserIds(() => true, excludeUserId);
    return this.createMany(ids, payload);
  },

  /** Active tenants only. */
  async notifyTenants(payload: NotifyPayload, excludeUserId?: string | null) {
    return this.notifyRoles(['tenant'], payload, excludeUserId);
  },

  async ensureWelcome(): Promise<void> {
    try {
      const user = requireUser();
      const { count, error } = await sb()
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (error) {
        console.warn('[notifications] ensureWelcome count failed', error.message);
        return;
      }
      if ((count ?? 0) > 0) return;
      await this.create({
        user_id: user.id,
        title: 'Welcome to Umhlaba Wami',
        message:
          'You will see ticket, lease and finance alerts here. This is your notification centre.',
        type: 'announcement',
      });
    } catch (e) {
      console.warn('[notifications] ensureWelcome failed', e);
    }
  },
};
