// src/components/finance/InvoicesTab.tsx
import React, { useMemo, useState } from 'react';
import {
  FileText,
  PlusCircle,
  Trash2,
  Download,
  Search,
  Send,
  X,
  Ban,
  Paperclip,
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
import { formatMoney, parseMoney, MONEY_INPUT_PROPS } from '../../lib/money';

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
  const [payFile, setPayFile] = useState<File | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [creditModal, setCreditModal] = useState<Invoice | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [createTenantId, setCreateTenantId] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createAmount, setCreateAmount] = useState('');
  const [createTax, setCreateTax] = useState('0');
  const [createDueDays, setCreateDueDays] = useState('7');

  useInvoiceStatusSync({ orgId });

  const { data: invoices = [], refetch } = useSupabaseQuery(
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

  const bulkGenerate = useSupabaseMutation({
    mutationFn: () => {
      const period = new Date();
      period.setDate(1);
      return invoiceApi.bulkGenerateRent(period.toISOString().slice(0, 10));
    },
    invalidateKeys: ['invoices', 'finance_transactions'],
  });

  const createInvoice = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof invoiceApi.create>[0]) => invoiceApi.create(input),
    invalidateKeys: ['invoices', 'finance_transactions'],
  });

  const deleteInvoice = useSupabaseMutation({
    mutationFn: (id: string) => invoiceApi.remove(id),
    invalidateKeys: ['invoices'],
  });

  const cancelInvoice = useSupabaseMutation({
    mutationFn: (id: string) => invoiceApi.cancel(id),
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

  const handleCreateInvoice = async () => {
    if (!createTenantId) {
      toast.error('Tenant required', 'Select a tenant for this invoice.');
      return;
    }
    const amount = parseMoney(createAmount);
    if (amount <= 0) {
      toast.error('Amount required', 'Enter an amount greater than zero (cents allowed, e.g. 10.50).');
      return;
    }
    const desc = createDesc.trim() || 'Invoice';
    const taxRate = parseMoney(createTax) / 100;
    const dueDays = Math.max(0, Math.floor(Number(createDueDays) || 0));
    const issue = new Date();
    const due = new Date(issue);
    due.setDate(due.getDate() + dueDays);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    try {
      const inv = await createInvoice.mutate({
        tenant_id: createTenantId,
        type: 'Other',
        issue_date: iso(issue),
        due_date: iso(due),
        tax_rate: taxRate,
        lines: [{ description: desc, quantity: 1, unit_amount: amount }],
      });
      toast.success('Invoice created', inv.invoice_number);
      setShowCreate(false);
      setCreateTenantId('');
      setCreateDesc('');
      setCreateAmount('');
      setCreateTax('0');
      setCreateDueDays('7');
      void refetch();
    } catch (e) {
      toast.error('Create failed', e instanceof Error ? e.message : 'Could not create invoice.');
    }
  };

  const openPayModal = (invoice: Invoice) => {
    const remaining = Math.max(0, invoice.total - invoice.amount_paid);
    const claim = invoiceApi.parseLatestClaim(invoice.notes);
    setPayModal(invoice);
    setPayAmount(String(claim?.amount ?? remaining));
    setPayMethod((claim?.method as PaymentRecord['method']) || 'EFT');
    setPayRef(claim?.reference || `PAY-${invoice.invoice_number}`);
    setPayFile(null);
  };

  const handleRecordPayment = async () => {
    if (!payModal) return;
    const amount = Number(payAmount);
    setPayBusy(true);
    try {
      let proof_url: string | undefined;
      if (payFile) {
        proof_url = await invoiceApi.uploadProof(payFile, payModal.id);
      }
      await invoiceApi.recordPayment(payModal.id, {
        amount,
        method: payMethod,
        reference: payRef || undefined,
        proof_url,
      });
      toast.success('Payment recorded', `E${amount.toLocaleString()} applied to ${payModal.invoice_number}.`);
      setPayModal(null);
      void refetch?.();
    } catch (e) {
      toast.error('Payment failed', e instanceof Error ? e.message : 'Could not record payment.');
    } finally {
      setPayBusy(false);
    }
  };

  const handleCancel = async (inv: Invoice) => {
    const ok = await confirm({
      title: `Cancel invoice ${inv.invoice_number}?`,
      message: 'The invoice stays on record as Cancelled. Prefer this over delete when the invoice was ever sent.',
      confirmLabel: 'Cancel invoice',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await cancelInvoice.mutate(inv.id);
      toast.success('Invoice cancelled', `${inv.invoice_number} is now Cancelled.`);
    } catch (e) {
      toast.error('Cancel failed', e instanceof Error ? e.message : 'Could not cancel.');
    }
  };

  const handleDelete = async (inv: Invoice) => {
    const ok = await confirm({
      title: `Delete invoice ${inv.invoice_number}?`,
      message: 'Only use for drafts with no payments. Prefer Cancel for sent invoices.',
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

  const handleCredit = async () => {
    if (!creditModal) return;
    const amount = Number(creditAmount);
    if (!creditReason.trim()) {
      toast.error('Reason required', 'Enter why you are issuing this credit note.');
      return;
    }
    try {
      await invoiceApi.issueCreditNote(creditModal.id, amount, creditReason.trim());
      toast.success('Credit note applied', `E${amount.toLocaleString()} credited on ${creditModal.invoice_number}.`);
      setCreditModal(null);
      setCreditAmount('');
      setCreditReason('');
      void refetch?.();
    } catch (e) {
      toast.error('Credit failed', e instanceof Error ? e.message : 'Could not issue credit.');
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
          <p className="text-xs text-slate-500">Generate, collect, cancel, and credit invoices</p>
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
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            type="button"
          >
            <PlusCircle className="w-4 h-4" />
            New invoice
          </button>
          <button
            onClick={handleBulkGenerate}
            disabled={bulkGenerate.loading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            type="button"
            title="Draft rent invoices for all active tenants this month"
          >
            {bulkGenerate.loading ? 'Generating…' : 'Bulk rent (month)'}
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
                {filtered.map((inv) => {
                  const claim = invoiceApi.parseLatestClaim(inv.notes);
                  return (
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
                    <td className="px-3 py-2 font-mono font-bold">
                      {inv.invoice_number}
                      {claim && inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                        <span className="ml-1 text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">POP claim</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{inv.tenant_name}</td>
                    <td className="px-3 py-2 text-slate-500">{inv.due_date}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusTone(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{formatMoney(inv.total)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <button type="button" onClick={() => handlePdf(inv, true)} className="text-blue-600 font-semibold hover:underline">
                          PDF
                        </button>
                        <button type="button" onClick={() => setViewingInvoice(inv)} className="text-blue-600 font-semibold hover:underline">
                          View
                        </button>
                        {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                          <>
                            <button type="button" onClick={() => openPayModal(inv)} className="text-emerald-600 font-semibold hover:underline">
                              Pay
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCreditModal(inv);
                                setCreditAmount(String(Math.max(0, inv.total - inv.amount_paid)));
                                setCreditReason('');
                              }}
                              className="text-violet-600 font-semibold hover:underline"
                            >
                              Credit
                            </button>
                            <button type="button" onClick={() => void handleCancel(inv)} className="text-amber-600 font-semibold hover:underline" title="Cancel">
                              <Ban className="w-3.5 h-3.5 inline" />
                            </button>
                          </>
                        )}
                        <button type="button" onClick={() => void handleDelete(inv)} className="p-1 text-slate-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payModal && (
        <Modal open onClose={() => setPayModal(null)} title={`Record payment — ${payModal.invoice_number}`} size="sm">
          <div className="space-y-3 text-xs">
            {(() => {
              const claim = invoiceApi.parseLatestClaim(payModal.notes);
              if (!claim) return null;
              return (
                <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 text-violet-900 dark:text-violet-200">
                  <div className="font-bold mb-1">Tenant payment claim</div>
                  <p>E{Number(claim.amount).toLocaleString()} · {claim.method}{claim.reference ? ` · ${claim.reference}` : ''}</p>
                  <p className="text-[10px] mt-0.5 opacity-80">By {claim.by} · {new Date(claim.at).toLocaleString()}</p>
                  {claim.proof_url && (
                    <a href={claim.proof_url} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold underline mt-1 inline-block">
                      View submitted POP
                    </a>
                  )}
                </div>
              );
            })()}
            <div>
              <label className="block font-semibold mb-1">Amount (E)</label>
              <input type="number" min={0} step="0.01" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
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
            <div>
              <label className="block font-semibold mb-1 flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5" /> Proof of payment (optional)
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setPayFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs"
              />
              {payFile && <p className="text-[10px] text-slate-500 mt-1">{payFile.name}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPayModal(null)} className="px-4 py-2 rounded-xl border">Cancel</button>
              <button type="button" disabled={payBusy} onClick={() => void handleRecordPayment()} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-60">
                {payBusy ? 'Saving…' : 'Record payment'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {creditModal && (
        <Modal open onClose={() => setCreditModal(null)} title={`Credit note — ${creditModal.invoice_number}`} size="sm">
          <div className="space-y-3 text-xs">
            <p className="text-slate-500">Reduces the outstanding balance (applied as a credit payment on the invoice).</p>
            <div>
              <label className="block font-semibold mb-1">Amount (E)</label>
              <input type="number" min={0} step="0.01" inputMode="decimal" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Reason *</label>
              <input value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder="e.g. Partial rent waiver"
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreditModal(null)} className="px-4 py-2 rounded-xl border">Close</button>
              <button type="button" onClick={() => void handleCredit()} className="px-4 py-2 rounded-xl bg-violet-600 text-white font-bold">
                Apply credit
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="New invoice" size="md">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Tenant *</label>
              <select
                value={createTenantId}
                onChange={(e) => setCreateTenantId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
              >
                <option value="">Select tenant…</option>
                {tenants
                  .filter((t) => t.status === 'Active')
                  .map((ten) => (
                    <option key={ten.id} value={ten.id}>
                      {ten.business_name || ten.contact_person} ({ten.email})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Description</label>
              <input
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="e.g. Monthly rent — September 2026"
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Amount (E) *</label>
                <input
                  {...MONEY_INPUT_PROPS}
                  value={createAmount}
                  onChange={(e) => setCreateAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Tax % (default 0)</label>
                <input
                  {...MONEY_INPUT_PROPS}
                  value={createTax}
                  onChange={(e) => setCreateTax(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Due in (days)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={createDueDays}
                onChange={(e) => setCreateDueDays(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Creates one draft invoice for the selected tenant. Use “Bulk rent” only when you want every active tenant invoiced for the month.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border">
                Cancel
              </button>
              <button
                type="button"
                disabled={createInvoice.loading}
                onClick={() => void handleCreateInvoice()}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-60"
              >
                {createInvoice.loading ? 'Creating…' : 'Create invoice'}
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
            <p><strong>Total:</strong> {formatMoney(viewingInvoice.total)}</p>
            <p><strong>Paid:</strong> {formatMoney(viewingInvoice.amount_paid)}</p>
            {viewingInvoice.notes && (
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border whitespace-pre-wrap max-h-40 overflow-y-auto">
                {viewingInvoice.notes}
              </div>
            )}
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
