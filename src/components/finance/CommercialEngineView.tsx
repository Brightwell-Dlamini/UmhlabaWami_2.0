import React, { useMemo, useState } from 'react';
import { FileText, Download, Plus } from 'lucide-react';
import { auth } from '../../services/auth';
import { invoices as invoiceApi } from '../../services/api/invoices';
import { bankTransactions as bankApi } from '../../services/api/bankTransactions';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import { downloadCsv } from '../../services/api/_export';

export function CommercialEngineView() {
  const org = auth.getCurrentOrganization();
  const orgId = org?.id ?? '';

  const [message, setMessage] = useState<string | null>(null);

  const showMessage = (text: string, ms = 3000) => {
    setMessage(text);
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
      .filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled')
      .reduce((s, i) => s + (i.total - i.amount_paid), 0);
    const collected = invoices.reduce((s, i) => s + i.amount_paid, 0);
    const overdue = invoices.filter((i) => i.status === 'Overdue').length;
    return { outstanding, collected, overdue, count: invoices.length };
  }, [invoices]);

  const generate = useSupabaseMutation({
    mutationFn: () => {
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      return invoiceApi.bulkGenerateRent(next.toISOString().slice(0, 10));
    },
    invalidateKeys: ['invoices'],
  });

  const recordPayment = useSupabaseMutation({
    mutationFn: (invoiceId: string) => {
      const inv = invoices.find((i) => i.id === invoiceId);
      if (!inv) throw new Error('Invoice not found');
      const remaining = inv.total - inv.amount_paid;
      if (remaining <= 0) throw new Error('Invoice already settled.');
      return invoiceApi.recordPayment(invoiceId, {
        amount: remaining,
        method: 'EFT',
        reference: `PAY-${inv.invoice_number}`,
      });
    },
    invalidateKeys: ['invoices', 'finance_transactions'],
  });

  const reconcile = useSupabaseMutation({
    mutationFn: (id: string) => bankApi.reconcile(id),
    invalidateKeys: ['bank_transactions'],
  });

  const unreconcile = useSupabaseMutation({
    mutationFn: (id: string) => bankApi.unreconcile(id),
    invalidateKeys: ['bank_transactions'],
  });

  const handleGenerate = async () => {
    try {
      const n = await generate.mutate(undefined as never);
      showMessage(`Generated ${n} rent invoices.`);
    } catch (e) {
      showMessage(e instanceof Error ? `Failed: ${e.message}` : 'Failed to generate.', 5000);
    }
  };

  const handleRecordPayment = async (invoiceId: string) => {
    try {
      await recordPayment.mutate(invoiceId);
      showMessage('Payment recorded.');
    } catch (e) {
      showMessage(e instanceof Error ? `Failed: ${e.message}` : 'Failed to record payment.', 5000);
    }
  };

  const handleReconcileToggle = async (id: string, reconciled: boolean) => {
    try {
      if (reconciled) {
        await unreconcile.mutate(id);
        showMessage('Marked as unreconciled.', 2500);
      } else {
        await reconcile.mutate(id);
        showMessage('Reconciled.', 2500);
      }
    } catch (e) {
      showMessage(e instanceof Error ? `Failed: ${e.message}` : 'Failed to update.', 5000);
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
    showMessage('Exported CSV.', 2500);
  };

  if (!orgId) {
    return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Commercial engine
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Invoicing, collections, accounting export and reconciliation for{' '}
            {org?.company_name || 'your organisation'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerate}
            disabled={generate.loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            type="button"
          >
            <Plus className="w-4 h-4" /> Generate next month
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            type="button"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Invoices', value: totals.count },
          { label: 'Collected', value: `E${totals.collected.toLocaleString()}` },
          { label: 'Outstanding', value: `E${totals.outstanding.toLocaleString()}` },
          { label: 'Overdue', value: totals.overdue },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border bg-white dark:bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left text-slate-600 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400 text-xs">
                  No invoices yet.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-4 py-3">{inv.tenant_name}</td>
                  <td className="px-4 py-3">{inv.shop_number || '—'}</td>
                  <td className="px-4 py-3">{inv.due_date}</td>
                  <td className="px-4 py-3">{inv.status}</td>
                  <td className="px-4 py-3 tabular-nums">
                    E{inv.total.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    E{inv.amount_paid.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                      <button
                        onClick={() => handleRecordPayment(inv.id)}
                        disabled={recordPayment.loading}
                        className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-60"
                        type="button"
                      >
                        Record payment
                      </button>
                    )}
                  </td>
                </
