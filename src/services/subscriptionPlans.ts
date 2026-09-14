import type { SubscriptionTier } from '../types';

export interface TierPlan {
  tier: SubscriptionTier;
  name: string;
  priceLabel: string;
  propertyLimit: number;
  tenantLimit: number;
  userLimit: number;
  storageLimitGb: number;
  features: string[];
  active: boolean;
}

const STORAGE_KEY = 'umhlaba_subscription_plans_v1';

const DEFAULTS: TierPlan[] = [
  {
    tier: 'Starter',
    name: 'Starter',
    priceLabel: 'E999 / mo',
    propertyLimit: 2,
    tenantLimit: 50,
    userLimit: 10,
    storageLimitGb: 5,
    features: ['Up to 2 centres', '50 tenants', '10 staff users', 'Basic SLA'],
    active: true,
  },
  {
    tier: 'Professional',
    name: 'Professional',
    priceLabel: 'E2,999 / mo',
    propertyLimit: 10,
    tenantLimit: 250,
    userLimit: 40,
    storageLimitGb: 25,
    features: ['10 centres', '250 tenants', '40 staff', 'Commercial engine', 'Priority support'],
    active: true,
  },
  {
    tier: 'Enterprise',
    name: 'Enterprise',
    priceLabel: 'Custom',
    propertyLimit: 999,
    tenantLimit: 9999,
    userLimit: 500,
    storageLimitGb: 200,
    features: ['Unlimited centres', 'Dedicated support', 'Custom branding', 'Audit exports'],
    active: true,
  },
];

function load(): TierPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as TierPlan[];
    if (!Array.isArray(parsed) || parsed.length === 0) return structuredClone(DEFAULTS);
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
    return load().find((p) => p.tier === tier) || DEFAULTS.find((p) => p.tier === tier)!;
  },

  update(tier: SubscriptionTier, patch: Partial<Omit<TierPlan, 'tier'>>): TierPlan[] {
    const plans = load().map((p) => (p.tier === tier ? { ...p, ...patch, tier } : p));
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
};
