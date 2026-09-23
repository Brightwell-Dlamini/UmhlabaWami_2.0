import { sb, unwrap, requireOrgId, requireUser } from './_helpers';
import { profiles } from './profiles';
import { shops } from './shops';
import type { Tenant, Shop } from '../../types';

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

export interface AssignTenantInput {
  shop: Pick<
    Shop,
    'id' | 'property_id' | 'shopping_center_id' | 'shop_number' | 'rental_amount'
  >;
  business_name: string;
  contact_person: string;
  phone: string;
  email: string;
  trade_type?: string;
  move_in_date?: string;
  /** When true, creates a portal login (role=tenant) and links it. */
  createPortal?: boolean;
  password?: string;
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

  /**
   * Unit-first happy path: create tenant on a vacant unit, optionally create
   * portal login, then mark the unit Occupied. One call, no dual staff/tenant flow.
   */
  async assignToUnit(input: AssignTenantInput): Promise<Tenant> {
    const email = input.email.trim().toLowerCase();
    const contact = input.contact_person.trim();
    const business = input.business_name.trim();
    if (!business) throw new Error('Business name is required.');
    if (!contact) throw new Error('Contact person is required.');
    if (!email) throw new Error('Email is required.');

    let userId: string | undefined;

    if (input.createPortal) {
      if (!input.password || input.password.length < 8) {
        throw new Error('Portal password must be at least 8 characters.');
      }
      const { userId: id } = await profiles.addStaff({
        email,
        name: contact,
        role: 'tenant',
        password: input.password,
        phone: input.phone?.trim() || undefined,
      });
      userId = id;
    }

    const tenant = await this.create({
      property_id: input.shop.property_id,
      shopping_center_id: input.shop.shopping_center_id,
      shop_id: input.shop.id,
      business_name: business,
      contact_person: contact,
      phone: input.phone?.trim() || '',
      email,
      trade_type: input.trade_type?.trim() || 'Retail',
      move_in_date: input.move_in_date,
      status: 'Active',
      user_id: userId,
    });

    try {
      await shops.update(input.shop.id, { status: 'Occupied' });
    } catch (e) {
      console.warn('[tenants.assignToUnit] unit status update failed', e);
    }

    return tenant;
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
