import type { SubscriptionTier } from '../types';

export interface TierPlan {
  tier: SubscriptionTier;
  name: string;
  priceLabel: string;
  monthlyFeeE: number;
  propertyLimit: number;
  tenantLimit: number;
  userLimit: number;
  storageLimitGb: number;
  features: string[];
  active: boolean;
}

const STORAGE_KEY = 'umhlaba_subscription_plans_v1';

/** Platform fee as a share of the organisation's monthly rent roll. */
const RENT_ROLL_FEE_RATE = 0.02;

const DEFAULTS: TierPlan[] = [
  {
    tier: 'Starter',
    name: 'Starter',
    priceLabel: 'E999 / mo',
    monthlyFeeE: 999,
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
    monthlyFeeE: 2999,
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
    monthlyFeeE: 0,
    propertyLimit: 999,
    tenantLimit: 9999,
    userLimit: 500,
    storageLimitGb: 200,
    features: ['Unlimited centres', 'Dedicated support', 'Custom branding', 'Audit exports'],
    active: true,
  },
];

function normalise(p: Partial<TierPlan> & { tier: SubscriptionTier }): TierPlan {
  const base = DEFAULTS.find((d) => d.tier === p.tier) || DEFAULTS[0];
  const monthly =
    typeof p.monthlyFeeE === 'number'
      ? p.monthlyFeeE
      : typeof (p as { monthlyFee?: number }).monthlyFee === 'number'
        ? (p as { monthlyFee: number }).monthlyFee
        : base.monthlyFeeE;
  return {
    ...base,
    ...p,
    tier: p.tier,
    monthlyFeeE: monthly,
    priceLabel:
      p.priceLabel ||
      (monthly > 0 ? `E${monthly.toLocaleString()} / mo` : 'Custom'),
    active: p.active !== false,
  };
}

function load(): TierPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as Partial<TierPlan>[];
    if (!Array.isArray(parsed) || parsed.length === 0) return structuredClone(DEFAULTS);
    return DEFAULTS.map((d) => {
      const found = parsed.find((p) => p.tier === d.tier);
      return found ? normalise({ ...d, ...found, tier: d.tier }) : structuredClone(d);
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
    const plans = load().map((p) =>
      p.tier === tier
        ? normalise({
            ...p,
            ...patch,
            tier,
            priceLabel:
              patch.monthlyFeeE != null
                ? patch.monthlyFeeE > 0
                  ? `E${Number(patch.monthlyFeeE).toLocaleString()} / mo`
                  : 'Custom'
                : patch.priceLabel ?? p.priceLabel,
          })
        : p
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

  /**
   * Used by RegisterOrgModal fee preview.
   * total = tier base fee + 2% of estimated monthly rent roll.
   * Enterprise (monthlyFeeE === 0) is treated as custom / contact-sales (base 0).
   */
  estimateMonthlyFee(tier: SubscriptionTier, estimatedMonthlyRent = 0): {
    baseFee: number;
    rentRollFee: number;
    total: number;
    rate: number;
  } {
    const plan = this.get(tier);
    const baseFee = Number(plan.monthlyFeeE) || 0;
    const rent = Math.max(0, Number(estimatedMonthlyRent) || 0);
    const rentRollFee = Math.round(rent * RENT_ROLL_FEE_RATE);
    return {
      baseFee,
      rentRollFee,
      total: baseFee + rentRollFee,
      rate: RENT_ROLL_FEE_RATE,
    };
  },
};
