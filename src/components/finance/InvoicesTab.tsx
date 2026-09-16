import React, { useMemo, useState } from 'react';
import {
  FileText,
  PlusCircle,
  CheckCircle2,
  X,
  Trash2,
  Download,
  Search,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { invoices as invoiceApi } from '../../services/api/invoices';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { shops as shopsApi } from '../../services/api/shops';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import { generateInvoicePdf } from '../../services/pdf';
import type { Invoice } from '../../types';

const STATUS_FILTERS = [
  'All',
  'Draft',
  'Sent',
  'Partially Paid',
  'Paid',
  'Overdue',
  'Cancelled',
] as const;

export function InvoicesTab() {
  const org = auth.getCurrentOrganization();
  const orgId = org?.id ?? '';

  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'ok' | 'error'>('ok');
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const showFeedback = (text: string, tone: 'ok' | 'error' = 'ok', ms = 3500) => {
    setFeedback(text);
    setFeedbackTone(tone);
    setTimeout(() => setFeedback(null), ms);
  };

  const { data: invoices = [] } = useSupabaseQuery(
    ['invoices', orgId],
    () => invoiceApi.list(),
    { enabled: !!orgId }
  );
  const { data: tenants = [] } = useSupabaseQuery(
    ['tenants', orgId],
    () => tenantsApi.list(),
    { enabled: !!orgId }
  );
  const { data: shops = [] } = useSupabaseQuery(
    ['shops', orgId],
    () => shopsApi.list(),
    { enabled: !!orgId }
  );

  useRealtime({
    table: 'invoices',
    filter: orgId ? `organization_id=eq.${orgId}` : undefined,
    invalidateKeys: ['invoices'],
    enabled: !!orgId,
  });

  const recordPayment = useSupabaseMutation({
    mutationFn: ({ invoice }: { invoice: Invoice }) => {
      const remaining = invoice.total - invoice.amount_paid;
      if (remaining <= 0) throw new Error('Invoice is already settled.');
      return invoiceApi.recordPayment(invoice.id, {
        amount: remaining,
        method: 'EFT',
        reference: `PAY-${invoice.invoice_number}`,
      });
    },
    invalidateKeys: ['invoices', 'finance_transactions'],
  });

  const bulkGenerate = useSupabaseMutation({
    mutationFn: () => {
      const period = new Date();
      period.setDate(1);
      return invoiceApi.bulkGenerateRent(period.toISOString().slice(0, 10));
    },
    invalidateKeys: ['invoices', 'finance_transactions'],
  });

  const deleteInvoice = useSupabaseMutation({
    mutationFn: (id: string) => invoiceApi.remove(id),
    invalidateKeys: ['invoices'],
  });

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'All' && inv.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          inv.invoice_number.toLowerCase().includes(q) ||
          inv.tenant_name.toLowerCase().includes(q) ||
          (inv.shop_number ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [invoices, statusFilter, search]);

  const handlePdf = (inv: Invoice) => {
    const currentOrg = auth.getCurrentOrganization();
    if (!currentOrg) return;
    const tenant = tenants.find((t) => t.id === inv.tenant_id);
    generateInvoicePdf(inv, currentOrg, tenant);
  };

  const handleBulkGenerate = async () => {
    try {
      const n = await bulkGenerate.mutate(undefined as never);
      const period = new Date();
      const label = period.toLocaleString(undefined, {
        month: 'long',
        year: 'numeric',
      });
      showFeedback(
        n > 0 ? `Generated ${n} rent invoice${n === 1 ? '' : 's'} for ${label}.` : `No invoices generated for ${label}.`
      );
    } catch (e) {
      showFeedback(e instanceof Error ? e.message : 'Failed to generate invoices.', 'error', 5000);
    }
  };

  const handleRecordPayment = async (invoice: Invoice) => {
    try {
      await recordPayment.mutate({ invoice });
      showFeedback(`Payment recorded for ${invoice.invoice_number}.`);
    } catch (e) {
      showFeedback(e instanceof Error ? e.message : 'Failed to record payment.', 'error', 5000);
    }
  };

  const handleDelete = async (inv: Invoice) => {
    if (!confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteInvoice.mutate(inv.id);
      showFeedback(`Invoice ${inv.invoice_number} deleted.`);
    } catch (e) {
      showFeedback(e instanceof Error ? e.message : 'Failed to delete invoice.', 'error', 5000);
    }
  };

  if (!orgId) {
    return (
      <div className="p-6 text-slate-500 text-sm">No organisation context.</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 border-b bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-sm">Invoices</h3>
          <p className="text-xs text-slate-500">
            Generate, send, and reconcile invoices for your tenants
          </p>
        </div>
        <button
          onClick={handleBulkGenerate}
          disabled={bulkGenerate.loading}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
          type="button"
        >
          <PlusCircle className="w-4 h-4" />
          {bulkGenerate.loading ? 'Generating…' : 'Generate rent invoices'}
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedbackTone === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border border-red-300 text-red-800 dark:text-red-200'
          }`}
        >
          {feedbackTone === 'ok' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <X className="w-4 h-4" />
          )}
          {feedback}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, tenant, unit…"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? 'All statuses' : s}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No invoices match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30"
                  >
                    <td className="px-4 py-3 font-mono text-[11px] font-bold">
                      {inv.invoice_number}
                    </td>
                    <td className="px-4 py-3">{inv.tenant_name}</td>
                    <td className="px-4 py-3">{inv.shop_number ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{inv.issue_date}</td>
                    <td className="px-4 py-3 text-slate-500">{inv.due_date}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusTone(
                          inv.status
                        )}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      E{inv.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      E{inv.amount_paid.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handlePdf(inv)}
                          className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:underline"
                          title="Download PDF"
                          type="button"
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => setViewingInvoice(inv)}
                          className="text-[11px] font-semibold text-blue-600 hover:underline"
                          type="button"
                        >
                          View
                        </button>
                        {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                          <button
                            onClick={() => handleRecordPayment(inv)}
                            disabled={recordPayment.loading}
                            className="text-[11px] font-semibold text-emerald-600 hover:underline disabled:opacity-60"
                            type="button"
                          >
                            Record payment
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(inv)}
                          disabled={deleteInvoice.loading}
                          className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-60"
                          title="Delete invoice"
                          type="button"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingInvoice && (
        <InvoiceViewer
          invoice={viewingInvoice}
          shops={shops}
          onClose={() => setViewingInvoice(null)}
        />
      )}
    </div>
  );
}

function statusTone(status: string): string {
  switch (status) {
    case 'Paid':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    case 'Overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
    case 'Partially Paid':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
  }
}

// ----- Invoice viewer modal -----

const BANKING_DETAILS = {
  bank: 'First National Bank Eswatini',
  account: '62890123456',
  branch: '280164',
} as const;

function InvoiceViewer({
  invoice,
  shops,
  onClose,
}: {
  invoice: Invoice;
  shops: { id: string; shop_number: string }[];
  onClose: () => void;
}) {
  const shop = shops.find((s) => s.id === invoice.shop_id);

  const handlePdf = () => {
    const org = auth.getCurrentOrganization();
    if (org) generateInvoicePdf(invoice, org);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm">
              Invoice {invoice.invoice_number}
            </h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePdf}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              title="Download PDF"
              type="button"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="flex justify-between">
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Billed to</div>
              <div className="font-bold">{invoice.tenant_name}</div>
              <div className="text-slate-500">
                Unit {shop?.shop_number ?? '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase">Issued</div>
              <div>{invoice.issue_date}</div>
              <div className="text-[10px] text-slate-400 uppercase mt-1">Due</div>
              <div>{invoice.due_date}</div>
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/80">
                <tr>
                  <th className="p-2.5 text-left">Description</th>
                  <th className="p-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoice.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="p-2.5">{l.description}</td>
                    <td className="p-2.5 text-right font-semibold">
                      E{l.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 dark:bg-slate-800/40">
                  <td className="p-2.5 text-right text-slate-500">Subtotal</td>
                  <td className="p-2.5 text-right">
                    E{invoice.subtotal.toLocaleString()}
                  </td>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/40">
                  <td className="p-2.5 text-right text-slate-500">Tax</td>
                  <td className="p-2.5 text-right">
                    E{invoice.tax_amount.toLocaleString()}
                  </td>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/40 font-bold">
                  <td className="p-2.5 text-right">Total</td>
                  <td className="p-2.5 text-right text-blue-600">
                    E{invoice.total.toLocaleString()}
                  </td>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/40">
                  <td className="p-2.5 text-right text-slate-500">Paid</td>
                  <td className="p-2.5 text-right">
                    E{invoice.amount_paid.toLocaleString()}
                  </td>
                </tr>
                {invoice.total - invoice.amount_paid > 0 && (
                  <tr className="bg-amber-50 dark:bg-amber-950/40 font-bold">
                    <td className="p-2.5 text-right text-amber-700 dark:text-amber-300">
                      Balance due
                    </td>
                    <td className="p-2.5 text-right text-amber-700 dark:text-amber-300">
                      E{(invoice.total - invoice.amount_paid).toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 rounded-xl border text-[11px] space-y-1">
            <div className="font-bold">Banking details</div>
            <div>Bank: {BANKING_DETAILS.bank}</div>
            <div>
              Account #: {BANKING_DETAILS.account} • Branch: {BANKING_DETAILS.branch}
            </div>
            <div className="text-slate-400">Ref: {invoice.invoice_number}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
