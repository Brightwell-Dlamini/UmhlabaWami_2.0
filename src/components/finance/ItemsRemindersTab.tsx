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
import { useInvoiceStatusSync } from '../../hooks/useInvoiceStatusSync';
import {
  daysBetween,
  selectOverdueInvoices,
  suggestedReminderType,
} from './calculators';
import type { Tenant } from '../../types';
import { ItemForm } from './ItemForm';
import { ExpenseForm } from './ExpenseForm';
import { RequisitionForm } from './RequisitionForm';
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

  useInvoiceStatusSync({ orgId });

  useRealtime({
    table: 'invoice_items',
    filter: orgId ? `organization_id=eq.${orgId}` : undefined,
    invalidateKeys: ['invoice_items'],
    enabled: !!orgId,
  });
  useRealtime({
    table: 'finance_transactions',
    filter: orgId ? `organization_id=eq.${orgId}` : undefined,
    invalidateKeys: ['finance_transactions'],
    enabled: !!orgId,
  });
  useRealtime({
    table: 'financial_requests',
    filter: orgId ? `organization_id=eq.${orgId}` : undefined,
    invalidateKeys: ['financial_requests'],
    enabled: !!orgId,
  });
  useRealtime({
    table: 'invoices',
    filter: orgId ? `organization_id=eq.${orgId}` : undefined,
    invalidateKeys: ['invoices'],
    enabled: !!orgId,
  });

  const createItem = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof itemsApi.create>[0]) => itemsApi.create(input),
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
    mutationFn: (input: Parameters<typeof reqApi.create>[0]) => reqApi.create(input),
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

  const overdue = useMemo(() => selectOverdueInvoices(invoices), [invoices]);
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
      const statement = await statementsApi.generate(tenant.id, periodStart, periodEnd);
      const payments = await paymentsApi.listForTenant(tenant.id, periodStart, periodEnd);
      generateStatementPdf(statement, tenant, invoices, payments, org);
      toast.success('Statement generated', `Ready for ${tenant.business_name}.`);
    } catch (e) {
      toast.error('Statement failed', e instanceof Error ? e.message : 'Could not generate statement.');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleSendReminder = async (invoiceId: string, invoiceNumber: string) => {
    try {
      await sendReminder.mutate(invoiceId);
      // Also push in-app notification when possible
      try {
        await invoiceApi.sendReminders([invoiceId]);
      } catch {
        /* optional */
      }
      toast.success('Reminder sent', `Tenant notified for ${invoiceNumber}.`);
    } catch (e) {
      toast.error('Reminder failed', e instanceof Error ? e.message : 'Could not send reminder.');
    }
  };

  const handleCreateItem = async (input: Parameters<typeof itemsApi.create>[0]) => {
    try {
      await createItem.mutate(input);
      toast.success('Item created');
      setShowItemModal(false);
      setEditingItem(null);
    } catch (e) {
      toast.error('Create failed', e instanceof Error ? e.message : 'Could not create item.');
    }
  };

  const handleUpdateItem = async (id: string, patch: Partial<InvoiceItem>) => {
    try {
      await updateItem.mutate({ id, patch });
      toast.success('Item updated');
      setShowItemModal(false);
      setEditingItem(null);
    } catch (e) {
      toast.error('Update failed', e instanceof Error ? e.message : 'Could not update item.');
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
      toast.error('Remove failed', e instanceof Error ? e.message : 'Could not remove item.');
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
      toast.error('Expense failed', e instanceof Error ? e.message : 'Could not record expense.');
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
      toast.error('Remove failed', e instanceof Error ? e.message : 'Could not remove expense.');
    }
  };

  if (!orgId) {
    return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 flex-wrap">
        {(
          [
            { id: 'items' as const, label: `Items catalog (${catalog.length})`, icon: Package },
            { id: 'statements' as const, label: 'Statements', icon: FileText },
            { id: 'reminders' as const, label: `Overdue (${overdue.length})`, icon: Bell },
            { id: 'expenses' as const, label: `Expenses (${expenseTransactions.length})`, icon: Receipt },
            { id: 'requisitions' as const, label: `Requisitions (${requests.length})`, icon: CreditCard },
          ]
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
                      No items yet. Click New item to add one.
                    </td>
                  </tr>
                ) : (
                  catalog.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-3 font-mono">{it.code ?? '—'}</td>
                      <td className="px-3 py-3 font-bold">{it.name}</td>
                      <td className="px-3 py-3 text-slate-500">{it.category ?? '—'}</td>
                      <td className="px-3 py-3 text-right font-bold">
                        E{Number(it.unit_price).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-3 text-right">{(Number(it.tax_rate) * 100).toFixed(0)}%</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => {
                            setEditingItem(it);
                            setShowItemModal(true);
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:underline mr-3"
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void handleRemoveItem(it.id, it.name)}
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

      {subTab === 'statements' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5 space-y-4">
          <h3 className="font-bold text-sm">Statements of account</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2">
              <span className="text-slate-500">From</span>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                className="px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-900" />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-slate-500">To</span>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                className="px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-900" />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tenants.map((t) => (
              <div key={t.id} className="p-4 rounded-xl border space-y-2">
                <div className="font-bold text-xs">{t.business_name}</div>
                <button
                  onClick={() => void handleGenerateStatement(t)}
                  disabled={generatingId === t.id}
                  className="text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-60"
                  type="button"
                >
                  {generatingId === t.id ? 'Generating…' : 'Generate PDF'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'reminders' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-sm">Overdue invoices</h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={reminderSearch}
                onChange={(e) => setReminderSearch(e.target.value)}
                placeholder="Search tenant or invoice…"
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border bg-slate-50 dark:bg-slate-900"
              />
            </div>
          </div>
          {filteredOverdue.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No overdue invoices.</p>
          ) : (
            <div className="divide-y">
              {filteredOverdue.map((inv) => {
                const days = daysBetween(inv.due_date, new Date().toISOString().slice(0, 10));
                return (
                  <div key={inv.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-mono font-bold">{inv.invoice_number}</div>
                      <div className="text-slate-500">{inv.tenant_name} · {days}d overdue · {suggestedReminderType(days)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSendReminder(inv.id, inv.invoice_number)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" /> Remind
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'expenses' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Expenses</h3>
            <button
              type="button"
              onClick={() => setShowExpenseModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add expense
            </button>
          </div>
          {expenseTransactions.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No expenses yet.</p>
          ) : (
            <div className="divide-y text-xs">
              {expenseTransactions.map((t) => (
                <div key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{t.description}</div>
                    <div className="text-slate-500">{t.date} · {t.category}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-red-600">
                      E{Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <button type="button" onClick={() => void handleDeleteExpense(t.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'requisitions' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Requisitions</h3>
            <button
              type="button"
              onClick={() => setShowRequisitionModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> New requisition
            </button>
          </div>
          {requests.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No requisitions yet.</p>
          ) : (
            <div className="divide-y text-xs">
              {requests.map((r) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{r.purpose ?? r.type}</div>
                    <div className="text-slate-500">
                      {r.requested_by_name} · {r.status} · E{Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {r.status === 'Pending' && (
                      <button type="button" onClick={() => void approveRequest.mutate(r.id)} className="text-emerald-600 font-semibold">
                        Approve
                      </button>
                    )}
                    {r.status === 'Approved' && (
                      <button type="button" onClick={() => void disburseRequest.mutate(r.id)} className="text-blue-600 font-semibold">
                        Disburse
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            void handleUpdateItem(editingItem.id, input as Partial<InvoiceItem>);
          } else {
            void handleCreateItem(input as Parameters<typeof itemsApi.create>[0]);
          }
        }}
      />

      <ExpenseForm
        open={showExpenseModal}
        centers={centers}
        busy={createExpense.loading}
        onCancel={() => setShowExpenseModal(false)}
        onSubmit={(input) => void handleCreateExpense(input)}
      />

      <RequisitionForm
        open={showRequisitionModal}
        busy={createRequest.loading}
        onCancel={() => setShowRequisitionModal(false)}
        onSubmit={async (input) => {
          try {
            await createRequest.mutate(input as never);
            toast.success('Requisition submitted');
            setShowRequisitionModal(false);
          } catch (e) {
            toast.error('Submit failed', e instanceof Error ? e.message : 'Could not submit.');
          }
        }}
      />
    </div>
  );
}
