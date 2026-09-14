import React, { useState } from 'react';
import { FileText, PlusCircle, ShoppingCart, ArrowRight } from 'lucide-react';
import { auth } from '../../services/auth';
import { quotes as quotesApi, salesOrders as ordersApi } from '../../services/api/accounting';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { items as itemsApi } from '../../services/api/accounting';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';

export function QuotesOrdersTab() {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [subTab, setSubTab] = useState<'quotes' | 'orders'>('quotes');

  const { data: quotes = [] } = useSupabaseQuery(['quotes', orgId], () => quotesApi.list(), { enabled: !!orgId });
  const { data: orders = [] } = useSupabaseQuery(['sales_orders', orgId], () => ordersApi.list(), { enabled: !!orgId });
  const { data: tenants = [] } = useSupabaseQuery(['tenants', orgId], () => tenantsApi.list(), { enabled: !!orgId });
  const { data: catalog = [] } = useSupabaseQuery(['invoice_items', orgId], () => itemsApi.active(), { enabled: !!orgId });

  const convertQuote = useSupabaseMutation({
    mutationFn: (id: string) => quotesApi.convertToInvoice(id),
    invalidateKeys: ['quotes', 'invoices'],
  });
  const convertOrder = useSupabaseMutation({
    mutationFn: (id: string) => ordersApi.convertToInvoice(id),
    invalidateKeys: ['sales_orders', 'invoices'],
  });

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Quotes & Sales Orders</h2>
          <p className="text-xs text-slate-500">Pre-billing documents that convert to invoices</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
          <PlusCircle className="w-4 h-4" /> New {subTab === 'quotes' ? 'quote' : 'order'}
        </button>
      </div>

      <div className="flex items-center gap-2 border-b pb-2">
        <button onClick={() => setSubTab('quotes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${subTab === 'quotes' ? 'bg-blue-600 text-white' : ''}`}>
          <FileText className="w-3.5 h-3.5 inline mr-1" /> Quotes ({quotes.length})
        </button>
        <button onClick={() => setSubTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${subTab === 'orders' ? 'bg-blue-600 text-white' : ''}`}>
          <ShoppingCart className="w-3.5 h-3.5 inline mr-1" /> Orders ({orders.length})
        </button>
      </div>

      {subTab === 'quotes' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Quote #</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Valid until</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotes.map((q) => {
                const tenant = tenants.find((t) => t.id === q.tenant_id);
                return (
                  <tr key={q.id}>
                    <td className="px-4 py-3 font-mono font-bold">{q.quote_number}</td>
                    <td className="px-4 py-3">{tenant?.business_name ?? q.prospect_company ?? q.prospect_name ?? '—'}</td>
                    <td className="px-4 py-3">{q.issue_date}</td>
                    <td className="px-4 py-3">{q.valid_until ?? '—'}</td>
                    <td className="px-4 py-3 font-bold">E{q.total.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                        {q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {q.status !== 'Converted' && q.tenant_id && (
                        <button onClick={() => convertQuote.mutate(q.id)}
                          className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 ml-auto">
                          Convert to invoice <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'orders' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => {
                const tenant = tenants.find((t) => t.id === o.tenant_id);
                return (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-mono font-bold">{o.order_number}</td>
                    <td className="px-4 py-3">{tenant?.business_name ?? '—'}</td>
                    <td className="px-4 py-3">{o.order_date}</td>
                    <td className="px-4 py-3 font-bold">E{o.total.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {o.status !== 'Invoiced' && o.status !== 'Cancelled' && (
                        <button onClick={() => convertOrder.mutate(o.id)}
                          className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 ml-auto">
                          Invoice order <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
