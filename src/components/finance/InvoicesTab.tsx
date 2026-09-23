// src/components/finance/InvoicesTab.tsx
// Streamlined restore — core invoice list, payments, PDF, reminders.
import React, { useMemo, useState } from 'react';
import {
  FileText,
  PlusCircle,
  Trash2,
  Download,
  Search,
  Send,
  X,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { invoices as invoiceApi } from '../../services/api/invoices';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import { generateInvoicePdf } from '../../services/pdf';
import { useInvoiceStatusSync } from '../../hooks/useInvoiceStatusSync';
import { downloadCsv } from '../../services/api/_export';
import type { Invoice, PaymentRecord } from '../../types';
import { Modal } from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/ToastProvider';
import { EmptyState } from '../ui/EmptyState';

const STATUS_FILTERS = [
  'All', 'Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled',
] as const;

function statusTone(status: string): string {
  switch (status) {
    case 'Paid': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    case 'Partially Paid': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    case 'Overdue': return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
    case 'Sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
    case 'Cancelled': return 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
  }
}

export function InvoicesTab() {
  const org = auth.getCurrentOrganization();
  const orgId = org?.id ?? '';
  const toast = useToast();
  const { confirm } = useConfirm();

  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [payModal, setPayModal] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentRecord['method']>('EFT');
  const [payRef, setPayRef] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useInvoiceStatusSync({ orgId });

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

  useRealtime({
    table: 'invoices',
    filter: orgId ? `organization_id=eq.${orgId}` : undefined,
    invalidateKeys: ['invoices'],
    enabled: !!orgId,
  });

  const recordPayment = useSupabaseMutation({
    mutationFn: ({
      invoice, amount, method, reference,
    }: {
      invoice: Invoice;
      amount: number;
      method?: PaymentRecord['method'];
      reference?: string;
    }) => {
      const remaining = invoice.total - invoice.amount_paid;
      if (remaining <= 0) throw new Error('Invoice is already settled.');
      if (amount <= 0) throw new Error('Payment amount must be greater than zero.');
      if (amount > remaining + 0.001) {
        throw new Error(`Amount exceeds balance due (E${remaining.toLocaleString()}).`);
      }
      return invoiceApi.recordPayment(invoice.id, {
        amount,
        method: method ?? 'EFT',
        reference: reference ?? `PAY-${invoice.invoice_number}`,
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

  const clearSelection = () => setSelected(new Set());

  const handlePdf = (inv: Invoice, open = false) => {
    const currentOrg = auth.getCurrentOrganization();
    if (!currentOrg) return;
    const tenant = tenants.find((t) => t.id === inv.tenant_id);
    void generateInvoicePdf(inv, currentOrg, tenant, { open });
  };

  const handleBulkGenerate = async () => {
    try {
      const n = await bulkGenerate.mutate(undefined as never);
      const period = new Date();
      const label = period.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      if (n > 0) {
        toast.success(`Generated ${n} invoice${n === 1 ? '' : 's'}`, `Rent invoices for ${label} are ready.`);
      } else {
        toast.info('Nothing generated', `No rent invoices were needed for ${label}.`);
      }
    } catch (e) {
      toast.error('Generation failed', e instanceof Error ? e.message : 'Could not generate invoices.');
    }
  };

  const openPayModal = (invoice: Invoice) => {
    const remaining = Math.max(0, invoice.total - invoice.amount_paid);
    setPayModal(invoice);
    setPayAmount(String(remaining));
    setPayMethod('EFT');
    setPayRef(`PAY-${invoice.invoice_number}`);
  };

  const handleRecordPayment = async () => {
    if (!payModal) return;
    const amount = Number(payAmount);
    try {
      await recordPayment.mutate({
        invoice: payModal,
        amount,
        method: payMethod,
        reference: payRef || undefined,
      });
      toast.success('Payment recorded', `E${amount.toLocaleString()} applied to ${payModal.invoice_number}.`);
      setPayModal(null);
    } catch (e) {
      toast.error('Payment failed', e instanceof Error ? e.message : 'Could not record payment.');
    }
  };

  const handleDelete = async (inv: Invoice) => {
    const ok = await confirm({
      title: `Delete invoice ${inv.invoice_number}?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete invoice',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteInvoice.mutate(inv.id);
      toast.success('Invoice deleted', `${inv.invoice_number} has been removed.`);
    } catch (e) {
      toast.error('Delete failed', e instanceof Error ? e.message : 'Could not delete invoice.');
    }
  };

  const handleSendReminders = async () => {
    try {
      const n = await invoiceApi.sendReminders(Array.from(selected));
      if (n > 0) {
        toast.success(
          `Sent ${n} reminder${n === 1 ? '' : 's'}`,
          'Tenants with a portal login were notified in-app.'
        );
      } else {
        toast.info(
          'No reminders sent',
          'Selected invoices need an outstanding balance and a tenant with a portal login.'
        );
      }
      clearSelection();
    } catch (e) {
      toast.error('Reminders failed', e instanceof Error ? e.message : 'Could not send reminders.');
    }
  };

  if (!orgId) {
    return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="p-4 border-b bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-sm">Invoices</h3>
          <p className="text-xs text-slate-500">Generate, send, and reconcile invoices for your tenants</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              downloadCsv(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, [
                ['Invoice', 'Tenant', 'Unit', 'Issue', 'Due', 'Status', 'Total', 'Paid'],
                ...filtered.map((i) => [
                  i.invoice_number, i.tenant_name, i.shop_number ?? '', i.issue_date, i.due_date,
                  i.status, i.total, i.amount_paid,
                ]),
              ])
            }
            className="px-3 py-1.5 bg-white dark:bg-slate-700 border text-xs font-bold rounded-xl flex items-center gap-1.5"
            type="button"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
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
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, tenant, unit…"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 flex flex-wrap items-center gap-3">
          <button type="button" onClick={clearSelection} className="p-1 rounded-lg text-blue-700" aria-label="Clear">
            <X className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={() => void handleSendReminders()}
            className="ml-auto px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Send reminders
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-5 h-5" />}
            title="No invoices match your filters"
            message="Try clearing the search or status filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-left">Tenant</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(inv.id)}
                        onChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(inv.id)) next.delete(inv.id);
                            else next.add(inv.id);
                            return next;
                          });
                        }}
                        className="w-3.5 h-3.5 rounded"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono font-bold">{inv.invoice_number}</td>
                    <td className="px-3 py-2">{inv.tenant_name}</td>
                    <td className="px-3 py-2 text-slate-500">{inv.due_date}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusTone(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold">E{inv.total.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => handlePdf(inv, true)} className="text-blue-600 font-semibold hover:underline">
                          View PDF
                        </button>
                        <button type="button" onClick={() => setViewingInvoice(inv)} className="text-blue-600 font-semibold hover:underline">
                          View
                        </button>
                        {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                          <button type="button" onClick={() => openPayModal(inv)} className="text-emerald-600 font-semibold hover:underline">
                            Pay
                          </button>
                        )}
                        <button type="button" onClick={() => handleDelete(inv)} className="p-1 text-slate-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payModal && (
        <Modal open onClose={() => setPayModal(null)} title={`Record payment — ${payModal.invoice_number}`} size="sm">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Amount (E)</label>
              <input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Method</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentRecord['method'])}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900">
                <option value="EFT">EFT</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Reference</label>
              <input value={payRef} onChange={(e) => setPayRef(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPayModal(null)} className="px-4 py-2 rounded-xl border">Cancel</button>
              <button type="button" onClick={() => void handleRecordPayment()} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold">
                Record payment
              </button>
            </div>
          </div>
        </Modal>
      )}

      {viewingInvoice && (
        <Modal open onClose={() => setViewingInvoice(null)} title={viewingInvoice.invoice_number} size="md">
          <div className="space-y-3 text-xs">
            <p><strong>Tenant:</strong> {viewingInvoice.tenant_name}</p>
            <p><strong>Status:</strong> {viewingInvoice.status}</p>
            <p><strong>Total:</strong> E{viewingInvoice.total.toLocaleString()}</p>
            <p><strong>Paid:</strong> E{viewingInvoice.amount_paid.toLocaleString()}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => handlePdf(viewingInvoice, true)} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">
                View PDF
              </button>
              <button type="button" onClick={() => setViewingInvoice(null)} className="px-4 py-2 rounded-xl border">Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
