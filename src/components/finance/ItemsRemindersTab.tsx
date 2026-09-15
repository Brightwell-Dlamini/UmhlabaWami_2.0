import React, { useState } from 'react';
import {
  Package, Bell, PlusCircle, Send, X, Trash2, FileText, Search,
} from 'lucide-react';
import { auth } from '../../services/auth';
import {
  items as itemsApi,
  reminders as remindersApi,
  statements as statementsApi,
} from '../../services/api/accounting';
import type { InvoiceItem } from '../../services/api/accounting';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { invoices as invoiceApi, payments as paymentsApi } from '../../services/api/invoices';
import { generateStatementPdf } from '../../services/pdf';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { Tenant } from '../../types';

type SubTab = 'items' | 'statements' | 'reminders';

export function ItemsRemindersTab() {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [subTab, setSubTab] = useState<SubTab>('items');
  const [feedback, setFeedback] = useState('');

  // Statement generation controls
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Reminder search
  const [reminderSearch, setReminderSearch] = useState('');

  // Item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null);

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

  useRealtime({
    table: 'invoice_items',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['invoice_items'],
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

  const sendReminder = useSupabaseMutation({
    mutationFn: (invoiceId: string) => remindersApi.sendReminder(invoiceId),
    onSuccess: () => {
      setFeedback('Reminder logged and marked as sent.');
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
      console.error('Statement generation failed', e);
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
        <button
          onClick={() => setSubTab('items')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
            subTab === 'items'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" /> Items catalog ({catalog.length})
        </button>
        <button
          onClick={() => setSubTab('statements')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
            subTab === 'statements'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Statements
        </button>
        <button
          onClick={() => setSubTab('reminders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
            subTab === 'reminders'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bell className="w-3.5 h-3.5" /> Overdue ({overdue.length})
        </button>
      </div>

      {/* ITEMS CATALOG */}
      {subTab === 'items' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">Reusable billing items</h3>
              <p className="text-xs text-slate-500">
                Save standard rates so quotes and invoices are consistent and fast to build.
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
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {catalog.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No items yet. Add your first billing item.
                    </td>
                  </tr>
                ) : catalog.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                    <td className="px-3 py-3 font-mono">{it.code ?? '—'}</td>
                    <td className="px-3 py-3">
                      <div className="font-bold">{it.name}</div>
                      {it.description && (
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">
                          {it.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-500">{it.category ?? '—'}</td>
                    <td className="px-3 py-3 text-right font-bold">
                      E{it.unit_price.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {(it.tax_rate * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          it.is_active
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {it.is_active ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingItem(it);
                            setShowItemModal(true);
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            updateItem.mutate({
                              id: it.id,
                              patch: { is_active: !it.is_active },
                            })
                          }
                          className="text-[11px] font-semibold text-slate-500 hover:underline"
                        >
                          {it.is_active ? 'Archive' : 'Restore'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${it.name}"?`)) removeItem.mutate(it.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-500"
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
      )}

      {/* STATEMENTS */}
      {subTab === 'statements' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm">Statements of account</h3>
            <p className="text-xs text-slate-500 mt-1">
              Generate a per-tenant statement showing opening balance, invoices issued,
              payments received, and closing balance for the selected period.
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
            ) : tenants.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-2"
              >
                <div className="font-bold text-xs">{t.business_name}</div>
                <div className="text-[11px] text-slate-500">{t.contact_person}</div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => handleGenerateStatement(t)}
                    disabled={generatingId === t.id}
                    className="text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-60"
                  >
                    {generatingId === t.id ? 'Generating…' : 'Generate PDF'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REMINDERS */}
      {subTab === 'reminders' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-sm">Overdue invoices &amp; payment reminders</h3>
              <p className="text-xs text-slate-500 mt-1">
                Reminder severity is auto-selected by days overdue (Friendly / Firm / Final).
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={reminderSearch}
                onChange={(e) => setReminderSearch(e.target.value)}
                placeholder="Search invoice or tenant…"
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
                  <th className="px-3 py-2.5">Due date</th>
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
                ) : filteredOverdue.map((inv) => {
                  const days = Math.floor(
                    (Date.now() - new Date(inv.due_date).getTime()) / 86400000
                  );
                  const type =
                    days > 30 ? 'Final Notice' : days > 7 ? 'Firm' : 'Friendly';
                  const typeClass =
                    type === 'Final Notice'
                      ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                      : type === 'Firm'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                      <td className="px-3 py-3 font-mono font-bold">
                        {inv.invoice_number}
                      </td>
                      <td className="px-3 py-3">{inv.tenant_name}</td>
                      <td className="px-3 py-3 text-slate-500">{inv.due_date}</td>
                      <td className="px-3 py-3 text-right font-bold text-red-600">
                        {days}
                      </td>
                      <td className="px-3 py-3 text-right font-bold">
                        E{(inv.total - inv.amount_paid).toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeClass}`}
                        >
                          {type}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => sendReminder.mutate(inv.id)}
                          disabled={sendReminder.loading}
                          className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 ml-auto disabled:opacity-60"
                        >
                          <Send className="w-3 h-3" /> Send reminder
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

      {showItemModal && (
        <ItemForm
          initial={editingItem}
          onCancel={() => {
            setShowItemModal(false);
            setEditingItem(null);
          }}
          onSubmit={(input) => {
            if (editingItem) {
              updateItem.mutate({ id: editingItem.id, patch: input });
            } else {
              createItem.mutate(input as never);
            }
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item create / edit modal
// ---------------------------------------------------------------------------

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
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            {initial ? 'Edit item' : 'New billing item'}
          </h3>
          <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
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
              is_active: isActive,
            });
          }}
          className="space-y-3 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. RENT-M"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                <option value="Rent">Rent</option>
                <option value="Service Charge">Service Charge</option>
                <option value="Utility">Utility</option>
                <option value="Parking">Parking</option>
                <option value="Signage">Signage</option>
                <option value="Penalty">Penalty / Late Fee</option>
                <option value="Deposit">Deposit</option>
                <option value="Fitout">Fitout &amp; Works</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly commercial rent"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Description (appears on documents)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Monthly commercial rental — per unit"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Unit price (E)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tax rate</label>
              <select
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                <option value={0}>0%</option>
                <option value={0.15}>15%</option>
                <option value={0.14}>14%</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Default qty</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={defaultQty}
                onChange={(e) => setDefaultQty(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>Active (available in quote &amp; invoice pickers)</span>
          </label>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
            >
              {initial ? 'Save changes' : 'Create item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
