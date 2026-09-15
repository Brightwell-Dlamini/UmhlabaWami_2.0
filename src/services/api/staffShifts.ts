import { sb, unwrap, requireOrgId } from './_helpers';
import type { StaffShift } from '../../types';

interface CreateShiftInput {
  staff_name: string;
  staff_role: string;
  date: string;
  shift_type: string;
  status: string;
  notes?: string | null;
  property_id?: string | null;
  staff_id?: string | null;
}

export const staffShifts = {
  async list(orgId = requireOrgId()): Promise<StaffShift[]> {
    const result = await sb()
      .from('staff_shifts')
      .select('*')
      .eq('organization_id', orgId)
      .order('date', { ascending: false });
    return unwrap(result) as unknown as StaffShift[];
  },

  async create(input: CreateShiftInput): Promise<StaffShift> {
    const result = await sb()
      .from('staff_shifts')
      .insert({
        organization_id: requireOrgId(),
        staff_name: input.staff_name,
        staff_role: input.staff_role,
        date: input.date,
        shift_type: input.shift_type,
        status: input.status,
        notes: input.notes ?? null,
        property_id: input.property_id ?? null,
        staff_id: input.staff_id ?? null,
      })
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
