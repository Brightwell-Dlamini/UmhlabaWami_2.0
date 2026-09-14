import { sb, unwrap, requireOrgId } from './_helpers';
import type { ShoppingCenter } from '../../types';

export const shoppingCenters = {
  async list(orgId = requireOrgId()): Promise<ShoppingCenter[]> {
    const result = await sb()
      .from('shopping_centers')
      .select('*')
      .eq('organization_id', orgId)
      .order('name', { ascending: true });
    return unwrap(result) as unknown as ShoppingCenter[];
  },

  async get(id: string): Promise<ShoppingCenter> {
    const result = await sb()
      .from('shopping_centers')
      .select('*')
      .eq('id', id)
      .single();
    return unwrap(result) as unknown as ShoppingCenter;
  },

  async create(input: {
    name: string;
    address: string;
    location: string;
    description?: string;
    image?: string;
    operating_hours?: string;
    parking_bays?: number;
    amenities?: string[];
  }): Promise<ShoppingCenter> {
    const result = await sb()
      .from('shopping_centers')
      .insert({ ...input, organization_id: requireOrgId(), status: 'Active' })
      .select()
      .single();
    return unwrap(result) as unknown as ShoppingCenter;
  },

  async update(id: string, patch: Partial<ShoppingCenter>): Promise<ShoppingCenter> {
    const result = await sb()
      .from('shopping_centers')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as ShoppingCenter;
  },

  async remove(id: string): Promise<void> {
    const { error } = await sb().from('shopping_centers').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
