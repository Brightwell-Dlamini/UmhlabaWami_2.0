// src/components/dashboard/TicketsListView.tsx
import React, { useMemo, useState } from 'react';
import {
  Ticket as TicketIcon,
  Search,
  PlusCircle,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { tickets as ticketsApi } from '../../services/api/tickets';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useRealtime } from '../../hooks/useRealtime';

interface Props {
  onViewTicket: (id: string) => void;
  onOpenCreateTicket: () => void;
}

type StatusChip = {
  key: string;
  label: string;
  value: string | null;
  priority?: string;
  tone: 'amber' | 'red' | 'blue' | 'emerald';
  icon: React.ComponentType<{ className?: string }>;
};

const STATUS_CHIPS: StatusChip[] = [
  { key: 'open', label: 'Open Tickets', value: 'Open', tone: 'amber', icon: AlertTriangle },
  { key: 'emergency', label: 'Active Emergencies', value: null, priority: 'Emergency', tone: 'red', icon: AlertTriangle },
  { key: 'progress', label: 'In Progress', value: 'In Progress', tone: 'blue', icon: Clock },
  { key: 'resolved', label: 'Resolved / Closed', value: 'Resolved', tone: 'emerald', icon: CheckCircle2 },
];

const CHIP_TONES: Record<StatusChip['tone'], { text: string; bg: string }> = {
  amber: { text: 'text-amber-600 dark:text-amber-400', bg: 'hover:border-amber-400' },
  red: { text: 'text-red-600 dark:text-red-400', bg: 'hover:border-red-400' },
  blue: { text: 'text-blue-600 dark:text-blue-400', bg: 'hover:border-blue-400' },
  emerald: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'hover:border-emerald-400' },
};

export const TicketsListView: React.FC<Props> = ({ onViewTicket, onOpenCreateTicket }) => {
  const currentUser = auth.getCurrentUser();
  const orgId = currentUser?.organization_id ?? '';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const { data: allTickets = [], loading, error } = useSupabaseQuery(
    ['tickets', 'lite', orgId],
    () => ticketsApi.listLite(),
    { enabled: !!orgId }
  );

  useRealtime({
    table: 'tickets',
    filter: orgId ? `organization_id=eq.${orgId}` : undefined,
    invalidateKeys: ['tickets'],
    enabled: !!orgId,
  });

  const displayedTickets = useMemo(() => {
    return allTickets.filter((t) => {
      if (currentUser?.role === 'tenant') {
        const mineByUser = t.created_by_user_id === currentUser.id;
        const mineByShop = !!currentUser.shop_id && t.shop_id === currentUser.shop_id;
        if (!mineByUser && !mineByShop) return false;
      }
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.ticket_number.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allTickets, currentUser, statusFilter, priorityFilter, categoryFilter, searchQuery]);

  const counts = useMemo(
    () => ({
      open: allTickets.filter((t) => t.status === 'Open').length,
      emergency: allTickets.filter((t) => t.priority === 'Emergency' && t.status !== 'Closed').length,
      progress: allTickets.filter((t) => t.status === 'In Progress').length,
      resolved: allTickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length,
    }),
    [allTickets]
  );

  const handleChipClick = (chip: StatusChip) => {
    if (chip.priority) {
      setPriorityFilter(chip.priority);
      setStatusFilter('All');
      return;
    }
    setStatusFilter(chip.value ?? 'All');
    setPriorityFilter('All');
  };

  const clearFilters = () => {
    setStatusFilter('All');
    setPriorityFilter('All');
    setCategoryFilter('All');
    setSearchQuery('');
  };

  const hasActiveFilters =
    statusFilter !== 'All' || priorityFilter !== 'All' || categoryFilter !== 'All' || searchQuery.trim() !== '';

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TicketIcon className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Tickets & SLA Operations Desk
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track, assign, and resolve commercial maintenance requests with live SLA monitoring
          </p>
        </div>
        <button
          onClick={onOpenCreateTicket}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2"
          type="button"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Log New Ticket</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_CHIPS.map((chip) => {
          const Icon = chip.icon;
          const value =
            chip.key === 'open'
              ? counts.open
              : chip.key === 'emergency'
              ? counts.emergency
              : chip.key === 'progress'
              ? counts.progress
              : counts.resolved;
          const tone = CHIP_TONES[chip.tone];
          return (
            <button
              key={chip.key}
              onClick={() => handleChipClick(chip)}
              className={`p-4 rounded-xl border cursor-pointer transition text-left bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 ${tone.bg}`}
              type="button"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 font-medium">{chip.label}</span>
                <Icon className={`w-4 h-4 ${tone.text}`} />
              </div>
              <div className={`text-2xl font-bold ${tone.text}`}>{value}</div>
            </button>
          );
        })}
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ticket #, description, shop number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <option value="All">All Statuses</option>
            <option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option><option>Reopened</option>
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <option value="All">All Priorities</option>
            <option>Emergency</option><option>High</option><option>Medium</option><option>Low</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <option value="All">All Categories</option>
            <option>Plumbing</option><option>Electrical</option><option>Air Conditioning</option>
            <option>Water Leak</option><option>Structural Damage</option><option>Security</option>
          </select>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="px-3 py-2 text-xs font-semibold text-slate-600" type="button">Clear</button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {loading && displayedTickets.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading tickets…
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500 text-xs">{error.message}</div>
        ) : displayedTickets.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No tickets match your filter criteria.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {displayedTickets.map((t) => (
              <button
                key={t.id}
                onClick={() => onViewTicket(t.id)}
                className="w-full text-left p-4 hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                type="button"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                      {t.ticket_number}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        t.priority === 'Emergency'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                          : t.priority === 'High'
                          ? 'bg-orange-100 text-orange-800'
                          : t.priority === 'Medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.priority}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {t.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{t.title}</h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{t.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">SLA</div>
                    <div
                      className={`text-[11px] font-bold ${
                        t.sla_status === 'Compliant'
                          ? 'text-emerald-600'
                          : t.sla_status === 'Warning'
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {t.sla_status}
                    </div>
                    {t.resolution_deadline &&
                      t.status !== 'Resolved' &&
                      t.status !== 'Closed' && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {(() => {
                            const hrs = Math.round(
                              (new Date(t.resolution_deadline).getTime() - Date.now()) / 3600000
                            );
                            return hrs >= 0 ? `${hrs}h left` : `${Math.abs(hrs)}h overdue`;
                          })()}
                        </div>
                      )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
