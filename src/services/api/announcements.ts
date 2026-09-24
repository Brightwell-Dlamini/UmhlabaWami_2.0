import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type { Announcement, EmergencyBroadcast } from '../../types';
import { notifications } from './notifications';

export const announcementsExtra = {
  async activeEmergencyList(orgId = requireOrgId()) {
    return emergencyBroadcasts.listActive(orgId);
  },
};

export const announcements = {
  async list(orgId = requireOrgId()): Promise<Announcement[]> {
    const result = await sb()
      .from('announcements')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as Announcement[];
  },

  async active(orgId = requireOrgId()): Promise<Announcement[]> {
    const result = await sb()
      .from('announcements')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return unwrap(result) as unknown as Announcement[];
  },

  async create(input: {
    property_id?: string;
    title: string;
    message: string;
    priority?: 'General' | 'Important' | 'Emergency';
    target_audience?: 'All Tenants' | 'Specific Property' | 'Specific Floor';
  }): Promise<Announcement> {
    const { data, error } = await sb().rpc('post_announcement', {
      p_organization_id: requireOrgId(),
      p_property_id: input.property_id ?? null,
      p_title: input.title,
      p_message: input.message,
      p_priority: input.priority ?? 'General',
      p_target_audience: input.target_audience ?? 'All Tenants',
    });
    if (error) throw new Error(error.message);
    const row = data as unknown as Announcement;

    try {
      const actor = requireUser();
      const priority = input.priority ?? 'General';
      const type = priority === 'Emergency' ? 'emergency' : 'announcement';
      await notifications.notifyTenants(
        {
          title: input.title,
          message: input.message,
          type,
          link: row.id,
        },
        actor.id
      );
      await notifications.notifyManagers(
        {
          title: `Announcement posted: ${input.title}`,
          message: input.message,
          type,
          link: row.id,
        },
        actor.id
      );
    } catch (e) {
      console.warn('[announcements] notify failed', e);
    }

    return row;
  },

  async update(id: string, patch: Partial<Announcement>): Promise<Announcement> {
    const result = await sb()
      .from('announcements')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as Announcement;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('announcements').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async toggleActive(id: string, is_active: boolean): Promise<Announcement> {
    return this.update(id, { is_active });
  },
};

export const emergencyBroadcasts = {
  async listActive(orgId = requireOrgId()): Promise<EmergencyBroadcast[]> {
    const result = await sb()
      .from('emergency_broadcasts')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('issued_at', { ascending: false });
    return unwrap(result) as unknown as EmergencyBroadcast[];
  },

  async broadcast(input: {
    property_id?: string;
    type: EmergencyBroadcast['type'];
    headline: string;
    instructions: string;
  }): Promise<EmergencyBroadcast> {
    const { data, error } = await sb().rpc('broadcast_emergency', {
      p_organization_id: requireOrgId(),
      p_property_id: input.property_id ?? null,
      p_type: input.type,
      p_headline: input.headline,
      p_instructions: input.instructions,
    });
    if (error) throw new Error(error.message);
    const row = data as unknown as EmergencyBroadcast;

    try {
      const actor = requireUser();
      await notifications.notifyOrg(
        {
          title: `EMERGENCY: ${input.headline}`,
          message: `${input.type} — ${input.instructions}`,
          type: 'emergency',
          link: row.id,
        },
        actor.id
      );
    } catch (e) {
      console.warn('[emergency] notify failed', e);
    }

    return row;
  },

  async deactivate(id: string): Promise<void> {
    const { error } = await sb()
      .from('emergency_broadcasts')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },
};
