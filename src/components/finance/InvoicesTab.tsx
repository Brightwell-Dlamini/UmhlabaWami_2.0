import React, { useMemo, useState } from 'react';
import {
  FileText, PlusCircle, CheckCircle2, X, Trash2, Printer, Download,
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

export function InvoicesTab() {
  const org = auth.getCurrentOrganization();
  const orgId = org?.id ?? '';

  const [feedback, setFeedback] = useState('');
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

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
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['invoices'],
    enabled: !!orgId,
  });

  const recordPayment = useSupabaseMutation({
    mutationFn: ({ invoice }: { invoice: Invoice }) => {
      const remaining = invoice.total - invoice.amount_paid;
      return invoiceApi.recordPayment(invoice.id, {
        amount: remaining,
        method: 'EFT',
        reference: `PAY-${invoice.invoice_number}`,
      });
    },
    invalidateKeys: ['invoices', 'finance_transactions'],
    onSuccess: () => {
      setFeedback('Payment recorded.');
      setTimeout(() => setFeedback(''), 3000);
    },
  });

  const bulkGenerate = useSupabaseMutation({
    mutationFn: () => {
      const period = new Date();
      period.setDate(1);
      return invoiceApi.bulkGenerateRent(period.toISOString().slice(0, 10));
    },
    invalidateKeys: ['invoices', 'finance_transactions'],
    onSuccess: (n) => {
      setFeedback(`Generated ${n} rent invoices.`);
      setTimeout(() => setFeedback(''), 3500);
    },
  });

  const deleteInvoice = useSupabaseMutation({
    mutationFn: (id: string) => invoiceApi.remove(id),
    invalidateKeys: ['invoices'],
    onSuccess: () => {
      setFeedback('Invoice removed.');
      setTimeout(() => setFeedback(''), 3000);
    },
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
    const tenant = tenants.find((t) => t.id === inv.tenant_id);
    if (currentOrg) generateInvoicePdf(inv, currentOrg, tenant);
  };

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

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
          onClick={() => bulkGenerate.mutate(undefined as never)}
          disabled={bulkGenerate.loading}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" /> Generate rent invoices
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {feedback}
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
          <option value="All">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Partially Paid">Partially Paid</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
          <option value="Cancelled">Cancelled</option>
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
              ) : filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-mono text-[11px] font-bold">
                    {inv.invoice_number}
                  </td>
                  <td className="px-4 py-3">{inv.tenant_name}</td>
                  <td className="px-4 py-3">{inv.shop_number ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{inv.issue_date}</td>
                  <td className="px-4 py-3 text-slate-500">{inv.due_date}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        inv.status === 'Paid'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : inv.status === 'Overdue'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                          : inv.status === 'Partially Paid'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    E{inv.total.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    E{inv.amount_paid.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handlePdf(inv)}
                        className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:underline"
                        title="Download PDF"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => setViewingInvoice(inv)}
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        View
                      </button>
                      {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                        <button
                          onClick={() => recordPayment.mutate({ invoice: inv })}
                          disabled={recordPayment.loading}
                          className="text-[11px] font-semibold text-emerald-600 hover:underline disabled:opacity-60"
                        >
                          Record payment
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete invoice ${inv.invoice_number}?`)) {
                            deleteInvoice.mutate(inv.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-500"
                        title="Delete invoice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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

// ----- Invoice viewer modal -----
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
            <h3 className="font-bold text-sm">Invoice {invoice.invoice_number}</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePdf}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
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
              <div className="text-slate-500">Unit {shop?.shop_number ?? '—'}</div>
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
                  <td className="p-2.5 text-right">E{invoice.subtotal.toLocaleString()}</td>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/40">
                  <td className="p-2.5 text-right text-slate-500">Tax</td>
                  <td className="p-2.5 text-right">E{invoice.tax_amount.toLocaleString()}</td>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/40 font-bold">
                  <td className="p-2.5 text-right">Total</td>
                  <td className="p-2.5 text-right text-blue-600">
                    E{invoice.total.toLocaleString()}
                  </td>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/40">
                  <td className="p-2.5 text-right text-slate-500">Paid</td>
                  <td className="p-2.5 text-right">E{invoice.amount_paid.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-3 rounded-xl border text-[11px] space-y-1">
            <div className="font-bold">Banking details</div>
            <div>Bank: First National Bank Eswatini</div>
            <div>Account #: 62890123456 • Branch: 280164</div>
            <div className="text-slate-400">Ref: {invoice.invoice_number}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
