import { sb, unwrap, requireOrgId } from './_helpers';
import type { SlaRule, TicketPriority } from '../../types';

const DEFAULT_RULES: SlaRule[] = [
  { priority: 'Emergency', response_minutes: 15, resolution_minutes: 240 },
  { priority: 'High', response_minutes: 60, resolution_minutes: 480 },
  { priority: 'Medium', response_minutes: 240, resolution_minutes: 1440 },
  { priority: 'Low', response_minutes: 1440, resolution_minutes: 4320 },
];

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

  /** Fill in missing priorities with defaults. Used by SlaMatrixView. */
  normalise(rules: SlaRule[]): SlaRule[] {
    return DEFAULT_RULES.map((def) => {
      const found = rules.find((r) => r.priority === def.priority);
      return found ?? { ...def };
    });
  },

  defaults(): SlaRule[] {
    return DEFAULT_RULES.map((r) => ({ ...r }));
  },

  defaultFor(priority: TicketPriority): SlaRule {
    return (
      DEFAULT_RULES.find((r) => r.priority === priority) ?? { ...DEFAULT_RULES[2] }
    );
  },
};
