// src/components/onboarding/OnboardingChecklist.tsx
import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  X,
  ArrowRight,
  Building2,
  Users,
  FileBadge,
  Receipt,
  Sparkles,
} from 'lucide-react';

interface Step {
  id: string;
  label: string;
  description: string;
  tab: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Props {
  /** Live counts from the org — the checklist self-selects which steps to show. */
  centerCount: number;
  unitCount: number;
  tenantCount: number;
  leaseCount: number;
  invoiceCount: number;
  /** Called when the user clicks a step — should switch the active tab. */
  onNavigate: (tab: string) => void;
  /** Persist dismissal in localStorage per org. */
  storageKey: string;
}

const DISMISS_KEY_PREFIX = 'uw_onboarding_dismissed_';

export function OnboardingChecklist({
  centerCount,
  unitCount,
  tenantCount,
  leaseCount,
  invoiceCount,
  onNavigate,
  storageKey,
}: Props) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY_PREFIX + storageKey) === '1';
    } catch {
      return false;
    }
  });

  const steps = useMemo<Step[]>(() => {
    return [
      {
        id: 'centre',
        label: 'Add your first centre',
        description: 'A shopping centre is the root of your portfolio.',
        tab: 'centres',
        icon: Building2,
      },
      {
        id: 'units',
        label: 'Add units to the centre',
        description: 'Units are what tenants rent.',
        tab: 'units',
        icon: Building2,
      },
      {
        id: 'tenant',
        label: 'Register a tenant',
        description: 'Links a business to a unit and generates the occupancy.',
        tab: 'tenants_list',
        icon: Users,
      },
      {
        id: 'lease',
        label: 'Draft the first lease',
        description: 'The lease drives rent, deposit and renewal.',
        tab: 'leases',
        icon: FileBadge,
      },
      {
        id: 'invoice',
        label: 'Generate rent invoices',
        description: 'Kick off the monthly billing cycle.',
        tab: 'finance_overview',
        icon: Receipt,
      },
    ];
  }, []);

  const done = useMemo(() => {
    return {
      centre: centerCount > 0,
      units: unitCount > 0,
      tenant: tenantCount > 0,
      lease: leaseCount > 0,
      invoice: invoiceCount > 0,
    } as Record<string, boolean>;
  }, [centerCount, unitCount, tenantCount, leaseCount, invoiceCount]);

  const completedCount = Object.values(done).filter(Boolean).length;
  const allDone = completedCount === steps.length;

  // Hide entirely once everything is set up — no need for a "you're done" nag.
  if (allDone || dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY_PREFIX + storageKey, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100">
              Get your workspace set up
            </h3>
            <p className="text-[11px] text-blue-700 dark:text-blue-300">
              {completedCount} of {steps.length} complete
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50"
          aria-label="Dismiss onboarding checklist"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-blue-200/60 dark:bg-blue-900/60 overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <ul className="space-y-1.5">
        {steps.map((s) => {
          const isDone = done[s.id];
          const Icon = s.icon;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => !isDone && onNavigate(s.tab)}
                disabled={isDone}
                className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition ${
                  isDone
                    ? 'opacity-60 cursor-default'
                    : 'hover:bg-white/70 dark:hover:bg-slate-900/40'
                }`}
              >
                <span className="shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Circle className="w-4 h-4 text-blue-400" />
                  )}
                </span>
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isDone ? 'text-slate-400' : 'text-blue-600 dark:text-blue-400'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-xs font-semibold ${
                      isDone
                        ? 'text-slate-500 line-through'
                        : 'text-blue-900 dark:text-blue-100'
                    }`}
                  >
                    {s.label}
                  </span>
                  <span className="block text-[10px] text-blue-700/80 dark:text-blue-300/80">
                    {s.description}
                  </span>
                </span>
                {!isDone && (
                  <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
