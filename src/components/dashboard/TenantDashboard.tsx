import React, { useMemo } from 'react';
import {
  Ticket as TicketIcon,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileBadge,
  Phone,
  Megaphone,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { tickets as ticketsApi } from '../../services/api/tickets';
import { announcements as annApi } from '../../services/api/announcements';
import { leases as leasesApi } from '../../services/api/leases';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useRealtime } from '../../hooks/useRealtime';

interface Props {
  onOpenCreateTicket: () => void;
  onViewTicket: (id: string) => void;
}

export const TenantDashboard: React.FC<Props> = ({
  onOpenCreateTicket,
  onViewTicket,
}) => {
  const user = auth.getCurrentUser();
  const orgId = user?.organization_id ?? '';

  const { data: tickets = [] } = useSupabaseQuery(
    ['tickets', orgId],
    () => ticketsApi.list(),
    { enabled: !!orgId }
  );
  const { data: announcements = [] } = useSupabaseQuery(
    ['announcements', orgId],
    () => announcementsApi.active(),
    { enabled: !!orgId }
  );
  const { data: leases = [] } = useSupabaseQuery(
    ['leases', orgId],
    () => leasesApi.list(),
    { enabled: !!orgId }
  );
  const { data: tenants = [] } = useSupabaseQuery(
    ['tenants', orgId],
    () => tenantsApi.list(),
    { enabled: !!orgId }
  );

  useRealtime({
    table: 'tickets',
    filter: orgId ? `organization_id=eq.${orgId}` : undefined,
    invalidateKeys: ['tickets'],
    enabled: !!orgId,
  });

  const myTickets = useMemo(
    () =>
      tickets.filter((t) => {
        if (t.created_by_user_id === user?.id) return true;
        if (user?.shop_id && t.shop_id === user.shop_id) return true;
        return false;
      }),
    [tickets, user?.id, user?.shop_id]
  );

  const tenant = useMemo(
    () =>
      tenants.find((t) => t.user_id === user?.id) ??
      (user?.shop_id ? tenants.find((t) => t.shop_id === user.shop_id) : undefined),
    [tenants, user?.id, user?.shop_id]
  );

  const lease = useMemo(
    () => (tenant ? leases.find((l) => l.tenant_id === tenant.id) : undefined),
    [leases, tenant]
  );

  const openCount = myTickets.filter((t) => t.status === 'Open').length;
  const inProgress = myTickets.filter((t) => t.status === 'In Progress').length;
  const awaiting = myTickets.filter((t) => t.status === 'Resolved').length;
  const closed = myTickets.filter((t) => t.status === 'Closed').length;

  const firstResolvedId = useMemo(
    () => myTickets.find((t) => t.status === 'Resolved')?.id ?? null,
    [myTickets]
  );

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const handleReviewClick = () => {
    if (firstResolvedId) onViewTicket(firstResolvedId);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-900 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 inline-block">
            Tenant portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">
            {greeting}, {user?.name}
          </h1>
          <p className="text-xs text-blue-100 mt-1">
            {tenant?.business_name ?? 'Commercial tenant'}
          </p>
        </div>
        <button
          onClick={onOpenCreateTicket}
          className="px-5 py-2.5 bg-white hover:bg-blue-50 text-blue-800 rounded-xl text-xs font-bold shadow-md flex items-center gap-2"
          type="button"
        >
          <PlusCircle className="w-4 h-4 text-blue-600" /> Report issue
        </button>
      </div>

      {awaiting > 0 && firstResolvedId && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-amber-900 dark:text-amber-200">
                Action required: {awaiting} ticket{awaiting > 1 ? 's' : ''} marked
                Resolved
              </h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Please confirm or reopen.
              </p>
            </div>
          </div>
          <button
            onClick={handleReviewClick}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl"
            type="button"
          >
            Review
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Open" value={openCount} icon={TicketIcon} />
        <KpiCard label="In progress" value={inProgress} icon={Clock} />
        <KpiCard
          label="Awaiting confirm"
          value={awaiting}
          icon={AlertTriangle}
          highlight={awaiting > 0}
        />
        <KpiCard label="Closed" value={closed} icon={CheckCircle2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-bold">My tickets</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
            {myTickets.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No tickets yet.
              </div>
            ) : (
              myTickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onViewTicket(t.id)}
                  className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer flex items-center justify-between gap-4 border-b last:border-0"
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                        {t.ticket_number}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                        {t.status}
                      </span>
                    </div>
                    <div className="text-xs font-bold truncate">{t.title}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-semibold text-blue-600">
                      View →
                    </div>
                    <div className="text-[10px] text-slate-400">
                      SLA: {t.sla_status}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {announcements.length > 0 && (
            <>
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-blue-600" /> Announcements
              </h3>
              <div className="space-y-2">
                {announcements.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className="p-4 rounded-xl bg-white dark:bg-slate-800 border"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{a.title}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(a.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {a.message}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border space-y-4">
            <div className="flex items-center gap-2">
              <FileBadge className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider">
                Lease
              </h3>
            </div>
            {lease ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Rent</span>
                  <strong>E{lease.rental_amount.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Start</span>
                  <strong>{lease.start_date}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">End</span>
                  <strong>{lease.end_date}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Signed</span>
                  <strong
                    className={
                      lease.is_digitally_signed
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }
                  >
                    {lease.is_digitally_signed ? 'Verified' : 'Pending'}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">No lease on file.</div>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-600" /> Emergency hotlines
            </h3>
            {[
              { label: 'Security 24/7', phone: '+268 2416 1000' },
              { label: 'Property manager', phone: '+268 7602 0001' },
              { label: 'Senior tech', phone: '+268 7602 0003' },
            ].map((c) => (
              <div
                key={c.label}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold">{c.label}</div>
                </div>
                <a
                  href={`tel:${c.phone.replace(/\s/g, '')}`}
                  className="text-xs font-bold text-blue-600"
                >
                  {c.phone}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shared KPI card
// ---------------------------------------------------------------------------

export function KpiCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-2xl bg-white dark:bg-slate-800 border ${
        highlight
          ? 'border-amber-400 ring-1 ring-amber-300'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        <Icon
          className={`w-4 h-4 ${
            highlight ? 'text-amber-500' : 'text-slate-400'
          }`}
        />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
