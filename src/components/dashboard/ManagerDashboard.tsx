import React, { useMemo, useState } from 'react';
import {
  Building2, PlusCircle, Radio, Star, Clock, Search,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { tickets as ticketsApi } from '../../services/api/tickets';
import { shops as shopsApi } from '../../services/api/shops';
import { shoppingCenters as centersApi } from '../../services/api/shoppingCenters';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useRealtime } from '../../hooks/useRealtime';

interface Props {
  onViewTicket: (id: string) => void;
  onOpenCreateTicket: () => void;
  onOpenBroadcastModal: () => void;
}

export const ManagerDashboard: React.FC<Props> = ({ onViewTicket, onOpenCreateTicket, onOpenBroadcastModal }) => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  const { data: tickets = [] } = useSupabaseQuery(['tickets', orgId], () => ticketsApi.list(), { enabled: !!orgId });
  const { data: shops = [] } = useSupabaseQuery(['shops', orgId], () => shopsApi.list(), { enabled: !!orgId });
  const { data: centers = [] } = useSupabaseQuery(['centers', orgId], () => centersApi.list(), { enabled: !!orgId });

  useRealtime({ table: 'tickets', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['tickets'], enabled: !!orgId });

  const kpis = useMemo(() => {
    const total = shops.length;
    const occupied = shops.filter((s) => s.status === 'Occupied').length;
    return {
      occupancy: total ? Math.round((occupied / total) * 100) : 0,
      open: tickets.filter((t) => t.status === 'Open').length,
      emergency: tickets.filter((t) => t.priority === 'Emergency' && t.status !== 'Closed').length,
      inProgress: tickets.filter((t) => t.status === 'In Progress').length,
      awaiting: tickets.filter((t) => t.status === 'Resolved').length,
    };
  }, [tickets, shops]);

  const filtered = tickets.filter((t) => {
    if (statusFilter !== 'All' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.ticket_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 inline-block">
            Property operations
          </div>
          <h1 className="text-2xl font-bold mt-1">Operations dashboard</h1>
          <p className="text-xs text-slate-500">Maintenance, SLAs and occupancy</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenBroadcastModal}
            className="px-3.5 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-center gap-1.5">
            <Radio className="w-4 h-4 animate-pulse" /> Emergency broadcast
          </button>
          <button onClick={onOpenCreateTicket}
            className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4" /> New ticket
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Occupancy', value: `${kpis.occupancy}%`, tone: 'text-slate-900 dark:text-white' },
          { label: 'Open', value: kpis.open, tone: 'text-blue-600' },
          { label: 'Emergencies', value: kpis.emergency, tone: 'text-red-600' },
          { label: 'In progress', value: kpis.inProgress, tone: 'text-amber-500' },
          { label: 'Awaiting confirm', value: kpis.awaiting, tone: 'text-emerald-600' },
          { label: 'Tenant CSAT', value: '4.9 ★', tone: 'text-slate-900 dark:text-white' },
        ].map((k) => (
          <div key={k.label} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border">
            <div className="text-xs text-slate-500 mb-1">{k.label}</div>
            <div className={`text-2xl font-bold ${k.tone}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider">Managed centres</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {centers.map((c) => {
            const cShops = shops.filter((s) => s.shopping_center_id === c.id);
            const occupied = cShops.filter((s) => s.status === 'Occupied').length;
            const openTickets = tickets.filter((t) => t.shopping_center_id === c.id && t.status !== 'Closed').length;
            const occ = cShops.length ? Math.round((occupied / cShops.length) * 100) : 0;
            return (
              <div key={c.id} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border space-y-3">
                <div className="flex items-center gap-3">
                  {c.image && <img src={c.image} alt="" className="w-12 h-12 rounded-xl object-cover" />}
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate">{c.name}</h3>
                    <p className="text-xs text-slate-500 truncate">{c.location}</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Occupancy</span><strong>{occ}%</strong>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full bg-blue-600" style={{ width: `${occ}%` }} />
                  </div>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Open tickets: <strong>{openTickets}</strong></span>
                  <span>Units: <strong>{cShops.length}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-bold">Control tower</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-xl border text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…" className="bg-transparent focus:outline-none text-xs w-32" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900">
              <option value="All">All statuses</option>
              <option>Open</option><option>In Progress</option>
              <option>Resolved</option><option>Closed</option><option>Reopened</option>
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900">
              <option value="All">All priorities</option>
              <option>Emergency</option><option>High</option><option>Medium</option><option>Low</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Ticket</th>
                <th className="px-3 py-2.5">Issue</th>
                <th className="px-3 py-2.5">Priority</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Deadline</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((t) => (
                <tr key={t.id} onClick={() => onViewTicket(t.id)}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40">
                  <td className="px-3 py-3 font-mono font-bold">{t.ticket_number}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold">{t.title}</div>
                    <div className="text-[10px] text-slate-400">{t.category}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      t.priority === 'Emergency' ? 'bg-red-600 text-white'
                      : t.priority === 'High' ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700'
                    }`}>{t.priority}</span>
                  </td>
                  <td className="px-3 py-3">{t.status}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      {new Date(t.resolution_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-blue-600 font-semibold">Manage →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
