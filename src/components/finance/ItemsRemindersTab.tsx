import React, { useState } from 'react';
import { Package, Bell, PlusCircle, Send } from 'lucide-react';
import { auth } from '../../services/auth';
import { items as itemsApi, reminders as remindersApi, statements as statementsApi } from '../../services/api/accounting';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { invoices as invoiceApi } from '../../services/api/invoices';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';

export function ItemsRemindersTab() {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [subTab, setSubTab] = useState<'items' | 'statements' | 'reminders'>('items');

  const { data: catalog = [] } = useSupabaseQuery(['invoice_items', orgId], () => itemsApi.list(), { enabled: !!orgId });
  const { data: tenants = [] } = useSupabaseQuery(['tenants', orgId], () => tenantsApi.list(), { enabled: !!orgId });
  const { data: invoices = [] } = useSupabaseQuery(['invoices', orgId], () => invoiceApi.list(), { enabled: !!orgId });

  const createItem = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof itemsApi.create>[0]) => itemsApi.create(input),
    invalidateKeys: ['invoice_items'],
  });

  const overdue = invoices.filter((i) =>
    i.status !== 'Paid' && i.status !== 'Cancelled' &&
    new Date(i.due_date) < new Date()
  );

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b pb-2">
        {[
          { id: 'items', label: 'Items catalog', icon: Package },
          { id: 'statements', label: 'Statements', icon: null },
          { id: 'reminders', label: `Overdue (${overdue.length})`, icon: Bell },
        ].map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id as typeof subTab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              subTab === t.id ? 'bg-blue-600 text-white' : ''
            }`}>
            {t.icon && <t.icon className="w-3.5 h-3.5" />}
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'items' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm">Reusable billing items</h3>
            <button className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
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
                  <th className="px-3 py-2.5">Unit price</th>
                  <th className="px-3 py-2.5">Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {catalog.map((it) => (
                  <tr key={it.id}>
                    <td className="px-3 py-3 font-mono">{it.code ?? '—'}</td>
                    <td className="px-3 py-3">{it.name}</td>
                    <td className="px-3 py-3">{it.category ?? '—'}</td>
                    <td className="px-3 py-3 font-bold">E{it.unit_price.toLocaleString()}</td>
                    <td className="px-3 py-3">{(it.tax_rate * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'statements' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5 space-y-4">
          <h3 className="font-bold text-sm">Statements of account</h3>
          <p className="text-xs text-slate-500">
            Generate a per-tenant statement showing opening balance, invoices issued, payments received, and closing balance.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tenants.map((t) => (
              <div key={t.id} className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-900/50">
                <div className="font-bold text-xs">{t.business_name}</div>
                <div className="text-[11px] text-slate-500">{t.contact_person}</div>
                <button className="mt-3 text-[11px] font-semibold text-blue-600 hover:underline">
                  Generate statement →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'reminders' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5">
          <h3 className="font-bold text-sm mb-4">Overdue invoices & payment reminders</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Invoice</th>
                  <th className="px-3 py-2.5">Tenant</th>
                  <th className="px-3 py-2.5">Due</th>
                  <th className="px-3 py-2.5">Days overdue</th>
                  <th className="px-3 py-2.5">Outstanding</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {overdue.map((inv) => {
                  const days = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000);
                  return (
                    <tr key={inv.id}>
                      <td className="px-3 py-3 font-mono font-bold">{inv.invoice_number}</td>
                      <td className="px-3 py-3">{inv.tenant_name}</td>
                      <td className="px-3 py-3">{inv.due_date}</td>
                      <td className="px-3 py-3 font-bold text-red-600">{days}</td>
                      <td className="px-3 py-3 font-bold">E{(inv.total - inv.amount_paid).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => remindersApi.sendReminder(inv.id)}
                          className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 ml-auto">
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
    </div>
  );
}
