import { sb, unwrap, requireOrgId } from './_helpers';
import { uploadFile } from '../storage';
import type { Shop, UnitStatus, Property } from '../../types';

export interface ShopInput {
  shopping_center_id: string;
  property_id: string;
  shop_number: string;
  floor: string;
  size_sqm: number;
  rental_amount: number;
  deposit_amount: number;
  status: UnitStatus;
  public_listing: boolean;
  public_featured?: boolean;
  property_type: Property['type'];
  description?: string;
  power_specs?: string;
  parking_allocated?: number;
  available_from?: string;
  features?: string[];
  images?: string[];
  qr_code?: string;
}

export const shops = {
  async list(orgId = requireOrgId()): Promise<Shop[]> {
    const result = await sb()
      .from('shops')
      .select('*')
      .eq('organization_id', orgId)
      .order('shop_number', { ascending: true });
    return unwrap(result) as unknown as Shop[];
  },

  async publicAvailable(): Promise<Shop[]> {
    const result = await sb()
      .from('shops')
      .select('*')
      .eq('public_listing', true)
      .eq('status', 'Available');
    return unwrap(result) as unknown as Shop[];
  },

  async get(id: string): Promise<Shop> {
    const result = await sb().from('shops').select('*').eq('id', id).single();
    return unwrap(result) as unknown as Shop;
  },

  async create(input: ShopInput): Promise<Shop> {
    const orgId = requireOrgId();
    const result = await sb()
      .from('shops')
      .insert({
        ...input,
        organization_id: orgId,
        public_featured: input.public_featured ?? false,
        images: input.images ?? [],
        features: input.features ?? [],
        qr_code: input.qr_code ?? `UW-${input.shop_number.toUpperCase()}`,
      })
      .select()
      .single();
    return unwrap(result) as unknown as Shop;
  },

  async update(id: string, patch: Partial<Shop>): Promise<Shop> {
    const result = await sb()
      .from('shops')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as Shop;
  },

  /**
   * Safe delete: refuse if open tickets still reference this unit.
   * Detach tenants (clear shop_id) so FK cascades do not null organization_id
   * on tickets via broken triggers.
   */
  async remove(id: string): Promise<void> {
    const orgId = requireOrgId();

    const { count: ticketCount, error: tErr } = await sb()
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', id)
      .eq('organization_id', orgId)
      .not('status', 'in', '(Closed,Cancelled)');
    if (tErr) throw new Error(tErr.message);
    if ((ticketCount ?? 0) > 0) {
      throw new Error(
        `Cannot delete this unit: ${ticketCount} open ticket(s) still reference it. Close or reassign those tickets first.`
      );
    }

    // Detach tenants so they are not hard-orphaned without a clear error.
    await sb()
      .from('tenants')
      .update({ shop_id: null })
      .eq('shop_id', id)
      .eq('organization_id', orgId);

    // Cancel any leftover closed tickets' shop link is fine; open ones already blocked.
    // Soft-detach closed tickets to avoid ON DELETE SET NULL wiping organization_id.
    await sb()
      .from('tickets')
      .update({ shop_id: null })
      .eq('shop_id', id)
      .eq('organization_id', orgId);

    const { error } = await sb().from('shops').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async uploadImage(shopId: string, file: File): Promise<string> {
    const orgId = requireOrgId();
    const { publicUrl } = await uploadFile({
      bucket: 'shop-images',
      organizationId: orgId,
      entityId: shopId,
      file,
    });
    return publicUrl ?? '';
  },
};
