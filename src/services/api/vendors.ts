import { sb, unwrap, requireOrgId } from './_helpers';
import type { Vendor } from '../../types';

export const vendors = {
  async list(orgId = requireOrgId()): Promise<Vendor[]> {
    const result = await sb()
      .from('vendors')
      .select('*')
      .eq('organization_id', orgId)
      .order('company_name', { ascending: true });
    return unwrap(result) as unknown as Vendor[];
  },

  async create(input: Omit<Vendor, 'id' | 'organization_id'>): Promise<Vendor> {
    const result = await sb()
      .from('vendors')
      .insert({ ...input, organization_id: requireOrgId() })
      .select()
      .single();
    return unwrap(result) as unknown as Vendor;
  },

  async update(id: string, patch: Partial<Vendor>): Promise<Vendor> {
    const result = await sb()
      .from('vendors')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as Vendor;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('vendors').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
