import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import type { Tenant } from '../../types';

export interface TenantInput {
  property_id: string;
  shopping_center_id: string;
  shop_id: string;
  business_name: string;
  contact_person: string;
  phone: string;
  email: string;
  trade_type: string;
  move_in_date?: string;
  status?: Tenant['status'];
  user_id?: string;
}

export const tenants = {
  async list(orgId = requireOrgId()): Promise<Tenant[]> {
    const result = await sb()
      .from('tenants')
      .select('*')
      .eq('organization_id', orgId)
      .order('business_name', { ascending: true });
    return unwrap(result) as unknown as Tenant[];
  },

  async get(id: string): Promise<Tenant> {
    const result = await sb()
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single();
    return unwrap(result) as unknown as Tenant;
  },

  async create(input: TenantInput): Promise<Tenant> {
    const user = requireUser();
    const orgId = requireOrgId();
    const { data, error } = await sb().rpc('add_tenant', {
      p_organization_id: orgId,
      p_property_id: input.property_id,
      p_shopping_center_id: input.shopping_center_id,
      p_shop_id: input.shop_id,
      p_business_name: input.business_name,
      p_contact_person: input.contact_person,
      p_phone: input.phone,
      p_email: input.email,
      p_trade_type: input.trade_type,
      p_move_in_date: input.move_in_date ?? new Date().toISOString().slice(0, 10),
      p_status: input.status ?? 'Active',
      p_user_id: input.user_id ?? null,
    });
    if (error) throw new Error(error.message);
    return data as unknown as Tenant;
  },

  async update(id: string, patch: Partial<Tenant>): Promise<Tenant> {
    const result = await sb()
      .from('tenants')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as Tenant;
  },

  async remove(id: string): Promise<void> {
    const user = requireUser();
    const { error } = await sb().rpc('delete_tenant', {
      p_tenant_id: id,
      p_actor_name: user.name,
    });
    if (error) throw new Error(error.message);
  },
};
