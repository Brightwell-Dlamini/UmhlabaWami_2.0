import { sb, unwrap } from './_helpers';
import type { AuditLog } from '../../types';

export const auditLogs = {
  async list(orgId?: string, limit = 200): Promise<AuditLog[]> {
    let q = sb().from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(limit);
    if (orgId) q = q.eq('organization_id', orgId);
    const result = await q;
    return unwrap(result) as unknown as AuditLog[];
  },
};
