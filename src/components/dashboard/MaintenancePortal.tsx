import React, { useMemo, useState } from 'react';
import { Wrench, Clock, Play, MapPin } from 'lucide-react';
import { auth } from '../../services/auth';
import { tickets as ticketsApi } from '../../services/api/tickets';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';

interface Props {
  onViewTicket: (ticketId: string) => void;
}

export const MaintenancePortal: React.FC<Props> = ({ onViewTicket }) => {
  const currentUser = auth.getCurrentUser();
  const [activeTab, setActiveTab] = useState<'my_jobs' | 'new_jobs' | 'completed'>('my_jobs');

  const { data: allTickets = [], loading } = useSupabaseQuery(
    ['tickets', currentUser?.organization_id ?? ''],
    () => ticketsApi.list(),
    { enabled: !!currentUser?.organization_id }
  );

  useRealtime({
    table: 'tickets',
    filter: currentUser?.organization_id
      ? `organization_id=eq.${currentUser.organization_id}`
      : undefined,
    invalidateKeys: ['tickets'],
    enabled: !!currentUser?.organization_id,
  });

  const accept = useSupabaseMutation({
    mutationFn: ({ id }: { id: string }) => ticketsApi.accept(id),
    invalidateKeys: ['tickets', 'notifications'],
  });

  const claim = useSupabaseMutation({
    mutationFn: ({ id, techId, techName }: { id: string; techId: string; techName: string }) =>
      ticketsApi.assign(id, techId, techName).then(() => ticketsApi.accept(id)),
    invalidateKeys: ['tickets', 'notifications'],
  });

  const { myActiveJobs, unassignedNewJobs, completedJobs } = useMemo(() => {
    const mine = allTickets.filter(
      (t) => t.assigned_to === currentUser?.id && ['In Progress', 'Open', 'Reopened'].includes(t.status)
    );
    const unassigned = allTickets.filter((t) => !t.assigned_to && t.status === 'Open');
    const done = allTickets.filter(
      (t) => t.assigned_to === currentUser?.id && ['Resolved', 'Closed'].includes(t.status)
    );
    return { myActiveJobs: mine, unassignedNewJobs: unassigned, completedJobs: done };
  }, [allTickets, currentUser?.id]);

  const jobs = activeTab === 'my_jobs' ? myActiveJobs : activeTab === 'new_jobs' ? unassignedNewJobs : completedJobs;

  return (
    <div className="space-y-6 pb-12">
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-800 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold px-2 py-0.5 rounded bg-black/20 text-amber-100 inline-block">
            Mobile maintenance desk
          </div>
          <h1 className="text-2xl font-bold mt-1">Technician queue: {currentUser?.name}</h1>
          <p className="text-xs text-amber-100">Real-time job dispatch, work logs, and photo evidence</p>
        </div>
        <div className="flex items-center gap-3 text-xs bg-black/20 px-3 py-2 rounded-xl">
          <div>
            <div className="text-[10px] text-amber-200 uppercase">Active</div>
            <div className="text-lg font-extrabold">{myActiveJobs.length}</div>
          </div>
          <div className="w-px h-8 bg-amber-400/30" />
          <div>
            <div className="text-[10px] text-amber-200 uppercase">Unassigned</div>
            <div className="text-lg font-extrabold">{unassignedNewJobs.length}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b pb-2">
        {[
          { id: 'my_jobs', label: `My Jobs (${myActiveJobs.length})` },
          { id: 'new_jobs', label: `Dispatch Pool (${unassignedNewJobs.length})` },
          { id: 'completed', label: `Completed (${completedJobs.length})` },
        ].map((tab) => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && jobs.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-xs text-slate-400">Loading jobs…</div>
        ) : jobs.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-xs text-slate-400">No jobs in this queue.</div>
        ) : jobs.map((t) => (
          <div key={t.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4 hover:border-blue-400 transition flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                  {t.ticket_number}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  t.priority === 'Emergency' ? 'bg-red-600 text-white'
                  : t.priority === 'High' ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700'
                }`}>{t.priority}</span>
              </div>
              <h3 className="font-bold text-sm">{t.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{t.description}</p>
              {t.exact_location_description && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-[11px] flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>{t.exact_location_description}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(t.resolution_deadline).toLocaleString()}</span>
                </div>
                <span className="font-bold">{t.sla_status}</span>
              </div>
            </div>

            <div className="pt-3 border-t flex gap-2">
              {activeTab === 'new_jobs' ? (
                <button
                  onClick={() => currentUser && claim.mutate({ id: t.id, techId: currentUser.id, techName: currentUser.name })}
                  disabled={claim.loading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl">
                  Claim &amp; start
                </button>
              ) : t.status === 'Open' ? (
                <button onClick={() => accept.mutate({ id: t.id })} disabled={accept.loading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1">
                  <Play className="w-3.5 h-3.5" /> Start work
                </button>
              ) : (
                <button onClick={() => onViewTicket(t.id)}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1">
                  <Wrench className="w-3.5 h-3.5" /> Log work &amp; resolve
                </button>
              )}
              <button onClick={() => onViewTicket(t.id)}
                className="py-2 px-3 bg-slate-100 dark:bg-slate-700 text-xs font-semibold rounded-xl">
                Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
