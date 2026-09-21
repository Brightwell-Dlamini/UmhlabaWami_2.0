import { sb, unwrap } from './_helpers';
import type { AuditLog } from '../../types';

export const auditLogs = {
  async list(orgId?: string, limit = 200): Promise<AuditLog[]> {
    let q = sb()
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (orgId) q = q.eq('organization_id', orgId);
    const result = await q;
    return unwrap(result) as unknown as AuditLog[];
  },

  async create(entry: {
    user_id: string;
    user_name: string;
    action: string;
    entity_type: string;
    entity_id: string;
    organization_id?: string | null;
    details?: string;
  }): Promise<AuditLog | null> {
    try {
      const result = await sb()
        .from('audit_logs')
        .insert({
          user_id: entry.user_id,
          user_name: entry.user_name,
          action: entry.action,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          organization_id: entry.organization_id ?? null,
          details: entry.details ?? null,
          timestamp: new Date().toISOString(),
        })
        .select()
        .single();
      if (result.error) {
        console.warn('[auditLogs] insert failed', result.error.message);
        return null;
      }
      return result.data as unknown as AuditLog;
    } catch (e) {
      console.warn('[auditLogs] insert exception', e);
      return null;
    }
  },
};
