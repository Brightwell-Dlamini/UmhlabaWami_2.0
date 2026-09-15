import React from 'react';
import {
  Activity, Building2, Clock, Flame, Users, Wrench, CheckCircle2,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { centrePulse } from '../../services/api/centrePulse';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';

interface Props {
  shoppingCenterId?: string;
}

export function CentrePulseView({ shoppingCenterId }: Props) {
  const org = auth.getCurrentOrganization();
  const orgId = org?.id ?? '';

  const { data: snapshot, loading, error } = useSupabaseQuery(
    ['centre_pulse', orgId, shoppingCenterId ?? ''],
    () => centrePulse.fetch(orgId, shoppingCenterId),
    { enabled: !!orgId, refreshInterval: 60_000 }
  );

  if (!orgId) {
    return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;
  }
  if (loading && !snapshot) {
    return <div className="p-6 text-slate-500 text-sm">Loading Centre Pulse…</div>;
  }
  if (error && !snapshot) {
    return <div className="p-6 text-red-500 text-sm">{error.message}</div>;
  }
  if (!snapshot) return null;

  const cards = [
    {
      label: 'Open tickets',
      value: snapshot.openTickets,
      icon: Wrench,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Overdue/escalated',
      value: snapshot.overdueTickets,
      icon: Clock,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Emergencies',
      value: snapshot.emergencyTickets,
      icon: Flame,
      tone: 'bg-red-50 text-red-700',
    },
    {
      label: 'Occupancy',
      value: `${snapshot.occupancyRate}%`,
      sub: `${snapshot.occupiedUnits}/${snapshot.totalUnits}`,
      icon: Building2,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Available units',
      value: snapshot.availableUnits,
      icon: CheckCircle2,
      tone: 'bg-slate-50 text-slate-700',
    },
    {
      label: 'Active vendors',
      value: snapshot.activeVendors,
      icon: Users,
      tone: 'bg-indigo-50 text-indigo-700',
    },
    {
      label: 'Staff on duty',
      value: snapshot.staffOnDutyToday,
      icon: Activity,
      tone: 'bg-cyan-50 text-cyan-700',
    },
    {
      label: 'PM due this week',
      value: snapshot.pmDueThisWeek,
      icon: Wrench,
      tone: 'bg-violet-50 text-violet-700',
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Centre Pulse</h1>
          <p className="text-sm text-slate-500 mt-1">
            Live operations snapshot, refreshes every minute
          </p>
        </div>
        <p className="text-xs text-slate-400">
          Updated {new Date(snapshot.generatedAt).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border bg-white dark:bg-slate-900 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {c.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold">{c.value}</p>
                  {c.sub && <p className="mt-1 text-xs text-slate-500">{c.sub}</p>}
                </div>
                <div className={`rounded-lg p-2 ${c.tone}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
