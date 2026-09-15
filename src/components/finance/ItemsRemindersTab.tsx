import React, { useState } from 'react';
import {
  Package, Bell, PlusCircle, Send, X, Trash2, FileText, Search,
  Receipt, CreditCard,
} from 'lucide-react';
import { auth } from '../../services/auth';
import {
  items as itemsApi,
  reminders as remindersApi,
  statements as statementsApi,
} from '../../services/api/accounting';
import type { InvoiceItem } from '../../services/api/accounting';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { shoppingCenters as centersApi } from '../../services/api/shoppingCenters';
import {
  invoices as invoiceApi,
  payments as paymentsApi,
} from '../../services/api/invoices';
import { financeTransactions as txApi } from '../../services/api/financeTransactions';
import { financialRequests as reqApi } from '../../services/api/financialRequests';
import { generateStatementPdf } from '../../services/pdf';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { Tenant } from '../../types';

type SubTab = 'items' | 'statements' | 'reminders' | 'expenses' | 'requisitions';

export function ItemsRemindersTab() {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [subTab, setSubTab] = useState<SubTab>('items');
  const [feedback, setFeedback] = useState('');

  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [reminderSearch, setReminderSearch] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);

  const { data: catalog = [] } = useSupabaseQuery(
    ['invoice_items', orgId],
    () => itemsApi.list(),
    { enabled: !!orgId }
  );
  const { data: tenants = [] } = useSupabaseQuery(
    ['tenants', orgId],
    () => tenantsApi.list(),
    { enabled: !!orgId }
  );
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

  useRealtime({
    table: 'invoice_items',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['invoice_items'],
    enabled: !!orgId,
  });
  useRealtime({
    table: 'finance_transactions',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['finance_transactions'],
    enabled: !!orgId,
  });
  useRealtime({
    table: 'financial_requests',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['financial_requests'],
    enabled: !!orgId,
  });

  const createItem = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof itemsApi.create>[0]) =>
      itemsApi.create(input),
    invalidateKeys: ['invoice_items'],
    onSuccess: () => {
      setFeedback('Item created.');
      setTimeout(() => setFeedback(''), 3000);
      setShowItemModal(false);
    },
  });
  const updateItem = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<InvoiceItem> }) =>
      itemsApi.update(id, patch),
    invalidateKeys: ['invoice_items'],
    onSuccess: () => {
      setFeedback('Item updated.');
      setTimeout(() => setFeedback(''), 3000);
      setEditingItem(null);
      setShowItemModal(false);
    },
  });
  const removeItem = useSupabaseMutation({
    mutationFn: (id: string) => itemsApi.remove(id),
    invalidateKeys: ['invoice_items'],
    onSuccess: () => {
      setFeedback('Item removed.');
      setTimeout(() => setFeedback(''), 3000);
    },
  });

  const createExpense = useSupabaseMutation({
    mutationFn: (input: {
      description: string;
      category: string;
      amount: number;
      shopping_center_id: string;
    }) =>
      txApi.create({
        property_id: input.shopping_center_id,
        type: 'Maintenance Expense',
        category: input.category,
        amount: input.amount,
        direction: 'expense',
        description: input.description,
        reference: `EXP-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().slice(0, 10),
        status: 'Approved',
      }),
    invalidateKeys: ['finance_transactions'],
    onSuccess: () => {
      setFeedback('Expense recorded.');
      setTimeout(() => setFeedback(''), 3000);
      setShowExpenseModal(false);
    },
  });
  const deleteExpense = useSupabaseMutation({
    mutationFn: (id: string) => txApi.remove(id),
    invalidateKeys: ['finance_transactions'],
    onSuccess: () => {
      setFeedback('Expense removed.');
      setTimeout(() => setFeedback(''), 3000);
    },
  });

  const createRequest = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof reqApi.create>[0]) =>
      reqApi.create(input),
    invalidateKeys: ['financial_requests'],
    onSuccess: () => {
      setFeedback('Requisition submitted.');
      setTimeout(() => setFeedback(''), 3000);
      setShowRequisitionModal(false);
    },
  });
  const approveRequest = useSupabaseMutation({
    mutationFn: (id: string) => reqApi.approve(id),
    invalidateKeys: ['financial_requests'],
    onSuccess: () => {
      setFeedback('Requisition approved.');
      setTimeout(() => setFeedback(''), 3000);
    },
  });
  const disburseRequest = useSupabaseMutation({
    mutationFn: (id: string) => reqApi.disburse(id),
    invalidateKeys: ['financial_requests', 'finance_transactions'],
    onSuccess: () => {
      setFeedback('Requisition disbursed.');
      setTimeout(() => setFeedback(''), 3000);
    },
  });

  const sendReminder = useSupabaseMutation({
    mutationFn: (invoiceId: string) => remindersApi.sendReminder(invoiceId),
    onSuccess: () => {
      setFeedback('Reminder logged.');
      setTimeout(() => setFeedback(''), 3000);
    },
  });

  const overdue = invoices.filter(
    (i) =>
      i.status !== 'Paid' &&
      i.status !== 'Cancelled' &&
      new Date(i.due_date) < new Date()
  );

  const filteredOverdue = reminderSearch
    ? overdue.filter((i) => {
        const q = reminderSearch.toLowerCase();
        return (
          i.invoice_number.toLowerCase().includes(q) ||
          i.tenant_name.toLowerCase().includes(q)
        );
      })
    : overdue;

  const expenseTransactions = transactions.filter(
    (t) => t.direction === 'expense'
  );

  const handleGenerateStatement = async (tenant: Tenant) => {
    const org = auth.getCurrentOrganization();
    if (!org) return;
    setGeneratingId(tenant.id);
    try {
      const statement = await statementsApi.generate(
        tenant.id,
        periodStart,
        periodEnd
      );
      const payments = await paymentsApi.listForTenant(
        tenant.id,
        periodStart,
        periodEnd
      );
      generateStatementPdf(statement, tenant, invoices, payments, org);
      setFeedback(`Statement generated for ${tenant.business_name}.`);
      setTimeout(() => setFeedback(''), 3500);
    } catch (e) {
      setFeedback(
        e instanceof Error ? `Statement failed: ${e.message}` : 'Statement failed.'
      );
      setTimeout(() => setFeedback(''), 4000);
    } finally {
      setGeneratingId(null);
    }
  };

  if (!orgId)
    return (
      <div className="p-6 text-slate-500 text-sm">No organisation context.</div>
    );

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
          {feedback}
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 flex-wrap">
        {(
          [
            { id: 'items', label: `Items catalog (${catalog.length})`, icon: Package },
            { id: 'statements', label: 'Statements', icon: FileText },
            { id: 'reminders', label: `Overdue (${overdue.length})`, icon: Bell },
            {
              id: 'expenses',
              label: `Expenses (${expenseTransactions.length})`,
              icon: Receipt,
            },
            {
              id: 'requisitions',
              label: `Requisitions (${requests.length})`,
              icon: CreditCard,
            },
          ] as {
            id: SubTab;
            label: string;
            icon: React.ComponentType<{ className?: string }>;
          }[]
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                subTab === t.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ITEMS */}
      {subTab === 'items' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">Reusable billing items</h3>
              <p className="text-xs text-slate-500 mt-1">
                Save standard rates so quotes and invoices are consistent
              </p>
            </div>
            <button
              onClick={() => {
                setEditingItem(null);
                setShowItemModal(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> New item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5 text-right">Unit price</th>
                  <th className="px-3 py-2.5 text-right">Tax</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {catalog.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No items yet.
                    </td>
                  </tr>
                ) : (
                  catalog.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-3 font-mono">{it.code ?? '—'}</td>
                      <td className="px-3 py-3 font-bold">{it.name}</td>
                      <td className="px-3 py-3 text-slate-500">
                        {it.category ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-bold">
                        E{it.unit_price.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {(it.tax_rate * 100).toFixed(0)}%
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => {
                            setEditingItem(it);
                            setShowItemModal(true);
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:underline mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${it.name}"?`))
                              removeItem.mutate(it.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STATEMENTS */}
      {subTab === 'statements' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm">Statements of account</h3>
            <p className="text-xs text-slate-500 mt-1">
              Per-tenant, per-period statements with running balance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2">
              <span className="text-slate-500">From</span>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-slate-500">To</span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tenants.length === 0 ? (
              <div className="col-span-full p-8 text-center text-xs text-slate-400">
                No tenants yet.
              </div>
            ) : (
              tenants.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-2"
                >
                  <div className="font-bold text-xs">{t.business_name}</div>
                  <div className="text-[11px] text-slate-500">
                    {t.contact_person}
                  </div>
                  <div className="pt-2 border-t">
                    <button
                      onClick={() => handleGenerateStatement(t)}
                      disabled={generatingId === t.id}
                      className="text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-60"
                    >
                      {generatingId === t.id ? 'Generating…' : 'Generate PDF'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* REMINDERS */}
      {subTab === 'reminders' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-sm">Overdue invoices</h3>
              <p className="text-xs text-slate-500 mt-1">
                Reminder severity auto-selected: Friendly / Firm / Final
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={reminderSearch}
                onChange={(e) => setReminderSearch(e.target.value)}
                placeholder="Search…"
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Invoice</th>
                  <th className="px-3 py-2.5">Tenant</th>
                  <th className="px-3 py-2.5">Due</th>
                  <th className="px-3 py-2.5 text-right">Days overdue</th>
                  <th className="px-3 py-2.5 text-right">Outstanding</th>
                  <th className="px-3 py-2.5">Suggested</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOverdue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No overdue invoices.
                    </td>
                  </tr>
                ) : (
                  filteredOverdue.map((inv) => {
                    const days = Math.floor(
                      (Date.now() - new Date(inv.due_date).getTime()) / 86400000
                    );
                    const type =
                      days > 30
                        ? 'Final Notice'
                        : days > 7
                        ? 'Firm'
                        : 'Friendly';
                    return (
                      <tr key={inv.id}>
                        <td className="px-3 py-3 font-mono font-bold">
                          {inv.invoice_number}
                        </td>
                        <td className="px-3 py-3">{inv.tenant_name}</td>
                        <td className="px-3 py-3 text-slate-500">
                          {inv.due_date}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-red-600">
                          {days}
                        </td>
                        <td className="px-3 py-3 text-right font-bold">
                          E{(inv.total - inv.amount_paid).toLocaleString()}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            {type}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={() => sendReminder.mutate(inv.id)}
                            className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 ml-auto"
                          >
                            <Send className="w-3 h-3" /> Send
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EXPENSES */}
      {subTab === 'expenses' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">Expense ledger</h3>
              <p className="text-xs text-slate-500 mt-1">
                All outgoing payments — maintenance, utilities, security, vendors
              </p>
            </div>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
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
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenseTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No expenses recorded.
                    </td>
                  </tr>
                ) : (
                  expenseTransactions.map((tx) => {
                    const center = centers.find((c) => c.id === tx.property_id);
                    return (
                      <tr key={tx.id}>
                        <td className="px-3 py-3 text-slate-500">{tx.date}</td>
                        <td className="px-3 py-3 font-mono text-blue-600">
                          {tx.reference || tx.id.slice(0, 8)}
                        </td>
                        <td className="px-3 py-3">{tx.description}</td>
                        <td className="px-3 py-3 text-slate-500">
                          {center?.name || '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-bold">
                          E{tx.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={() => {
                              if (confirm('Delete expense?'))
                                deleteExpense.mutate(tx.id);
                            }}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REQUISITIONS */}
      {subTab === 'requisitions' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">Requisitions &amp; petty cash</h3>
              <p className="text-xs text-slate-500 mt-1">
                Material requests and petty cash authorizations
              </p>
            </div>
            <button
              onClick={() => setShowRequisitionModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
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
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No requisitions.
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-3">{r.requested_by_name}</td>
                      <td className="px-3 py-3">{r.type}</td>
                      <td className="px-3 py-3 max-w-md">{r.purpose}</td>
                      <td className="px-3 py-3 text-right font-bold">
                        E{r.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {r.status === 'Pending Approval' && (
                          <button
                            onClick={() => approveRequest.mutate(r.id)}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold"
                          >
                            Approve
                          </button>
                        )}
                        {r.status === 'Approved' && (
                          <button
                            onClick={() => disburseRequest.mutate(r.id)}
                            className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold"
                          >
                            Disburse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showItemModal && (
        <ItemForm
          initial={editingItem}
          onCancel={() => {
            setShowItemModal(false);
            setEditingItem(null);
          }}
          onSubmit={(input) => {
            if (editingItem)
              updateItem.mutate({ id: editingItem.id, patch: input });
            else createItem.mutate(input as never);
          }}
        />
      )}

      {showExpenseModal && (
        <ExpenseForm
          centers={centers}
          onCancel={() => setShowExpenseModal(false)}
          onSubmit={(input) => createExpense.mutate(input)}
        />
      )}

      {showRequisitionModal && (
        <RequisitionForm
          onCancel={() => setShowRequisitionModal(false)}
          onSubmit={(input) => createRequest.mutate(input)}
        />
      )}
    </div>
  );
}

function ItemForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: InvoiceItem | null;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [code, setCode] = useState(initial?.code ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [unitPrice, setUnitPrice] = useState(initial?.unit_price ?? 0);
  const [taxRate, setTaxRate] = useState(initial?.tax_rate ?? 0.15);
  const [defaultQty, setDefaultQty] = useState(initial?.default_quantity ?? 1);
  const [category, setCategory] = useState(initial?.category ?? 'Other');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">
            {initial ? 'Edit item' : 'New billing item'}
          </h3>
          <button onClick={onCancel}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              code: code.trim() || undefined,
              name: name.trim(),
              description: description.trim() || undefined,
              unit_price: unitPrice,
              tax_rate: taxRate,
              default_quantity: defaultQty,
              category: category || undefined,
            });
          }}
          className="space-y-3 text-xs"
        >
          <input
            placeholder="Code (optional)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
          />
          <input
            required
            placeholder="Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
          <input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              type="number"
              placeholder="Unit price"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
            />
            <select
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              <option value={0}>0%</option>
              <option value={0.15}>15%</option>
              <option value={0.14}>14%</option>
            </select>
            <input
              type="number"
              placeholder="Default qty"
              value={defaultQty}
              onChange={(e) => setDefaultQty(Number(e.target.value) || 0)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          >
            <option>Rent</option>
            <option>Service Charge</option>
            <option>Utility</option>
            <option>Parking</option>
            <option>Signage</option>
            <option>Penalty</option>
            <option>Deposit</option>
            <option>Fitout</option>
            <option>Other</option>
          </select>
          <div className="pt-3 border-t flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {initial ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExpenseForm({
  centers,
  onCancel,
  onSubmit,
}: {
  centers: { id: string; name: string }[];
  onCancel: () => void;
  onSubmit: (input: {
    description: string;
    category: string;
    amount: number;
    shopping_center_id: string;
  }) => void;
}) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Maintenance');
  const [amount, setAmount] = useState(0);
  const [centerId, setCenterId] = useState(centers[0]?.id ?? '');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" /> Record expense
          </h3>
          <button onClick={onCancel}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              description,
              category,
              amount,
              shopping_center_id: centerId,
            });
          }}
          className="space-y-3 text-xs"
        >
          <input
            required
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              <option>Maintenance</option>
              <option>Utilities</option>
              <option>Security</option>
              <option>Other</option>
            </select>
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              {centers.length === 0 && <option value="">No centres</option>}
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="number"
            required
            placeholder="Amount (E)"
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
          />
          <div className="pt-3 border-t flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequisitionForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (input: {
    requested_by_name: string;
    type: string;
    amount: number;
    purpose: string;
  }) => void;
}) {
  const user = auth.getCurrentUser();
  const [requestedBy, setRequestedBy] = useState(user?.name ?? '');
  const [type, setType] = useState('Petty Cash');
  const [amount, setAmount] = useState(0);
  const [purpose, setPurpose] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">New requisition</h3>
          <button onClick={onCancel}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ requested_by_name: requestedBy, type, amount, purpose });
          }}
          className="space-y-3 text-xs"
        >
          <input
            required
            placeholder="Requested by"
            value={requestedBy}
            onChange={(e) => setRequestedBy(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          >
            <option>Petty Cash</option>
            <option>Purchase Request</option>
            <option>Maintenance Funding</option>
            <option>Vendor Payment</option>
          </select>
          <textarea
            required
            rows={2}
            placeholder="Purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
          <input
            type="number"
            required
            placeholder="Amount (E)"
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
          />
          <div className="pt-3 border-t flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
