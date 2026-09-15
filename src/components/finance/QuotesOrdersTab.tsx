import React, { useMemo, useState } from 'react';
import {
  FileText, PlusCircle, ShoppingCart, ArrowRight, X, Trash2, Search,
} from 'lucide-react';
import { auth } from '../../services/auth';
import {
  quotes as quotesApi,
  salesOrders as ordersApi,
  items as itemsApi,
} from '../../services/api/accounting';
import type { InvoiceItem } from '../../services/api/accounting';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { shops as shopsApi } from '../../services/api/shops';
import { generateQuotePdf } from '../../services/pdf';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { Tenant, Shop } from '../../types';

type SubTab = 'quotes' | 'orders';

export function QuotesOrdersTab() {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [subTab, setSubTab] = useState<SubTab>('quotes');
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [search, setSearch] = useState('');

  const { data: quotes = [] } = useSupabaseQuery(
    ['quotes', orgId],
    () => quotesApi.list(),
    { enabled: !!orgId }
  );
  const { data: orders = [] } = useSupabaseQuery(
    ['sales_orders', orgId],
    () => ordersApi.list(),
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
  const { data: catalog = [] } = useSupabaseQuery(
    ['invoice_items', orgId],
    () => itemsApi.active(),
    { enabled: !!orgId }
  );

  useRealtime({
    table: 'quotes',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['quotes'],
    enabled: !!orgId,
  });
  useRealtime({
    table: 'sales_orders',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['sales_orders'],
    enabled: !!orgId,
  });

  const createQuote = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof quotesApi.create>[0]) => quotesApi.create(input),
    invalidateKeys: ['quotes'],
    onSuccess: () => {
      setFeedback('Quote created.');
      setTimeout(() => setFeedback(''), 3000);
      setShowQuoteModal(false);
    },
  });

  const createOrder = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof ordersApi.create>[0]) => ordersApi.create(input),
    invalidateKeys: ['sales_orders'],
    onSuccess: () => {
      setFeedback('Order created.');
      setTimeout(() => setFeedback(''), 3000);
      setShowOrderModal(false);
    },
  });

  const convertQuote = useSupabaseMutation({
    mutationFn: (id: string) => quotesApi.convertToInvoice(id),
    invalidateKeys: ['quotes', 'invoices'],
    onSuccess: (inv) => {
      setFeedback(`Quote converted to ${inv.invoice_number}.`);
      setTimeout(() => setFeedback(''), 4000);
    },
  });

  const convertOrder = useSupabaseMutation({
    mutationFn: (id: string) => ordersApi.convertToInvoice(id),
    invalidateKeys: ['sales_orders', 'invoices'],
    onSuccess: (inv) => {
      setFeedback(`Order invoiced as ${inv.invoice_number}.`);
      setTimeout(() => setFeedback(''), 4000);
    },
  });

  const removeQuote = useSupabaseMutation({
    mutationFn: (id: string) => quotesApi.remove(id),
    invalidateKeys: ['quotes'],
    onSuccess: () => {
      setFeedback('Quote removed.');
      setTimeout(() => setFeedback(''), 3000);
    },
  });

  const filteredQuotes = useMemo(() => {
    if (!search) return quotes;
    const q = search.toLowerCase();
    return quotes.filter(
      (x) =>
        x.quote_number.toLowerCase().includes(q) ||
        (x.prospect_company ?? '').toLowerCase().includes(q) ||
        (x.prospect_name ?? '').toLowerCase().includes(q)
    );
  }, [quotes, search]);

  const filteredOrders = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (x) =>
        x.order_number.toLowerCase().includes(q) ||
        (x.salesperson_name ?? '').toLowerCase().includes(q)
    );
  }, [orders, search]);

  const handleQuotePdf = (quoteId: string) => {
    const org = auth.getCurrentOrganization();
    const quote = quotes.find((x) => x.id === quoteId);
    if (org && quote) generateQuotePdf(quote, org);
  };

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Quotes &amp; Sales Orders</h2>
          <p className="text-xs text-slate-500">
            Pre-billing documents that convert to invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-40"
            />
          </div>
          <button
            onClick={() => (subTab === 'quotes' ? setShowQuoteModal(true) : setShowOrderModal(true))}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" /> New {subTab === 'quotes' ? 'quote' : 'order'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
          {feedback}
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        <button
          onClick={() => setSubTab('quotes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
            subTab === 'quotes'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Quotes ({quotes.length})
        </button>
        <button
          onClick={() => setSubTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
            subTab === 'orders'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" /> Orders ({orders.length})
        </button>
      </div>

      {subTab === 'quotes' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Quote #</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Valid until</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No quotes yet.
                    </td>
                  </tr>
                ) : filteredQuotes.map((q) => {
                  const tenant = tenants.find((t) => t.id === q.tenant_id);
                  const clientLabel =
                    tenant?.business_name ||
                    q.prospect_company ||
                    q.prospect_name ||
                    '—';
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-mono font-bold">{q.quote_number}</td>
                      <td className="px-4 py-3 text-slate-500">{q.type}</td>
                      <td className="px-4 py-3">{clientLabel}</td>
                      <td className="px-4 py-3 text-slate-500">{q.issue_date}</td>
                      <td className="px-4 py-3 text-slate-500">{q.valid_until ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-bold">
                        E{q.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                          {q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleQuotePdf(q.id)}
                            className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:underline"
                          >
                            PDF
                          </button>
                          {q.status !== 'Converted' && q.tenant_id && (
                            <button
                              onClick={() => convertQuote.mutate(q.id)}
                              disabled={convertQuote.loading}
                              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-60"
                            >
                              Convert to invoice <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Delete quote ${q.quote_number}?`)) {
                                removeQuote.mutate(q.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
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
        </div>
      )}

      {subTab === 'orders' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Order date</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No orders yet.
                    </td>
                  </tr>
                ) : filteredOrders.map((o) => {
                  const tenant = tenants.find((t) => t.id === o.tenant_id);
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-mono font-bold">{o.order_number}</td>
                      <td className="px-4 py-3">{tenant?.business_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{o.order_date}</td>
                      <td className="px-4 py-3 text-slate-500">{o.due_date ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-bold">
                        E{o.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {o.status !== 'Invoiced' && o.status !== 'Cancelled' && (
                          <button
                            onClick={() => convertOrder.mutate(o.id)}
                            disabled={convertOrder.loading}
                            className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 ml-auto disabled:opacity-60"
                          >
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
        </div>
      )}

      {showQuoteModal && (
        <QuoteForm
          tenants={tenants}
          shops={shops}
          catalog={catalog}
          onCancel={() => setShowQuoteModal(false)}
          onSubmit={(input) => createQuote.mutate(input as never)}
        />
      )}

      {showOrderModal && (
        <OrderForm
          tenants={tenants}
          shops={shops}
          catalog={catalog}
          onCancel={() => setShowOrderModal(false)}
          onSubmit={(input) => createOrder.mutate(input as never)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quote creation modal
// ---------------------------------------------------------------------------

interface LineDraft {
  item_id?: string;
  description: string;
  quantity: number;
  unit_amount: number;
  tax_rate: number;
}

function QuoteForm({
  tenants,
  shops,
  catalog,
  onCancel,
  onSubmit,
}: {
  tenants: Tenant[];
  shops: Shop[];
  catalog: InvoiceItem[];
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [type, setType] = useState<'Lease Proposal' | 'Fitout Works' | 'Once-off Service' | 'Other'>('Lease Proposal');
  const [clientMode, setClientMode] = useState<'tenant' | 'prospect'>('tenant');
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? '');
  const [prospectCompany, setProspectCompany] = useState('');
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [shopId, setShopId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('This quotation is valid for 30 days from the issue date. Acceptance is confirmed by signature and payment of the deposit.');
  const [lines, setLines] = useState<LineDraft[]>([
    { description: '', quantity: 1, unit_amount: 0, tax_rate: 0.15 },
  ]);

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, unit_amount: 0, tax_rate: 0.15 }]);
  };
  const removeLine = (i: number) => {
    setLines(lines.filter((_, idx) => idx !== i));
  };
  const updateLine = (i: number, patch: Partial<LineDraft>) => {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const pickFromCatalog = (i: number, itemId: string) => {
    const item = catalog.find((c) => c.id === itemId);
    if (!item) return;
    updateLine(i, {
      item_id: item.id,
      description: item.description || item.name,
      unit_amount: item.unit_price,
      tax_rate: item.tax_rate,
      quantity: item.default_quantity,
    });
  };

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_amount, 0);
  const tax = lines.reduce((s, l) => s + l.quantity * l.unit_amount * l.tax_rate, 0);
  const total = subtotal + tax;

  const submit = (e: React.FormEvent) => {
    e
