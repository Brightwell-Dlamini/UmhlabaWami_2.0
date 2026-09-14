import { sb, unwrap, requireOrgId } from './_helpers';
import type { SlaRule } from '../../types';

export const slaMatrix = {
  async list(orgId = requireOrgId()): Promise<SlaRule[]> {
    const result = await sb()
      .from('sla_matrix')
      .select('priority, response_minutes, resolution_minutes')
      .eq('organization_id', orgId);
    return unwrap(result) as unknown as SlaRule[];
  },

  async upsert(rules: SlaRule[], orgId = requireOrgId()): Promise<void> {
    const rows = rules.map((r) => ({
      organization_id: orgId,
      priority: r.priority,
      response_minutes: r.response_minutes,
      resolution_minutes: r.resolution_minutes,
    }));
    const { error } = await sb()
      .from('sla_matrix')
      .upsert(rows, { onConflict: 'organization_id,priority' });
    if (error) throw new Error(error.message);
  },
};
