import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Receipt,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { invoices as invoiceApi } from '../../services/api/invoices';
import { financeTransactions as txApi } from '../../services/api/financeTransactions';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import {
  calculateAgingBuckets,
  calculateInvoiceTotals,
  calculateTransactionTotals,
  daysBetween,
  selectOverdueInvoices,
  selectRecentTransactions,
  todayIsoLocal,
} from './calculators';

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
    const invoiceTotals = calculateInvoiceTotals(invoices);
    const txTotals = calculateTransactionTotals(transactions);
    const buckets = calculateAgingBuckets(invoices);
    return { ...invoiceTotals, ...txTotals, buckets };
  }, [invoices, transactions]);

  const recentTransactions = useMemo(
    () => selectRecentTransactions(transactions, 6),
    [transactions]
  );

  const topOverdue = useMemo(
    () => selectOverdueInvoices(invoices).slice(0, 5),
    [invoices]
  );

  if (!orgId) {
    return (
      <div className="p-6 text-slate-500 text-sm">No organisation context.</div>
    );
  }

  const hasData = stats.invoiceCount > 0 || transactions.length > 0;
  const today = todayIsoLocal();

  return (
    <div className="space-y-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label="Total invoiced"
          value={formatE(stats.totalInvoiced)}
          icon={FileText}
          tone="blue"
          sub={`${stats.invoiceCount} invoice${stats.invoiceCount === 1 ? '' : 's'}`}
        />
        <Kpi
          label="Collected"
          value={formatE(stats.totalCollected)}
          icon={TrendingUp}
          tone="emerald"
          sub={
            stats.invoiceCount > 0
              ? `${stats.collectionRate}% collection rate`
              : 'No invoices yet'
          }
        />
        <Kpi
          label="Outstanding"
          value={formatE(stats.totalOutstanding)}
          icon={Clock}
          tone="amber"
          sub={`${stats.unpaidCount} unpaid invoice${
            stats.unpaidCount === 1 ? '' : 's'
          }`}
        />
        <Kpi
          label="Net cash flow"
          value={formatE(stats.netIncome)}
          icon={stats.netIncome >= 0 ? TrendingUp : TrendingDown}
          tone={stats.netIncome >= 0 ? 'emerald' : 'red'}
          sub={`Income ${formatE(stats.totalIncome)} − Expenses ${formatE(
            stats.totalExpenses
          )}`}
        />
      </div>

      {/* Aging buckets */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Accounts receivable aging
          </h3>
          {stats.totalOutstanding > 0 && (
            <span className="text-[11px] text-slate-500">
              Total outstanding {formatE(stats.totalOutstanding)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <AgingBucket
            label="Current"
            value={stats.buckets.current}
            total={stats.totalOutstanding}
            tone="emerald"
          />
          <AgingBucket
            label="1–30 days"
            value={stats.buckets.d30}
            total={stats.totalOutstanding}
            tone="amber"
          />
          <AgingBucket
            label="31–60 days"
            value={stats.buckets.d60}
            total={stats.totalOutstanding}
            tone="orange"
          />
          <AgingBucket
            label="61–90 days"
            value={stats.buckets.d90}
            total={stats.totalOutstanding}
            tone="red"
          />
          <AgingBucket
            label="90+ days"
            value={stats.buckets.older}
            total={stats.totalOutstanding}
            tone="red"
          />
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
            <EmptyState
              icon={<Receipt className="w-4 h-4" />}
              text={hasData ? 'No transactions yet.' : 'No data yet.'}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {recentTransactions.map((t) => (
                <div
                  key={t.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
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
                    {t.direction === 'income' ? '+' : '−'} {formatE(t.amount)}
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
            <EmptyState
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              text="All invoices are up to date."
              tone="emerald"
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {topOverdue.map((inv) => {
                const days = daysBetween(inv.due_date, today);
                return (
                  <div
                    key={inv.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {inv.invoice_number}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {inv.tenant_name} · {days} day{days === 1 ? '' : 's'} overdue
                      </div>
                    </div>
                    <div className="font-bold text-red-600 dark:text-red-400 shrink-0">
                      {formatE(inv.total - inv.amount_paid)}
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

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function formatE(n: number): string {
  return `E ${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

type Tone = 'blue' | 'emerald' | 'amber' | 'red' | 'orange';

function EmptyState({
  icon,
  text,
  tone,
}: {
  icon: React.ReactNode;
  text: string;
  tone?: 'emerald';
}) {
  return (
    <div
      className={`py-4 text-center text-xs flex items-center justify-center gap-2 ${
        tone === 'emerald' ? 'text-emerald-600' : 'text-slate-400'
      }`}
    >
      {icon}
      {text}
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
  tone: Tone;
  sub?: string;
}) {
  const tones: Record<Tone, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
    emerald:
      'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300',
  };
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={`p-1.5 rounded-lg ${tones[tone]}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function AgingBucket({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: Tone;
}) {
  const tones: Record<Tone, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    orange: 'text-orange-600 dark:text-orange-400',
  };
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`text-base font-bold mt-1 ${tones[tone]}`}>
        {formatE(value)}
      </div>
      {total > 0 && (
        <div className="text-[10px] text-slate-400 mt-0.5">{pct}% of total</div>
      )}
    </div>
  );
}
