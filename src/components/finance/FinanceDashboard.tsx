import React, { useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Clock, AlertTriangle,
  FileText, CheckCircle2, Receipt,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { invoices as invoiceApi } from '../../services/api/invoices';
import { financeTransactions as txApi } from '../../services/api/financeTransactions';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';

export function FinanceDashboard() {
  const orgId = auth.getCurrentOrganization()?.id ?? '';

  const { data: invoices = [] } = useSupabaseQuery(
    ['invoices', orgId],
    () => invoiceApi.list(),
    { enabled: !!orgId }
  );
  const { data: transactions = [] } = useSupabaseQuery(
    ['finance_transactions', orgId],
    () => txApi.list(),
    { enabled: !!orgId }
  );

  const stats = useMemo(() => {
    const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
    const totalCollected = invoices.reduce((s, i) => s + i.amount_paid, 0);
    const totalOutstanding = totalInvoiced - totalCollected;
    const totalExpenses = transactions
      .filter((t) => t.direction === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const totalIncome = transactions
      .filter((t) => t.direction === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const netIncome = totalIncome - totalExpenses;

    const now = Date.now();
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
    for (const inv of invoices) {
      if (inv.status === 'Paid' || inv.status === 'Cancelled') continue;
      const overdue = Math.floor(
        (now - new Date(inv.due_date).getTime()) / 86400000
      );
      const outstanding = inv.total - inv.amount_paid;
      if (overdue <= 0) buckets.current += outstanding;
      else if (overdue <= 30) buckets.d30 += outstanding;
      else if (overdue <= 60) buckets.d60 += outstanding;
      else if (overdue <= 90) buckets.d90 += outstanding;
      else buckets.older += outstanding;
    }

    return {
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      totalExpenses,
      totalIncome,
      netIncome,
      buckets,
      invoiceCount: invoices.length,
      unpaidCount: invoices.filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled').length,
    };
  }, [invoices, transactions]);

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6),
    [transactions]
  );

  const topOverdue = useMemo(
    () =>
      invoices
        .filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled')
        .filter((i) => new Date(i.due_date) < new Date())
        .sort(
          (a, b) =>
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        )
        .slice(0, 5),
    [invoices]
  );

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label="Total invoiced"
          value={`E ${stats.totalInvoiced.toLocaleString()}`}
          icon={FileText}
          tone="blue"
          sub={`${stats.invoiceCount} invoices`}
        />
        <Kpi
          label="Collected"
          value={`E ${stats.totalCollected.toLocaleString()}`}
          icon={TrendingUp}
          tone="emerald"
          sub={
            stats.totalInvoiced > 0
              ? `${Math.round((stats.totalCollected / stats.totalInvoiced) * 100)}% collection rate`
              : 'No invoices yet'
          }
        />
        <Kpi
          label="Outstanding"
          value={`E ${stats.totalOutstanding.toLocaleString()}`}
          icon={Clock}
          tone="amber"
          sub={`${stats.unpaidCount} unpaid invoices`}
        />
        <Kpi
          label="Net cash flow"
          value={`E ${stats.netIncome.toLocaleString()}`}
          icon={stats.netIncome >= 0 ? TrendingUp : TrendingDown}
          tone={stats.netIncome >= 0 ? 'emerald' : 'red'}
          sub={`Income E${stats.totalIncome.toLocaleString()} − Expenses E${stats.totalExpenses.toLocaleString()}`}
        />
      </div>

      {/* Aging buckets */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Accounts receivable aging
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <AgingBucket label="Current" value={stats.buckets.current} tone="emerald" />
          <AgingBucket label="1–30 days" value={stats.buckets.d30} tone="amber" />
          <AgingBucket label="31–60 days" value={stats.buckets.d60} tone="orange" />
          <AgingBucket label="61–90 days" value={stats.buckets.d90} tone="red" />
          <AgingBucket label="90+ days" value={stats.buckets.older} tone="red" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent transactions */}
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            Recent transactions
          </h3>
          {recentTransactions.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">
              No transactions yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {recentTransactions.map((t) => (
                <div key={t.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {t.description}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {t.date} · {t.type}
                    </div>
                  </div>
                  <div
                    className={`font-bold shrink-0 ${
                      t.direction === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {t.direction === 'income' ? '+' : '−'} E{t.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top overdue */}
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Top overdue invoices
          </h3>
          {topOverdue.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              All invoices are up to date.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {topOverdue.map((inv) => {
                const days = Math.floor(
                  (Date.now() - new Date(inv.due_date).getTime()) / 86400000
                );
                return (
                  <div key={inv.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {inv.invoice_number}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {inv.tenant_name} · {days} days overdue
                      </div>
                    </div>
                    <div className="font-bold text-red-600 dark:text-red-400 shrink-0">
                      E{(inv.total - inv.amount_paid).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'blue' | 'emerald' | 'amber' | 'red';
  sub?: string;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
  };
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={`p-1.5 rounded-lg ${tones[tone]}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className="text-xl font-bold text-slate-900 dark:text-white">
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function AgingBucket({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'amber' | 'orange' | 'red';
}) {
  const tones = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    orange: 'text-orange-600 dark:text-orange-400',
    red: 'text-red-600 dark:text-red-400',
  };
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`text-base font-bold mt-1 ${tones[tone]}`}>
        E{value.toLocaleString()}
      </div>
    </div>
  );
}
