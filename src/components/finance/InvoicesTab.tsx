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
import { shops as shopsApi } from '../../services/api/shops';
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

function orgBanking() {
  const o = auth.getCurrentOrganization() as (ReturnType<typeof auth.getCurrentOrganization> & {
    bank_name?: string;
    bank_account_number?: string;
    bank_branch_code?: string;
    bank_account_name?: string;
  }) | null;
  return {
    bank: o?.bank_name || '— set bank in Org Settings —',
    account: o?.bank_account_number || '—',
    branch: o?.bank_branch_code || '—',
    accountName: o?.bank_account_name || '',
  };
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
    mutationFn: ({
      invoice,
      amount,
      method,
      reference,
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

  const allVisibleSelected =
    filtered.length > 0 && selected.size === filtered.length;

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  };

  const clearSelection = () => setSelected(new Set());

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
      const label = period.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      if (n > 0) {
        toast.success(
          `Generated ${n} invoice${n === 1 ? '' : 's'}`,
          `Rent invoices for ${label} are ready.`
        );
      } else {
        toast.info('Nothing generated', `No rent invoices were needed for ${label}.`);
      }
    } catch (e) {
      toast.error(
        'Generation failed',
        e instanceof Error ? e.message : 'Could not generate invoices.'
      );
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
      toast.success(
        'Payment recorded',
        `E${amount.toLocaleString()} applied to ${payModal.invoice_number}.`
      );
      setPayModal(null);
    } catch (e) {
      toast.error(
        'Payment failed',
        e instanceof Error ? e.message : 'Could not record payment.'
      );
    }
  };

  const handleDelete = async (inv: Invoice) => {
    const ok = await confirm({
      title: `Delete invoice ${inv.invoice_number}?`,
      message:
        'This cannot be undone. Payment history attached to this invoice will be orphaned.',
      confirmLabel: 'Delete invoice',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteInvoice.mutate(inv.id);
      toast.success('Invoice deleted', `${inv.invoice_number} has been removed.`);
    } catch (e) {
      toast.error(
        'Delete failed',
        e instanceof Error ? e.message : 'Could not delete invoice.'
      );
    }
  };

  const handleExportSelected = () => {
    const rows = invoices.filter((i) => selected.has(i.id));
    if (rows.length === 0) return;
    downloadCsv(
      `invoices-selected-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Invoice', 'Tenant', 'Unit', 'Issue Date', 'Due Date', 'Status', 'Total', 'Paid', 'Balance'],
        ...rows.map((i) => [
          i.invoice_number,
          i.tenant_name,
          i.shop_number ?? '',
          i.issue_date,
          i.due_date,
          i.status,
          i.total,
          i.amount_paid,
          i.total - i.amount_paid,
        ]),
      ]
    );
    toast.success(`Exported ${rows.length} invoice${rows.length === 1 ? '' : 's'}`);
    clearSelection();
  };

  const handleExportAll = () => {
    downloadCsv(
      `invoices-all-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Invoice', 'Tenant', 'Unit', 'Issue Date', 'Due Date', 'Status', 'Total', 'Paid', 'Balance'],
        ...filtered.map((i) => [
          i.invoice_number,
          i.tenant_name,
          i.shop_number ?? '',
          i.issue_date,
          i.due_date,
          i.status,
          i.total,
          i.amount_paid,
          i.total - i.amount_paid,
        ]),
      ]
    );
    toast.success(`Exported ${filtered.length} invoice${filtered.length === 1 ? '' : 's'}`);
  };

  if (!orgId) {
    return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAll}
            className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-600"
            type="button"
          >
            <Download className="w-3.5 h-3.5" /> Export all
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

      {selected.size > 0 && (
        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="p-1 rounded-lg text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50"
              aria-label="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
              {selected.size} invoice{selected.size === 1 ? '' : 's'} selected
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleExportSelected}
              className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-xl flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() =>
                toast.info(
                  'Reminders queued',
                  `${selected.size} reminder${selected.size === 1 ? '' : 's'} will be sent. (Wire to reminders API in Phase 6.)`
                )
              }
              className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Send reminders
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    className="w-3.5 h-3.5 rounded"
                    aria-label="Select all visible invoices"
                  />
                </th>
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
                  <td colSpan={10}>
                    <EmptyState
                      icon={<FileText className="w-5 h-5" />}
                      title="No invoices match your filters"
                      message="Try clearing the search or status filter."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`hover:bg-slate-50/60 dark:hover:bg-slate-700/30 ${
                      selected.has(inv.id) ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(inv.id)}
                        onChange={() => toggleSelected(inv.id)}
                        className="w-3.5 h-3.5 rounded"
                        aria-label={`Select ${inv.invoice_number}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] font-bold">
                      {inv.invoice_number}
                    </td>
                    <td className="px-4 py-3">{inv.tenant_name}</td>
                    <td className="px-4 py-3">{inv.shop_number ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{inv.issue_date}</td>
                    <td className="px-4 py-3 text-slate-500">{inv.due_date}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusTone(inv.status)}`}
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
                          className="text-[11px] font-semibold text-slate-600 hover:underline"
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
                            onClick={() => openPayModal(inv)}
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
                          className="p-1 text-slate-400 hover:text-red-500"
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

      <Modal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title="Record payment"
        subtitle={
          payModal
            ? `${payModal.invoice_number} · ${payModal.tenant_name}`
            : undefined
        }
        size="sm"
      >
        {payModal && (
          <>
            <p className="text-xs text-slate-500">
              Balance due E{(payModal.total - payModal.amount_paid).toLocaleString()}
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Amount (E)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Enter less than the balance for a partial payment.
                </p>
              </div>
              <div>
                <label className="block font-semibold mb-1">Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentRecord['method'])}
                  className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
                >
                  <option value="EFT">EFT</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Reference</label>
                <input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setPayModal(null)}
                className="px-4 py-2 rounded-xl border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRecordPayment()}
                disabled={recordPayment.loading}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold"
              >
                {recordPayment.loading ? 'Saving…' : 'Record payment'}
              </button>
            </div>
          </>
        )}
      </Modal>
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
  const bank = orgBanking();

  const handlePdf = () => {
    const o = auth.getCurrentOrganization();
    if (o) generateInvoicePdf(invoice, o);
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Invoice ${invoice.invoice_number}`}
      icon={<FileText className="w-5 h-5 text-blue-600" />}
      size="md"
      panelClassName="!bg-white dark:!bg-slate-900"
    >
      <div className="space-y-4 text-xs">
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
                  <td className="p-2.5 text-right text-amber-700">Balance due</td>
                  <td className="p-2.5 text-right text-amber-700">
                    E{(invoice.total - invoice.amount_paid).toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 rounded-xl border text-[11px] space-y-1">
          <div className="font-bold">Banking details</div>
          <div>Bank: {bank.bank}</div>
          {bank.accountName && <div>Account name: {bank.accountName}</div>}
          <div>
            Account #: {bank.account} • Branch: {bank.branch}
          </div>
          <div className="text-slate-400">Ref: {invoice.invoice_number}</div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border text-xs font-semibold"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePdf}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
        </div>
      </div>
    </Modal>
  );
}
