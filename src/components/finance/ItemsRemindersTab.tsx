// src/components/finance/ItemsRemindersTab.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Package,
  Bell,
  PlusCircle,
  Send,
  Trash2,
  FileText,
  Search,
  Receipt,
  CreditCard,
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
import {
  daysBetween,
  selectOverdueInvoices,
  suggestedReminderType,
} from './calculators';
import type { Tenant } from '../../types';
import { Modal } from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/ToastProvider';

export type ItemsSubTab =
  | 'items'
  | 'statements'
  | 'reminders'
  | 'expenses'
  | 'requisitions';

interface Props {
  initialSubTab?: ItemsSubTab;
}

export function ItemsRemindersTab({ initialSubTab }: Props = {}) {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const toast = useToast();
  const { confirm } = useConfirm();

  const [subTab, setSubTab] = useState<ItemsSubTab>(initialSubTab ?? 'items');

  useEffect(() => {
    if (initialSubTab && initialSubTab !== subTab) setSubTab(initialSubTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSubTab]);

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
  useRealtime({
    table: 'invoices',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['invoices'],
    enabled: !!orgId,
  });

  const createItem = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof itemsApi.create>[0]) =>
      itemsApi.create(input),
    invalidateKeys: ['invoice_items'],
  });
  const updateItem = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<InvoiceItem> }) =>
      itemsApi.update(id, patch),
    invalidateKeys: ['invoice_items'],
  });
  const removeItem = useSupabaseMutation({
    mutationFn: (id: string) => itemsApi.remove(id),
    invalidateKeys: ['invoice_items'],
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
  });
  const deleteExpense = useSupabaseMutation({
    mutationFn: (id: string) => txApi.remove(id),
    invalidateKeys: ['finance_transactions'],
  });

  const createRequest = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof reqApi.create>[0]) =>
      reqApi.create(input),
    invalidateKeys: ['financial_requests'],
  });
  const approveRequest = useSupabaseMutation({
    mutationFn: (id: string) => reqApi.approve(id),
    invalidateKeys: ['financial_requests'],
  });
  const disburseRequest = useSupabaseMutation({
    mutationFn: (id: string) => reqApi.disburse(id),
    invalidateKeys: ['financial_requests', 'finance_transactions'],
  });

  const sendReminder = useSupabaseMutation({
    mutationFn: (invoiceId: string) => remindersApi.sendReminder(invoiceId),
    invalidateKeys: ['invoices', 'payment_reminders'],
  });

  const overdue = useMemo(
    () => selectOverdueInvoices(invoices),
    [invoices]
  );

  const filteredOverdue = useMemo(() => {
    if (!reminderSearch) return overdue;
    const q = reminderSearch.toLowerCase();
    return overdue.filter(
      (i) =>
        i.invoice_number.toLowerCase().includes(q) ||
        i.tenant_name.toLowerCase().includes(q)
    );
  }, [overdue, reminderSearch]);

  const expenseTransactions = useMemo(
    () => transactions.filter((t) => t.direction === 'expense'),
    [transactions]
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
      toast.success('Statement generated', `Ready for ${tenant.business_name}.`);
    } catch (e) {
      toast.error(
        'Statement failed',
        e instanceof Error ? e.message : 'Could not generate statement.'
      );
    } finally {
      setGeneratingId(null);
    }
  };

  const handleSendReminder = async (
    invoiceId: string,
    invoiceNumber: string
  ) => {
    try {
      await sendReminder.mutate(invoiceId);
      toast.success('Reminder logged', `Reminder recorded for ${invoiceNumber}.`);
    } catch (e) {
      toast.error(
        'Reminder failed',
        e instanceof Error ? e.message : 'Could not send reminder.'
      );
    }
  };

  const handleCreateItem = async (
    input: Parameters<typeof itemsApi.create>[0]
  ) => {
    try {
      await createItem.mutate(input);
      toast.success('Item created');
      setShowItemModal(false);
      setEditingItem(null);
    } catch (e) {
      toast.error(
        'Create failed',
        e instanceof Error ? e.message : 'Could not create item.'
      );
    }
  };

  const handleUpdateItem = async (
    id: string,
    patch: Partial<InvoiceItem>
  ) => {
    try {
      await updateItem.mutate({ id, patch });
      toast.success('Item updated');
      setShowItemModal(false);
      setEditingItem(null);
    } catch (e) {
      toast.error(
        'Update failed',
        e instanceof Error ? e.message : 'Could not update item.'
      );
    }
  };

  const handleRemoveItem = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Delete "${name}"?`,
      message: 'This billing item will no longer be available for quotes and invoices.',
      confirmLabel: 'Delete item',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await removeItem.mutate(id);
      toast.success('Item removed');
    } catch (e) {
      toast.error(
        'Remove failed',
        e instanceof Error ? e.message : 'Could not remove item.'
      );
    }
  };

  const handleCreateExpense = async (input: {
    description: string;
    category: string;
    amount: number;
    shopping_center_id: string;
  }) => {
    try {
      await createExpense.mutate(input);
      toast.success('Expense recorded');
      setShowExpenseModal(false);
    } catch (e) {
      toast.error(
        'Expense failed',
        e instanceof Error ? e.message : 'Could not record expense.'
      );
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const ok = await confirm({
      title: 'Delete this expense?',
      message: 'It will be removed from the ledger immediately.',
      confirmLabel: 'Delete expense',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteExpense.mutate(id);
      toast.success('Expense removed');
    } catch (e) {
      toast.error(
        'Remove failed',
        e instanceof Error ? e.message : 'Could not remove expense.'
      );
    }
  };

  const handleApproveRequest = async (id: string) => {
    try {
      await approveRequest.mutate(id);
      toast.success('Requisition approved');
    } catch (e) {
      toast.error(
        'Approve failed',
        e instanceof Error ? e.message : 'Could not approve.'
      );
    }
  };

  const handleDisburseRequest = async (id: string) => {
    try {
      await disburseRequest.mutate(id);
      toast.success('Requisition disbursed');
    } catch (e) {
      toast.error(
        'Disburse failed',
        e instanceof Error ? e.message : 'Could not disburse.'
      );
    }
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
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 flex-wrap">
        {(
          [
            { id: 'items', label: `Items catalog (${catalog.length})`, icon: Package },
            { id: 'statements', label: 'Statements', icon: FileText },
            { id: 'reminders', label: `Overdue (${overdue.length})`, icon: Bell },
            { id: 'expenses', label: `Expenses (${expenseTransactions.length})`, icon: Receipt },
            { id: 'requisitions', label: `Requisitions (${requests.length})`, icon: CreditCard },
          ] as {
            id: ItemsSubTab;
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
              type="button"
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
              type="button"
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
                      <td className="px-3 py-3 text-right font-bold">E{it.unit_price.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right">{(it.tax_rate * 100).toFixed(0)}%</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => { setEditingItem(it); setShowItemModal(true); }}
                          className="text-[11px] font-semibold text-blue-600 hover:underline mr-3"
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveItem(it.id, it.name)}
                          disabled={removeItem.loading}
                          className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-60"
                          type="button"
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
                  <div className="text-[11px] text-slate-500">{t.contact_person}</div>
                  <div className="pt-2 border-t">
                    <button
                      onClick={() => handleGenerateStatement(t)}
                      disabled={generatingId === t.id}
                      className="text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-60"
                      type="button"
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
                    const days = daysBetween(
                      inv.due_date,
                      new Date().toISOString().slice(0, 10)
                    );
                    const type = suggestedReminderType(days);
                    return (
                      <tr key={inv.id}>
                        <td className="px-3 py-3 font-mono font-bold">{inv.invoice_number}</td>
                        <td className="px-3 py-3">{inv.tenant_name}</td>
                        <td className="px-3 py-3 text-slate-500">{inv.due_date}</td>
                        <td className="px-3 py-3 text-right font-bold text-red-600">{days}</td>
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
                            onClick={() => handleSendReminder(inv.id, inv.invoice_number)}
                            disabled={sendReminder.loading}
                            className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 ml-auto disabled:opacity-60"
                            type="button"
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
              disabled={centers.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              type="button"
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
                        <td className="px-3 py-3 text-slate-500">{center?.name || '—'}</td>
                        <td className="px-3 py-3 text-right font-bold">
                          E{tx.amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={() => handleDeleteExpense(tx.id)}
                            disabled={deleteExpense.loading}
                            className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-60"
                            type="button"
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
              <h3 className="font-bold text-sm">
                Requisitions &amp; petty cash
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Material requests and petty cash authorizations
              </p>
            </div>
            <button
              onClick={() => setShowRequisitionModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              type="button"
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
                            onClick={() => handleApproveRequest(r.id)}
                            disabled={approveRequest.loading}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold disabled:opacity-60"
                            type="button"
                          >
                            Approve
                          </button>
                        )}
                        {r.status === 'Approved' && (
                          <button
                            onClick={() => handleDisburseRequest(r.id)}
                            disabled={disburseRequest.loading}
                            className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold disabled:opacity-60"
                            type="button"
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
      <ItemForm
        open={showItemModal}
        initial={editingItem}
        busy={createItem.loading || updateItem.loading}
        onCancel={() => {
          setShowItemModal(false);
          setEditingItem(null);
        }}
        onSubmit={(input) => {
          if (editingItem) {
            handleUpdateItem(editingItem.id, input as Partial<InvoiceItem>);
          } else {
            handleCreateItem(input as Parameters<typeof itemsApi.create>[0]);
          }
        }}
      />

      <ExpenseForm
        open={showExpenseModal}
        centers={centers}
        busy={createExpense.loading}
        onCancel={() => setShowExpenseModal(false)}
        onSubmit={handleCreateExpense}
      />

      <RequisitionForm
        open={showRequisitionModal}
        busy={createRequest.loading}
        onCancel={() => setShowRequisitionModal(false)}
        onSubmit={async (input) => {
          try {
            await createRequest.mutate(input);
            toast.success('Requisition submitted');
            setShowRequisitionModal(false);
          } catch (e) {
            toast.error(
              'Submit failed',
              e instanceof Error ? e.message : 'Could not submit.'
            );
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modals — all use the shared <Modal> primitive
// ---------------------------------------------------------------------------

function ItemForm({
  open,
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  initial: InvoiceItem | null;
  busy: boolean;
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

  // Reset when reopened with a different `initial`.
  useEffect(() => {
    if (!open) return;
    setCode(initial?.code ?? '');
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setUnitPrice(initial?.unit_price ?? 0);
    setTaxRate(initial?.tax_rate ?? 0.15);
    setDefaultQty(initial?.default_quantity ?? 1);
    setCategory(initial?.category ?? 'Other');
  }, [open, initial?.id]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={initial ? 'Edit item' : 'New billing item'}
      size="sm"
    >
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
            disabled={busy}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-60"
          >
            {busy ? 'Saving…' : initial ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ExpenseForm({
  open,
  centers,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  centers: { id: string; name: string }[];
  busy: boolean;
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

  useEffect(() => {
    if (!open) return;
    setDescription('');
    setCategory('Maintenance');
    setAmount(0);
    setCenterId(centers[0]?.id ?? '');
  }, [open, centers]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Record expense"
      icon={<Receipt className="w-5 h-5 text-blue-600" />}
      size="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ description, category, amount, shopping_center_id: centerId });
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
              <option key={c.id} value={c.id}>{c.name}</option>
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
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RequisitionForm({
  open,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
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

  useEffect(() => {
    if (!open) return;
    setRequestedBy(user?.name ?? '');
    setType('Petty Cash');
    setAmount(0);
    setPurpose('');
  }, [open, user?.name]);

  return (
    <Modal open={open} onClose={onCancel} title="New requisition" size="sm">
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
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-60"
          >
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
