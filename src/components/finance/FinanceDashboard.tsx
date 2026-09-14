import React, { useMemo } from 'react';
import { Banknote, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { auth } from '../../services/auth';
import { invoices as invoiceApi } from '../../services/api/invoices';
import { bankTransactions as bankApi } from '../../services/api/bankTransactions';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useRealtime } from '../../hooks/useRealtime';

export function FinanceDashboard() {
  const org = auth.getCurrentOrganization();
  const orgId = org?.id ?? '';

  const { data: invoices = [], loading: invLoading } = useSupabaseQuery(
    ['invoices', orgId],
    () => invoiceApi.list(),
    { enabled: !!orgId }
  );
  const { data: bankLines = [] } = useSupabaseQuery(
    ['bank_transactions', orgId],
    () => bankApi.list(),
    { enabled: !!orgId }
  );

  useRealtime({
    table: 'invoices',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['invoices'],
    enabled: !!orgId,
  });

  const totals = useMemo(() => {
    const outstanding = invoices
      .filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled')
      .reduce((s, i) => s + (i.total - i.amount_paid), 0);
    const collected = invoices.reduce((s, i) => s + i.amount_paid, 0);
    const overdue = invoices.filter(
      (i) =>
        i.status === 'Overdue' ||
        (i.status !== 'Paid' &&
          i.status !== 'Cancelled' &&
          new Date(i.due_date) < new Date())
    ).length;
    const unreconciled = bankLines.filter((l) => !l.reconciled).length;
    return {
      outstanding,
      collected,
      overdue,
      count: invoices.length,
      unreconciled,
    };
  }, [invoices, bankLines]);

  if (!orgId) {
    return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;
  }

  const cards = [
    {
      label: 'Invoices',
      value: totals.count,
      icon: FileText,
      tone: 'text-blue-600',
    },
    {
      label: 'Collected',
      value: `E${totals.collected.toLocaleString()}`,
      icon: CheckCircle2,
      tone: 'text-emerald-600',
    },
    {
      label: 'Outstanding',
      value: `E${totals.outstanding.toLocaleString()}`,
      icon: Banknote,
      tone: 'text-amber-600',
    },
    {
      label: 'Overdue',
      value: totals.overdue,
      icon: AlertTriangle,
      tone: 'text-rose-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Finance overview
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Collections snapshot for {org?.company_name || 'your organisation'}.
          {invLoading ? ' Loading…' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-500">{c.label}</p>
              <c.icon className={`w-4 h-4 ${c.tone}`} />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-300">
        <p>
          Unreconciled bank lines:{' '}
          <span className="font-semibold tabular-nums">{totals.unreconciled}</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Use the Invoices tab to generate rent, record payments, and export CSV. Quotes &amp;
          Orders and Items &amp; Reminders are available in the other tabs.
        </p>
      </div>
    </div>
  );
}
