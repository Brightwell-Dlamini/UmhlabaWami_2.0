// src/components/finance/CommercialEngineView.tsx
import React, { useMemo, useState } from 'react';
import {
  FileText,
  Download,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { invoices as invoiceApi } from '../../services/api/invoices';
import { bankTransactions as bankApi } from '../../services/api/bankTransactions';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import { downloadCsv } from '../../services/api/_export';
import { isSettledStatus } from '../../constants/invoiceStatus';

export function CommercialEngineView() {
  const org = auth.getCurrentOrganization();
  const orgId = org?.id ?? '';

  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(
    null
  );

  const showMessage = (text: string, tone: 'ok' | 'error' = 'ok', ms = 3500) => {
    setMessage({ text, tone });
    setTimeout(() => setMessage(null), ms);
  };

  const { data: invoices = [] } = useSupabaseQuery(
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
  useRealtime({
    table: 'bank_transactions',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['bank_transactions'],
    enabled: !!orgId,
  });

  const totals = useMemo(() => {
    const outstanding = invoices
      .filter((i) => !isSettledStatus(i.status))
      .reduce((s, i) => s + (i.total - i.amount_paid), 0);
    const collected = invoices.reduce((s, i) => s + i.amount_paid, 0);
    const overdue = invoices.filter((i) => i.status === 'Overdue').length;
    const unreconciled = bankLines.filter((l) => !l.reconciled).length;
    return { outstanding, collected, overdue, count: invoices.length, unreconciled };
  }, [invoices, bankLines]);

  const generate = useSupabaseMutation({
    mutationFn: () => {
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      return invoiceApi.bulkGenerateRent(next.toISOString().slice(0, 10));
    },
    invalidateKeys: ['invoices'],
  });

  const reconcile = useSupabaseMutation({
    mutationFn: (id: string) => bankApi.reconcile(id),
    invalidateKeys: ['bank_transactions', 'finance_transactions'],
  });

  const unreconcile = useSupabaseMutation({
    mutationFn: (id: string) => bankApi.unreconcile(id),
    invalidateKeys: ['bank_transactions', 'finance_transactions'],
  });

  const handleGenerate = async () => {
    try {
      const n = await generate.mutate();
      if (n === 0) {
        showMessage('No invoices to generate for the next period.');
      } else {
        showMessage(
          `Generated ${n} rent invoice${n === 1 ? '' : 's'} for the next period.`
        );
      }
    } catch (e) {
      showMessage(
        e instanceof Error ? `Failed: ${e.message}` : 'Failed to generate.',
        'error',
        5000
      );
    }
  };

  const handleReconcileToggle = async (id: string, reconciled: boolean) => {
    try {
      if (reconciled) {
        await unreconcile.mutate(id);
        showMessage('Marked as unreconciled.', 'ok', 2500);
      } else {
        await reconcile.mutate(id);
        showMessage('Reconciled.', 'ok', 2500);
      }
    } catch (e) {
      showMessage(
        e instanceof Error ? `Failed: ${e.message}` : 'Failed to update.',
        'error',
        5000
      );
    }
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [
        'InvoiceNumber',
        'Tenant',
        'Unit',
        'IssueDate',
        'DueDate',
        'Status',
        'Subtotal',
        'Tax',
        'Total',
        'AmountPaid',
      ],
      ...invoices.map((i) => [
        i.invoice_number,
        i.tenant_name,
        i.shop_number ?? '',
        i.issue_date,
        i.due_date,
        i.status,
        i.subtotal,
        i.tax_amount,
        i.total,
        i.amount_paid,
      ]),
    ];
    downloadCsv(`umhlaba-wami-invoices-${orgId}.csv`, rows);
    showMessage('Exported invoices.', 'ok', 2500);
  };

  if (!orgId) {
    return (
      <div className="p-6 text-slate-500 text-sm">
        No organisation context.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-900 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold px-2 py-0.5 rounded bg-white/20 text-indigo-100 inline-block">
            Commercial engine
          </div>
          <h2 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Billing &amp; reconciliation
          </h2>
          <p className="text-xs text-indigo-100 mt-1">
            Bulk generation and bank-line matching for{' '}
            {org?.company_name || 'your organisation'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerate}
            disabled={generate.loading}
            className="inline-flex items-center gap-2 rounded-lg bg-white text-indigo-800 px-4 py-2.5 text-sm font-bold hover:bg-indigo-50 disabled:opacity-60"
            type="button"
          >
            <Plus className="w-4 h-4" />
            {generate.loading ? 'Generating…' : 'Generate next month'}
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 hover:bg-white/20 px-4 py-2.5 text-sm font-semibold"
            type="button"
          >
            <Download className="w-4 h-4" /> Export invoices
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-semibold flex items-center gap-2 ${
            message.tone === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-300 text-red-800 dark:text-red-200'
          }`}
        >
          {message.tone === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Invoices" value={totals.count.toLocaleString()} />
        <Kpi
          label="Collected"
          value={`E${totals.collected.toLocaleString()}`}
          tone="emerald"
        />
        <Kpi
          label="Outstanding"
          value={`E${totals.outstanding.toLocaleString()}`}
          tone="amber"
        />
        <Kpi
          label="Unreconciled bank lines"
          value={totals.unreconciled.toLocaleString()}
          tone={totals.unreconciled > 0 ? 'amber' : 'slate'}
        />
      </div>

      {/* Reconciliation */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-blue-600" /> Bank
              reconciliation
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Match incoming bank lines against payment records. Reconciled
              lines stop appearing in the work queue.
            </p>
          </div>
          {totals.unreconciled > 0 && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
              {totals.unreconciled} pending
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Direction</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Reconciled</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bankLines.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-slate-400 text-xs"
                  >
                    No bank lines yet. Import a bank feed to start matching.
                  </td>
                </tr>
              ) : (
                bankLines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 text-slate-500">{l.date}</td>
                    <td className="px-4 py-3">{l.description}</td>
                    <td className="px-4 py-3 capitalize">{l.direction}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      E{l.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          handleReconcileToggle(l.id, l.reconciled)
                        }
                        disabled={reconcile.loading || unreconcile.loading}
                        className={`text-xs font-bold px-3 py-1 rounded-lg disabled:opacity-60 ${
                          l.reconciled
                            ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                        }`}
                        type="button"
                      >
                        {l.reconciled ? 'Undo reconcile' : 'Mark reconciled'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pointer to Invoices tab */}
      <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-xs text-slate-500">
        Looking for individual invoices, payments, or the aged debt list?{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          Use the Invoices tab.
        </span>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  tone?: 'slate' | 'emerald' | 'amber';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-600'
      : tone === 'amber'
      ? 'text-amber-600'
      : 'text-slate-900 dark:text-white';
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
