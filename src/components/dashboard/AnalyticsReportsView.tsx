// src/components/dashboard/AnalyticsReportsView.tsx
import React, { useMemo, useState } from 'react';
import { BarChart3, Download, CheckCircle2 } from 'lucide-react';
import { auth } from '../../services/auth';
import { tickets as ticketsApi } from '../../services/api/tickets';
import { invoices as invoiceApi } from '../../services/api/invoices';
import { shops as shopsApi } from '../../services/api/shops';
import { vendors as vendorsApi } from '../../services/api/vendors';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { downloadCsv } from '../../services/api/_export';

export const AnalyticsReportsView: React.FC = () => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [notice, setNotice] = useState('');

  const { data: tickets = [] } = useSupabaseQuery(
    ['tickets', 'lite', orgId],
    () => ticketsApi.listLite(),
    { enabled: !!orgId }
  );
  const { data: invoices = [] } = useSupabaseQuery(
    ['invoices', orgId],
    () => invoiceApi.list(),
    { enabled: !!orgId }
  );
  const { data: shops = [] } = useSupabaseQuery(
    ['shops', orgId],
    () => shopsApi.list(),
    { enabled: !!orgId }
  );
  const { data: vendors = [] } = useSupabaseQuery(
    ['vendors', orgId],
    () => vendorsApi.list(),
    { enabled: !!orgId }
  );

  const kpis = useMemo(() => {
    const closed = tickets.filter(
      (t) => t.status === 'Closed' || t.status === 'Resolved'
    );
    const emergencyClosed = closed.filter(
      (t) => t.priority === 'Emergency'
    );
    const slaCompliant = closed.filter(
      (t) => t.sla_status === 'Compliant'
    );
    return {
      emergencyRate: closed.length
        ? Math.round((emergencyClosed.length / closed.length) * 100)
        : 0,
      slaRate: closed.length
        ? Math.round((slaCompliant.length / closed.length) * 100)
        : 0,
      occupancy: shops.length
        ? Math.round(
            (shops.filter((s) => s.status === 'Occupied').length /
              shops.length) *
              100
          )
        : 0,
      collectionRate: invoices.length
        ? Math.round(
            (invoices.reduce((s, i) => s + i.amount_paid, 0) /
              invoices.reduce((s, i) => s + i.total, 0)) *
              100
          )
        : 0,
    };
  }, [tickets, invoices, shops]);

  const exportReport = () => {
    downloadCsv(
      `umhlaba-wami-sla-report-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Metric', 'Value'],
        ['Emergency SLA rate', `${kpis.emergencyRate}%`],
        ['SLA compliance rate', `${kpis.slaRate}%`],
        ['Portfolio occupancy', `${kpis.occupancy}%`],
        ['Collection rate', `${kpis.collectionRate}%`],
        ['Open tickets', tickets.filter((t) => t.status !== 'Closed').length],
        ['Active vendors', vendors.filter((v) => v.status === 'Active').length],
      ]
    );
    setNotice('Report downloaded.');
    setTimeout(() => setNotice(''), 3000);
  };

  if (!orgId) {
    return (
      <div className="p-6 text-slate-500 text-sm">
        No organisation context.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" /> Analytics &amp;
            reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live SLA performance, occupancy and collections
          </p>
        </div>
        <button
          onClick={exportReport}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Emergency SLA rate', value: `${kpis.emergencyRate}%` },
          { label: 'SLA compliance', value: `${kpis.slaRate}%` },
          { label: 'Occupancy', value: `${kpis.occupancy}%` },
          { label: 'Collection rate', value: `${kpis.collectionRate}%` },
        ].map((k) => (
          <div
            key={k.label}
            className="p-5 rounded-2xl bg-white dark:bg-slate-800 border"
          >
            <div className="text-xs text-slate-500">{k.label}</div>
            <div className="text-2xl font-bold mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border space-y-3">
          <h2 className="text-sm font-bold">Ticket category breakdown</h2>
          {Object.entries(
            tickets.reduce<Record<string, number>>((acc, t) => {
              acc[t.category] = (acc[t.category] ?? 0) + 1;
              return acc;
            }, {})
          )
            .slice(0, 5)
            .map(([cat, count]) => {
              const pct = tickets.length
                ? Math.round((count / tickets.length) * 100)
                : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>{cat}</span>
                    <span>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border space-y-3">
          <h2 className="text-sm font-bold">Vendor performance</h2>
          {vendors.slice(0, 5).map((v) => (
            <div
              key={v.id}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-bold">{v.company_name}</div>
                <div className="text-[11px] text-slate-500">
                  {v.service_category}
                </div>
              </div>
              <div className="text-emerald-600 font-bold">
                ★ {v.performance_rating}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
