import { sb, unwrap } from './_helpers';
import type { SubscriptionTier } from '../../types';

export interface SubscriptionTierRow {
  id: string;
  tier_key: string;
  name: string;
  price_label: string;
  property_limit: number;
  tenant_limit: number;
  user_limit: number;
  storage_limit_gb: number;
  features: string[];
  active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export const subscriptionTiersApi = {
  async list(): Promise<SubscriptionTierRow[]> {
    const result = await sb()
      .from('subscription_tiers')
      .select('*')
      .order('sort_order', { ascending: true });
    return unwrap(result) as unknown as SubscriptionTierRow[];
  },

  async create(row: Omit<SubscriptionTierRow, 'id' | 'created_at' | 'updated_at'>): Promise<SubscriptionTierRow> {
    const result = await sb()
      .from('subscription_tiers')
      .insert({
        ...row,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    return unwrap(result) as unknown as SubscriptionTierRow;
  },

  async update(
    id: string,
    patch: Partial<Omit<SubscriptionTierRow, 'id' | 'created_at'>>
  ): Promise<SubscriptionTierRow> {
    const result = await sb()
      .from('subscription_tiers')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return unwrap(result) as unknown as SubscriptionTierRow;
  },

  async remove(id: string): Promise<void> {
    const result = await sb().from('subscription_tiers').delete().eq('id', id);
    if (result.error) throw new Error(result.error.message);
  },

  limitsForKey(tierKey: string, rows: SubscriptionTierRow[]) {
    const p = rows.find((r) => r.tier_key === tierKey);
    if (!p) {
      return { property_limit: 2, tenant_limit: 50, user_limit: 10, storage_limit: 5 };
    }
    return {
      property_limit: p.property_limit,
      tenant_limit: p.tenant_limit,
      user_limit: p.user_limit,
      storage_limit: p.storage_limit_gb,
    };
  },
};

/** Map known enum keys for org.subscription_tier column */
export function asOrgTier(key: string): SubscriptionTier {
  if (key === 'Professional' || key === 'Enterprise' || key === 'Starter') return key;
  return 'Starter';
}
