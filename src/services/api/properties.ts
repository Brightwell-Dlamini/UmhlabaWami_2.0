import { sb, unwrap, requireOrgId } from './_helpers';
import type { Property } from '../../types';

export const properties = {
  async list(orgId = requireOrgId()): Promise<Property[]> {
    const result = await sb()
      .from('properties')
      .select('*')
      .eq('organization_id', orgId)
      .order('name', { ascending: true });
    return unwrap(result) as unknown as Property[];
  },

  async byCenter(centerId: string): Promise<Property[]> {
    const result = await sb()
      .from('properties')
      .select('*')
      .eq('shopping_center_id', centerId);
    return unwrap(result) as unknown as Property[];
  },

  async get(id: string): Promise<Property> {
    const result = await sb()
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();
    return unwrap(result) as unknown as Property;
  },

  async create(input: {
    shopping_center_id: string;
    name: string;
    type: Property['type'];
    address: string;
    description?: string;
  }): Promise<Property> {
    const result = await sb()
      .from('properties')
      .insert({ ...input, organization_id: requireOrgId(), status: 'Active' })
      .select()
      .single();
    return unwrap(result) as unknown as Property;
  },

  async update(id: string, patch: Partial<Property>): Promise<Property> {
    const result = await sb()
      .from('properties')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as Property;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('properties').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
