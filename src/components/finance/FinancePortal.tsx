import React, { useMemo, useState } from 'react';
import {
  DollarSign, Receipt, PlusCircle, CheckCircle2, X, Trash2, FileSpreadsheet,
  Printer, FileText,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { financeTransactions as txApi } from '../../services/api/financeTransactions';
import { financialRequests as reqApi } from '../../services/api/financialRequests';
import { invoices as invoiceApi } from '../../services/api/invoices';
import { shoppingCenters as centersApi } from '../../services/api/shoppingCenters';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { shops as shopsApi } from '../../services/api/shops';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import { downloadCsv } from '../../services/api/_export';
import type { FinanceTransaction, Invoice } from '../../types';

interface Props {
  initialTab?: string;
}

type Tab = 'rent_roll' | 'expenses' | 'requests';

export const FinancePortal: React.FC<Props> = ({ initialTab }) => {
  const org = auth.getCurrentOrganization();
  const orgId = org?.id ?? '';

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (initialTab === 'expenses_ledger' || initialTab === 'expenses') return 'expenses';
    if (initialTab === 'financial_requests' || initialTab === 'requests') return 'requests';
    return 'rent_roll';
  });

  const [feedback, setFeedback] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // ---- Data ----
  const { data: transactions = [] } = useSupabaseQuery(
    ['finance_transactions', orgId],
    () => txApi.list(),
    { enabled: !!orgId }
  );
  const { data: invoices = [] } = useSupabaseQuery(
    ['invoices', orgId],
    () => invoiceApi.list(),
    { enabled: !!orgId }
  );
  const { data: requests = [] } = useSupabaseQuery(
    ['financial_requests', orgId],
    () => reqApi.list(),
    { enabled: !!orgId }
  );
  const { data: centers = [] } = useSupabaseQuery(
    ['centers', orgId],
    () => centersApi.list(),
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

  useRealtime({ table: 'finance_transactions', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['finance_transactions'], enabled: !!orgId });
  useRealtime({ table: 'invoices', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['invoices'], enabled: !!orgId });
  useRealtime({ table: 'financial_requests', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['financial_requests'], enabled: !!orgId });

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const rentRoll = shops.reduce((s, x) => s + x.rental_amount, 0);
    const collected = invoices.reduce((s, i) => s + i.amount_paid, 0);
    const outstanding = invoices.reduce((s, i) => s + (i.total - i.amount_paid), 0);
    const expense = transactions
      .filter((t) => t.direction === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    return {
      rentRoll,
      collected,
      outstanding,
      arrears: Math.max(0, rentRoll - collected),
      expense,
      net: collected - expense,
    };
  }, [shops, invoices, transactions]);

  const expenseTransactions = transactions.filter((t) => t.direction === 'expense');

  // ---- Mutations ----
const createExpense = useSupabaseMutation({
  mutationFn: (input: { description: string; category: string; amount: number; shopping_center_id: string; status: string }) =>
    txApi.create({
      property_id: input.shopping_center_id,
      type: 'Maintenance Expense',
      category: input.category,
      amount: input.amount,
      direction: 'expense',
      description: input.description,
      reference: `EXP-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().slice(0, 10),
      status: input.status as never,
    }),
  invalidateKeys: ['finance_transactions'],
  onSuccess: () => {
    setFeedback('Expense recorded.');
    setTimeout(() => setFeedback(''), 3000);
    setShowExpenseModal(false);
  },
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
    onSuccess: () => { setFeedback('Payment recorded.'); setTimeout(() => setFeedback(''), 3000); },
  });

  const bulkGenerate = useSupabaseMutation({
    mutationFn: () => {
      const period = new Date();
      period.setDate(1);
      return invoiceApi.bulkGenerateRent(period.toISOString().slice(0, 10));
    },
    invalidateKeys: ['invoices', 'finance_transactions'],
    onSuccess: (n) => { setFeedback(`Generated ${n} rent invoices.`); setTimeout(() => setFeedback(''), 3500); },
  });

  const deleteExpense = useSupabaseMutation({
    mutationFn: (id: string) => txApi.remove(id),
    invalidateKeys: ['finance_transactions'],
    onSuccess: () => { setFeedback('Expense removed.'); setTimeout(() => setFeedback(''), 3000); },
  });

  const createRequest = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof reqApi.create>[0]) => reqApi.create(input),
    invalidateKeys: ['financial_requests'],
    onSuccess: () => { setFeedback('Requisition submitted.'); setTimeout(() => setFeedback(''), 3000); setShowRequisitionModal(false); },
  });

  const approveRequest = useSupabaseMutation({
    mutationFn: (id: string) => reqApi.approve(id),
    invalidateKeys: ['financial_requests'],
    onSuccess: () => { setFeedback('Requisition approved.'); setTimeout(() => setFeedback(''), 3000); },
  });
  const disburseRequest = useSupabaseMutation({
    mutationFn: (id: string) => reqApi.disburse(id),
    invalidateKeys: ['financial_requests', 'finance_transactions'],
    onSuccess: () => { setFeedback('Requisition disbursed.'); setTimeout(() => setFeedback(''), 3000); },
  });

  // ---- Export ----
  const exportSage = () => {
    const rows: (string | number)[][] = [
      ['InvoiceNumber', 'Tenant', 'Unit', 'IssueDate', 'DueDate', 'Status', 'Subtotal', 'Tax', 'Total', 'AmountPaid'],
      ...invoices.map((i) => [
        i.invoice_number, i.tenant_name, i.shop_number ?? '',
        i.issue_date, i.due_date, i.status,
        i.subtotal, i.tax_amount, i.total, i.amount_paid,
      ]),
    ];
    downloadCsv(`umhlaba-wami-invoices-${orgId}.csv`, rows);
    setFeedback('Exported invoice CSV (Sage/QuickBooks friendly).');
    setTimeout(() => setFeedback(''), 3000);
  };

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-900 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold px-2 py-0.5 rounded bg-white/20 text-emerald-100 inline-block">
            Commercial finance desk
          </div>
          <h1 className="text-2xl font-bold mt-1">{org?.company_name || 'Portfolio'}</h1>
          <p className="text-xs text-emerald-100">
            Invoice reconciliation, arrears tracking and maintenance expense ledger
          </p>
        </div>
        <button onClick={exportSage}
          className="px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-xs rounded-xl shadow-md flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
          Export to Sage / QuickBooks
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {feedback}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: 'Monthly rent roll', value: `E ${kpis.rentRoll.toLocaleString()}` },
          { label: 'Collected', value: `E ${kpis.collected.toLocaleString()}`, tone: 'text-emerald-600' },
          { label: 'Outstanding', value: `E ${kpis.outstanding.toLocaleString()}`, tone: 'text-red-600' },
          { label: 'Maintenance expense', value: `E ${kpis.expense.toLocaleString()}` },
          { label: 'Net operating', value: `E ${kpis.net.toLocaleString()}`, tone: 'text-blue-600' },
        ].map((k) => (
          <div key={k.label} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border">
            <div className="text-xs text-slate-500 mb-1">{k.label}</div>
            <div className={`text-xl font-bold font-display ${k.tone ?? 'text-slate-900 dark:text-white'}`}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b pb-2 flex-wrap">
        {([
          { id: 'rent_roll', label: `Rent roll & invoices (${invoices.length})` },
          { id: 'expenses', label: `Expenses (${expenseTransactions.length})` },
          { id: 'requests', label: `Requisitions (${requests.length})` },
        ] as { id: Tab; label: string }[]).map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Rent roll */}
      {activeTab === 'rent_roll' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">Invoices</h3>
              <p className="text-xs text-slate-500">Generate, track, and reconcile monthly invoices</p>
            </div>
            <button onClick={() => bulkGenerate.mutate(undefined as never)} disabled={bulkGenerate.loading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4" /> Generate rent invoices
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">No invoices yet. Generate them above.</td></tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-mono text-[11px]">{inv.invoice_number}</td>
                    <td className="px-4 py-3">{inv.tenant_name}</td>
                    <td className="px-4 py-3">{inv.shop_number ?? '—'}</td>
                    <td className="px-4 py-3">{inv.due_date}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800'
                        : inv.status === 'Overdue' ? 'bg-red-100 text-red-800'
                        : inv.status === 'Partially Paid' ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                      }`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 font-bold">E{inv.total.toLocaleString()}</td>
                    <td className="px-4 py-3">E{inv.amount_paid.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setViewingInvoice(inv)}
                          className="text-[11px] font-semibold text-blue-600 hover:underline">
                          View
                        </button>
                        {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                          <button onClick={() => recordPayment.mutate({ invoice: inv })}
                            disabled={recordPayment.loading}
                            className="text-[11px] font-semibold text-emerald-600 hover:underline">
                            Record payment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expenses */}
      {activeTab === 'expenses' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">Maintenance expense ledger</h3>
              <p className="text-xs text-slate-500">All repair costs, materials, utilities, vendor payouts</p>
            </div>
            <button onClick={() => setShowExpenseModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4" /> Record expense
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Reference</th>
                  <th className="px-3 py-2.5">Description</th>
                  <th className="px-3 py-2.5">Center</th>
                  <th className="px-3 py-2.5">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenseTransactions.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400">No expenses recorded.</td></tr>
                ) : expenseTransactions.map((tx) => {
                  const center = centers.find((c) => c.id === tx.property_id);
                  return (
                    <tr key={tx.id}>
                      <td className="px-3 py-3 text-slate-500">{tx.date}</td>
                      <td className="px-3 py-3 font-mono text-blue-600">{tx.reference || tx.id.slice(0, 8)}</td>
                      <td className="px-3 py-3">{tx.description}</td>
                      <td className="px-3 py-3 text-slate-500">{center?.name || '—'}</td>
                      <td className="px-3 py-3 font-bold">E{tx.amount.toLocaleString()}</td>
                      <td className="px-3 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => { if (confirm('Delete expense?')) deleteExpense.mutate(tx.id); }}
                          className="p-1 text-slate-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Requisitions */}
      {activeTab === 'requests' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">Requisitions & petty cash</h3>
              <p className="text-xs text-slate-500">Technician material requests requiring finance sign-off</p>
            </div>
            <button onClick={() => setShowRequisitionModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4" /> New requisition
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Requester</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Purpose</th>
                  <th className="px-3 py-2.5">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">No requisitions.</td></tr>
                ) : requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-3">{r.requested_by_name}</td>
                    <td className="px-3 py-3">{r.type}</td>
                    <td className="px-3 py-3 max-w-md">{r.purpose}</td>
                    <td className="px-3 py-3 font-bold">E{r.amount.toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.status === 'Disbursed' ? 'bg-blue-100 text-blue-800'
                        : r.status === 'Approved' ? 'bg-emerald-100 text-emerald-800'
                        : r.status === 'Rejected' ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {r.status === 'Pending Approval' && (
                        <button onClick={() => approveRequest.mutate(r.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold">
                          Approve
                        </button>
                      )}
                      {r.status === 'Approved' && (
                        <button onClick={() => disburseRequest.mutate(r.id)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold">
                          Disburse cash
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
     {showExpenseModal && (
  <ExpenseForm
    centers={centers}
    onCancel={() => setShowExpenseModal(false)}
    onSubmit={(input) => {
      createExpense.mutate(input);
    }}
  />
)}

      {showRequisitionModal && (
        <RequisitionForm
          onCancel={() => setShowRequisitionModal(false)}
          onSubmit={(input) => createRequest.mutate(input)}
        />
      )}

      {viewingInvoice && (
        <InvoiceViewer invoice={viewingInvoice} shops={shops}
          onClose={() => setViewingInvoice(null)} />
      )}
    </div>
  );
};

// ----- Expense modal -----
function ExpenseForm({
  centers, onCancel, onSubmit,
}: {
  centers: { id: string; name: string }[];
  onCancel: () => void;
  onSubmit: (input: {
    description: string; category: string; amount: number;
    shopping_center_id: string; status: string;
  }) => void;
}) {
  // NOTE:  the parent should own the mutation; kept simple here.
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Maintenance');
  const [amount, setAmount] = useState(650);
  const [centerId, setCenterId] = useState(centers[0]?.id ?? '');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" /> Record expense
          </h3>
          <button onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ description, category, amount, shopping_center_id: centerId, status: 'Approved' });
        }} className="space-y-3 text-xs">
          <input required value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Expense description"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          <div className="grid grid-cols-2 gap-3">
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
              <option>Maintenance</option>
              <option>Utilities</option>
              <option>Security</option>
              <option>Other</option>
            </select>
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <input type="number" required value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border font-bold" />
          <div className="pt-3 flex justify-end gap-2 border-t">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
              Save entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----- Requisition modal -----
function RequisitionForm({
  onCancel, onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (input: {
    requested_by_name: string; type: string; amount: number; purpose: string;
  }) => void;
}) {
  const user = auth.getCurrentUser();
  const [requestedBy, setRequestedBy] = useState(user?.name ?? '');
  const [type, setType] = useState('Petty Cash');
  const [amount, setAmount] = useState(450);
  const [purpose, setPurpose] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">New requisition</h3>
          <button onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ requested_by_name: requestedBy, type, amount, purpose });
        }} className="space-y-3 text-xs">
          <input required value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)}
            placeholder="Requested by"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
            <option>Petty Cash</option><option>Purchase Request</option>
            <option>Maintenance Funding</option><option>Vendor Payment</option>
          </select>
          <textarea required value={purpose} onChange={(e) => setPurpose(e.target.value)}
            rows={3} placeholder="Purpose / items required"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          <input type="number" required value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border font-bold" />
          <div className="pt-3 flex justify-end gap-2 border-t">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----- Invoice viewer -----
function InvoiceViewer({
  invoice, shops, onClose,
}: {
  invoice: Invoice;
  shops: { id: string; shop_number: string }[];
  onClose: () => void;
}) {
  const shop = shops.find((s) => s.id === invoice.shop_id);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border shadow-2xl overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm">Invoice {invoice.invoice_number}</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()}
              className="p-1.5 rounded-lg border text-slate-600 hover:bg-slate-100">
              <Printer className="w-4 h-4" />
            </button>
            <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
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
                    <td className="p-2.5 text-right font-semibold">E{l.amount.toLocaleString()}</td>
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
                  <td className="p-2.5 text-right text-blue-600">E{invoice.total.toLocaleString()}</td>
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


