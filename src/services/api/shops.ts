import { sb, unwrap, requireOrgId } from './_helpers';
import { isMemoryMode, getMemoryDb } from './mode';
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
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      return db.shops
        .filter((s) => s.organization_id === orgId)
        .slice()
        .sort((a, b) => a.shop_number.localeCompare(b.shop_number));
    }
    const result = await sb()
      .from('shops')
      .select('*')
      .eq('organization_id', orgId)
      .order('shop_number', { ascending: true });
    return unwrap(result) as unknown as Shop[];
  },

  /** Public marketplace listings — no auth required. */
  async publicAvailable(): Promise<Shop[]> {
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      return db.shops.filter(
        (s) => s.public_listing && s.status === 'Available'
      );
    }
    const result = await sb()
      .from('shops')
      .select('*')
      .eq('public_listing', true)
      .eq('status', 'Available');
    return unwrap(result) as unknown as Shop[];
  },

  async get(id: string): Promise<Shop> {
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      const found = db.shops.find((s) => s.id === id);
      if (!found) throw new Error('Shop not found.');
      return found;
    }
    const result = await sb().from('shops').select('*').eq('id', id).single();
    return unwrap(result) as unknown as Shop;
  },

  async create(input: ShopInput): Promise<Shop> {
    const orgId = requireOrgId();
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      const created = db.addShop({
        ...input,
        organization_id: orgId,
        public_featured: input.public_featured ?? false,
        images: input.images ?? [],
        features: input.features ?? [],
        qr_code: input.qr_code ?? `UW-${input.shop_number.toUpperCase()}`,
      } as Omit<Shop, 'id'>);
      return created;
    }
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
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      db.updateShop(id, patch);
      const updated = db.shops.find((s) => s.id === id);
      if (!updated) throw new Error('Shop not found after update.');
      return updated;
    }
    const result = await sb()
      .from('shops')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as Shop;
  },

  async remove(id: string): Promise<void> {
    if (isMemoryMode()) {
      const db = await getMemoryDb();
      db.deleteShop(id);
      return;
    }
    const { error } = await sb().from('shops').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  /** Upload one image and attach its public URL to the shop. */
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
