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
import { shops as shopsApi } from '../../services/api/shops';
import { shoppingCenters as centersApi } from '../../services/api/shoppingCenters';
import { invoices as invoiceApi, payments as paymentsApi } from '../../services/api/invoices';
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
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
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
    mutationFn: (input: Parameters<typeof itemsApi.create>[0]) => itemsApi.create(input),
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
    mutationFn: (input: Parameters<typeof reqApi.create>[0]) => reqApi.create(input),
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

  const expenseTransactions = transactions.filter((t) => t.direction === 'expense');

  const handleGenerateStatement = async (tenant: Tenant) => {
    const org = auth.getCurrentOrganization();
    if (!org) return;
    setGeneratingId(tenant.id);
    try {
      const statement = await statementsApi.generate(tenant.id, periodStart, periodEnd);
      const payments = await paymentsApi.listForTenant(tenant.id, periodStart, periodEnd);
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

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
          {feedback}
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 flex-wrap">
        {([
          { id: 'items', label: `Items catalog (${catalog.length})`, icon: Package },
          { id: 'statements', label: 'Statements', icon: FileText },
          { id: 'reminders', label: `Overdue (${overdue.length})`, icon: Bell },
          { id: 'expenses', label: `Expenses (${expenseTransactions.length})`, icon: Receipt },
          { id: 'requisitions', label: `Requisitions (${requests.length})`, icon: CreditCard },
        ] as { id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(
          (t) => {
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
          }
        )}
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
                      <td className="px-3 py-3 text-slate-500">{it.category ?? '—'}</td>
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
                            if (confirm(`Delete "${it.name}"?`)) removeItem.mutate(it.id);
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
                className="px-3 py-1.5
