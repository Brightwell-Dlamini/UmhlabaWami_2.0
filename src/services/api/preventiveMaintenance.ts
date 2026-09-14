import { sb, unwrap, requireOrgId } from './_helpers';
import type { TicketCategory } from '../../types';

export interface PmTask {
  id: string;
  organization_id: string;
  shopping_center_id: string | null;
  title: string;
  category: TicketCategory;
  frequency_days: number;
  next_due_at: string;
  last_completed_at: string | null;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue';
  notes: string | null;
  created_at: string;
}

export const preventiveMaintenance = {
  async list(orgId = requireOrgId()): Promise<PmTask[]> {
    const result = await sb()
      .from('preventive_maintenance')
      .select('*')
      .eq('organization_id', orgId)
      .order('next_due_at', { ascending: true });
    return unwrap(result) as unknown as PmTask[];
  },

  async create(input: {
    shopping_center_id?: string;
    title: string;
    category: TicketCategory;
    frequency_days: number;
    notes?: string;
  }): Promise<PmTask> {
    const next = new Date();
    next.setDate(next.getDate() + input.frequency_days);
    const result = await sb()
      .from('preventive_maintenance')
      .insert({
        organization_id: requireOrgId(),
        shopping_center_id: input.shopping_center_id ?? null,
        title: input.title,
        category: input.category,
        frequency_days: input.frequency_days,
        next_due_at: next.toISOString(),
        notes: input.notes ?? null,
        status: 'Scheduled',
      })
      .select()
      .single();
    return unwrap(result) as unknown as PmTask;
  },

  async complete(id: string): Promise<PmTask> {
    const { data, error } = await sb().rpc('complete_pm_task', { p_task_id: id });
    if (error) throw new Error(error.message);
    return data as unknown as PmTask;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('preventive_maintenance').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
