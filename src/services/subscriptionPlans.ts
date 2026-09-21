// src/services/subscriptionPlans.ts
import type { SubscriptionTier } from '../types';

export interface TierPlan {
  tier: SubscriptionTier;
  name: string;
  /** Numeric monthly fee in SZL (E). Use priceLabel for display. */
  monthlyFeeE: number;
  /** Display string for pricing UI. Derived from monthlyFeeE when numeric. */
  priceLabel: string;
  propertyLimit: number;
  tenantLimit: number;
  userLimit: number;
  storageLimitGb: number;
  features: string[];
  active: boolean;
}

const STORAGE_KEY = 'umhlaba_subscription_plans_v1';

/**
 * Canonical tier definitions. Everything in the UI must read from here
 * (RegisterOrgModal, SuperAdminPortal, OrgSettingsView).
 */
const DEFAULTS: TierPlan[] = [
  {
    tier: 'Starter',
    name: 'Starter',
    monthlyFeeE: 1450,
    priceLabel: 'E1,450 / mo',
    propertyLimit: 2,
    tenantLimit: 50,
    userLimit: 10,
    storageLimitGb: 5,
    features: [
      'Up to 2 centres',
      '50 tenants',
      '10 staff users',
      'Basic SLA matrix',
    ],
    active: true,
  },
  {
    tier: 'Professional',
    name: 'Professional',
    monthlyFeeE: 3850,
    priceLabel: 'E3,850 / mo',
    propertyLimit: 10,
    tenantLimit: 250,
    userLimit: 40,
    storageLimitGb: 25,
    features: [
      '10 centres',
      '250 tenants',
      '40 staff users',
      'Commercial engine',
      'Priority support',
    ],
    active: true,
  },
  {
    tier: 'Enterprise',
    name: 'Enterprise',
    monthlyFeeE: 8900,
    priceLabel: 'E8,900 / mo',
    propertyLimit: 999,
    tenantLimit: 9999,
    userLimit: 500,
    storageLimitGb: 200,
    features: [
      'Unlimited centres',
      'Dedicated support',
      'Custom branding',
      'Audit exports',
    ],
    active: true,
  },
];

function load(): TierPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as TierPlan[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return structuredClone(DEFAULTS);
    }
    // Merge so any new fields added to DEFAULTS show up even for stored rows.
    return DEFAULTS.map((d) => {
      const found = parsed.find((p) => p.tier === d.tier);
      return found ? { ...d, ...found, tier: d.tier } : d;
    });
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function save(plans: TierPlan[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

export const subscriptionPlans = {
  list(): TierPlan[] {
    return load();
  },

  get(tier: SubscriptionTier): TierPlan {
    return (
      load().find((p) => p.tier === tier) ||
      DEFAULTS.find((p) => p.tier === tier)!
    );
  },

  update(
    tier: SubscriptionTier,
    patch: Partial<Omit<TierPlan, 'tier'>>
  ): TierPlan[] {
    const plans = load().map((p) =>
      p.tier === tier ? { ...p, ...patch, tier } : p
    );
    save(plans);
    return plans;
  },

  reset(): TierPlan[] {
    save(structuredClone(DEFAULTS));
    return structuredClone(DEFAULTS);
  },

  limitsFor(tier: SubscriptionTier) {
    const p = this.get(tier);
    return {
      property_limit: p.propertyLimit,
      tenant_limit: p.tenantLimit,
      user_limit: p.userLimit,
      storage_limit: p.storageLimitGb,
    };
  },

  /** Numeric monthly fee for a tier. Used by RegisterOrgModal fee preview. */
  monthlyFeeFor(tier: SubscriptionTier): number {
    return this.get(tier).monthlyFeeE;
  },

  /**
   * Live fee preview used at registration.
   * Base tier fee + 2% of estimated monthly rent roll.
   */
  estimateMonthlyFee(
    tier: SubscriptionTier,
    estimatedMonthlyRental: number
  ): { baseFee: number; rentRollFee: number; total: number } {
    const baseFee = this.monthlyFeeFor(tier);
    const rentRollFee = Math.round((estimatedMonthlyRental || 0) * 0.02);
    return { baseFee, rentRollFee, total: baseFee + rentRollFee };
  },
};

export type { TierPlan as SubscriptionPlan };
