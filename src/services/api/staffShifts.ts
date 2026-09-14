import { sb, unwrap, requireOrgId } from './_helpers';
import type { StaffShift } from '../../types';

export const staffShifts = {
  async list(orgId = requireOrgId()): Promise<StaffShift[]> {
    const result = await sb()
      .from('staff_shifts')
      .select('*')
      .eq('organization_id', orgId)
      .order('date', { ascending: false });
    return unwrap(result) as unknown as StaffShift[];
  },

  async create(input: Omit<StaffShift, 'id' | 'organization_id'>): Promise<StaffShift> {
    const result = await sb()
      .from('staff_shifts')
      .insert({ ...input, organization_id: requireOrgId() })
      .select()
      .single();
    return unwrap(result) as unknown as StaffShift;
  },

  async update(id: string, patch: Partial<StaffShift>): Promise<StaffShift> {
    const result = await sb()
      .from('staff_shifts')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as StaffShift;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('staff_shifts').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
