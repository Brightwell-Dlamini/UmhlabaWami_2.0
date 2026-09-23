import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText, PlusCircle, ShoppingCart, ArrowRight, Trash2, Search,
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
import { Modal } from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/ToastProvider';
import { EmptyState } from '../ui/EmptyState';

type SubTab = 'quotes' | 'orders';

const QUOTE_TEMPLATES: {
  id: string;
  name: string;
  lines: { description: string; quantity: number; unit_amount: number }[];
}[] = [
  {
    id: 'shopfitting',
    name: 'Shop fitting / fit-out',
    lines: [
      { description: 'Design & layout consultation', quantity: 1, unit_amount: 2500 },
      { description: 'Partitioning and joinery', quantity: 1, unit_amount: 15000 },
      { description: 'Electrical rough-in', quantity: 1, unit_amount: 4500 },
    ],
  },
  {
    id: 'signage',
    name: 'Signage package',
    lines: [
      { description: 'Fascia signage (illuminated)', quantity: 1, unit_amount: 8000 },
      { description: 'Window vinyl graphics', quantity: 1, unit_amount: 2200 },
      { description: 'Installation labour', quantity: 1, unit_amount: 1500 },
    ],
  },
  {
    id: 'maintenance',
    name: 'Annual maintenance retainer',
    lines: [
      { description: 'Preventive maintenance (12 months)', quantity: 1, unit_amount: 12000 },
      { description: 'Call-out allowance (up to 4 visits)', quantity: 1, unit_amount: 3000 },
    ],
  },
  {
    id: 'blank',
    name: 'Blank quote',
    lines: [{ description: '', quantity: 1, unit_amount: 0 }],
  },
];

export function QuotesOrdersTab() {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const toast = useToast();
  const { confirm } = useConfirm();

  const [subTab, setSubTab] = useState<SubTab>('quotes');
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
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
      toast.success('Quote created');
      setShowQuoteModal(false);
    },
  });

  const createOrder = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof ordersApi.create>[0]) => ordersApi.create(input),
    invalidateKeys: ['sales_orders'],
    onSuccess: () => {
      toast.success('Order created');
      setShowOrderModal(false);
    },
  });

  const convertQuote = useSupabaseMutation({
    mutationFn: (id: string) => quotesApi.convertToInvoice(id),
    invalidateKeys: ['quotes', 'invoices'],
    onSuccess: (inv) => {
      toast.success('Quote converted', `Invoice ${inv.invoice_number}`);
    },
  });

  const convertOrder = useSupabaseMutation({
    mutationFn: (id: string) => ordersApi.convertToInvoice(id),
    invalidateKeys: ['sales_orders', 'invoices'],
    onSuccess: (inv) => {
      toast.success('Order invoiced', `Invoice ${inv.invoice_number}`);
    },
  });

  const removeQuote = useSupabaseMutation({
    mutationFn: (id: string) => quotesApi.remove(id),
    invalidateKeys: ['quotes'],
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

  const handleQuotePdf = (quoteId: string, open = false) => {
    const org = auth.getCurrentOrganization();
    const quote = quotes.find((x) => x.id === quoteId);
    if (org && quote) void generateQuotePdf(quote, org, { open });
  };

  const handleDeleteQuote = async (quoteId: string, quoteNumber: string) => {
    const ok = await confirm({
      title: `Delete quote ${quoteNumber}?`,
      message: 'The quote and its line items will be removed.',
      confirmLabel: 'Delete quote',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await removeQuote.mutate(quoteId);
      toast.success('Quote removed');
    } catch (e) {
      toast.error(
        'Delete failed',
        e instanceof Error ? e.message : 'Could not remove quote.'
      );
    }
  };

  if (!orgId) {
    return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Quotes & Sales Orders</h2>
          <p className="text-xs text-slate-500">Pre-billing documents that convert to invoices</p>
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
                    <td colSpan={8}>
                      <EmptyState
                        icon={<FileText className="w-5 h-5" />}
                        title="No quotes yet"
                        message="Create a quote to send proposals to prospects or tenants."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map((q) => {
                    const tenant = tenants.find((t) => t.id === q.tenant_id);
                    const clientLabel =
                      tenant?.business_name || q.prospect_company || q.prospect_name || '—';
                    return (
                      <tr key={q.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 font-mono font-bold">{q.quote_number}</td>
                        <td className="px-4 py-3 text-slate-500">{q.type}</td>
                        <td className="px-4 py-3">{clientLabel}</td>
                        <td className="px-4 py-3 text-slate-500">{q.issue_date}</td>
                        <td className="px-4 py-3 text-slate-500">{q.valid_until ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-bold">E{q.total.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                            {q.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => handleQuotePdf(q.id, true)}
                              className="text-[11px] font-semibold text-blue-600 hover:underline"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleQuotePdf(q.id, false)}
                              className="text-[11px] font-semibold text-slate-600 hover:underline"
                            >
                              Download
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
                              onClick={() => handleDeleteQuote(q.id, q.quote_number)}
                              className="p-1 text-slate-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
                    <td colSpan={7}>
                      <EmptyState
                        icon={<ShoppingCart className="w-5 h-5" />}
                        title="No orders yet"
                        message="Sales orders track committed work before it's invoiced."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const tenant = tenants.find((t) => t.id === o.tenant_id);
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 font-mono font-bold">{o.order_number}</td>
                        <td className="px-4 py-3">{tenant?.business_name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{o.order_date}</td>
                        <td className="px-4 py-3 text-slate-500">{o.due_date ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-bold">E{o.total.toLocaleString()}</td>
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <QuoteForm
        open={showQuoteModal}
        tenants={tenants}
        shops={shops}
        catalog={catalog}
        onCancel={() => setShowQuoteModal(false)}
        onSubmit={(input) => createQuote.mutate(input as never)}
      />

      <OrderForm
        open={showOrderModal}
        tenants={tenants}
        shops={shops}
        catalog={catalog}
        onCancel={() => setShowOrderModal(false)}
        onSubmit={(input) => createOrder.mutate(input as never)}
      />
    </div>
  );
}

// QuoteForm and OrderForm are large; keep them from the original file structure.
// For a complete restore, the forms below must match production.

interface LineDraft {
  item_id?: string;
  description: string;
  quantity: number;
  unit_amount: number;
  tax_rate: number;
}

function QuoteForm({
  open,
  tenants,
  shops,
  catalog,
  onCancel,
  onSubmit,
}: {
  open: boolean;
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
  const [terms, setTerms] = useState(
    'This quotation is valid for 30 days from the issue date. Acceptance is confirmed by signature and payment of the deposit.'
  );
  const [lines, setLines] = useState<LineDraft[]>([
    { description: '', quantity: 1, unit_amount: 0, tax_rate: 0.15 },
  ]);
  const [templateId, setTemplateId] = useState('blank');

  useEffect(() => {
    if (!open) return;
    setType('Lease Proposal');
    setClientMode('tenant');
    setTenantId(tenants[0]?.id ?? '');
    setProspectCompany('');
    setProspectName('');
    setProspectEmail('');
    setProspectPhone('');
    setShopId('');
    setIssueDate(new Date().toISOString().slice(0, 10));
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setValidUntil(d.toISOString().slice(0, 10));
    setNotes('');
    setTerms('This quotation is valid for 30 days from the issue date. Acceptance is confirmed by signature and payment of the deposit.');
    setLines([{ description: '', quantity: 1, unit_amount: 0, tax_rate: 0.15 }]);
    setTemplateId('blank');
  }, [open, tenants]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = QUOTE_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setLines(
      t.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit_amount: l.unit_amount,
        tax_rate: 0.15,
      }))
    );
  };

  const addLine = () => setLines([...lines, { description: '', quantity: 1, unit_amount: 0, tax_rate: 0.15 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_amount, 0);
  const tax = lines.reduce((s, l) => s + l.quantity * l.unit_amount * l.tax_rate, 0);
  const total = subtotal + tax;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.description.trim() && l.unit_amount >= 0);
    if (validLines.length === 0) return;
    const input: Record<string, unknown> = {
      type,
      issue_date: issueDate,
      valid_until: validUntil,
      notes: notes || null,
      terms: terms || null,
      shop_id: shopId || null,
      lines: validLines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit_amount: l.unit_amount,
        tax_rate: l.tax_rate,
        amount: l.quantity * l.unit_amount * (1 + l.tax_rate),
      })),
    };
    if (clientMode === 'tenant') {
      input.tenant_id = tenantId;
    } else {
      input.prospect_company = prospectCompany;
      input.prospect_name = prospectName;
      input.prospect_email = prospectEmail;
      input.prospect_phone = prospectPhone;
    }
    onSubmit(input);
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onCancel} size="lg" title="New quotation">
      <form onSubmit={submit} className="space-y-3 text-xs">
        <div>
          <label className="block font-semibold mb-1">Start from template</label>
          <select
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
          >
            {QUOTE_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-full px-3 py-2 rounded-xl border">
              <option>Lease Proposal</option>
              <option>Fitout Works</option>
              <option>Once-off Service</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Client</label>
            <select value={clientMode} onChange={(e) => setClientMode(e.target.value as 'tenant' | 'prospect')} className="w-full px-3 py-2 rounded-xl border">
              <option value="tenant">Existing tenant</option>
              <option value="prospect">Prospect</option>
            </select>
          </div>
        </div>
        {clientMode === 'tenant' ? (
          <div>
            <label className="block font-semibold mb-1">Tenant</label>
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="w-full px-3 py-2 rounded-xl border" required>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.business_name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Company" value={prospectCompany} onChange={(e) => setProspectCompany(e.target.value)} className="px-3 py-2 rounded-xl border" />
            <input placeholder="Contact name" value={prospectName} onChange={(e) => setProspectName(e.target.value)} className="px-3 py-2 rounded-xl border" />
            <input placeholder="Email" value={prospectEmail} onChange={(e) => setProspectEmail(e.target.value)} className="px-3 py-2 rounded-xl border" />
            <input placeholder="Phone" value={prospectPhone} onChange={(e) => setProspectPhone(e.target.value)} className="px-3 py-2 rounded-xl border" />
          </div>
        )}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="font-semibold">Line items</label>
            <button type="button" onClick={addLine} className="text-blue-600 font-semibold">+ Add line</button>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input className="col-span-5 px-2 py-1.5 rounded-lg border" placeholder="Description" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
              <input type="number" className="col-span-2 px-2 py-1.5 rounded-lg border" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })} />
              <input type="number" className="col-span-3 px-2 py-1.5 rounded-lg border" value={l.unit_amount} onChange={(e) => updateLine(i, { unit_amount: Number(e.target.value) || 0 })} />
              <button type="button" onClick={() => removeLine(i)} className="col-span-2 text-red-500 text-[10px]">Remove</button>
            </div>
          ))}
          <div className="text-right font-bold">Total: E{total.toLocaleString()}</div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border font-semibold">Cancel</button>
          <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Create quote</button>
        </div>
      </form>
    </Modal>
  );
}

function OrderForm({
  open,
  tenants,
  shops,
  catalog,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  tenants: Tenant[];
  shops: Shop[];
  catalog: InvoiceItem[];
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? '');
  const [shopId, setShopId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([
    { description: '', quantity: 1, unit_amount: 0, tax_rate: 0.15 },
  ]);

  useEffect(() => {
    if (!open) return;
    setTenantId(tenants[0]?.id ?? '');
    setShopId('');
    setOrderDate(new Date().toISOString().slice(0, 10));
    setDueDate('');
    setNotes('');
    setLines([{ description: '', quantity: 1, unit_amount: 0, tax_rate: 0.15 }]);
  }, [open, tenants]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.description.trim());
    if (!tenantId || validLines.length === 0) return;
    onSubmit({
      tenant_id: tenantId,
      shop_id: shopId || null,
      order_date: orderDate,
      due_date: dueDate || null,
      notes: notes || null,
      lines: validLines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit_amount: l.unit_amount,
        tax_rate: l.tax_rate,
        amount: l.quantity * l.unit_amount * (1 + l.tax_rate),
      })),
    });
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onCancel} size="lg" title="New sales order">
      <form onSubmit={submit} className="space-y-3 text-xs">
        <div>
          <label className="block font-semibold mb-1">Tenant</label>
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="w-full px-3 py-2 rounded-xl border" required>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.business_name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Order date</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="font-semibold">Lines</label>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input className="col-span-6 px-2 py-1.5 rounded-lg border" placeholder="Description" value={l.description} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} />
              <input type="number" className="col-span-2 px-2 py-1.5 rounded-lg border" value={l.quantity} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) || 0 } : x))} />
              <input type="number" className="col-span-3 px-2 py-1.5 rounded-lg border" value={l.unit_amount} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, unit_amount: Number(e.target.value) || 0 } : x))} />
              <button type="button" className="col-span-1 text-red-500" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>×</button>
            </div>
          ))}
          <button type="button" onClick={() => setLines([...lines, { description: '', quantity: 1, unit_amount: 0, tax_rate: 0.15 }])} className="text-blue-600 font-semibold">+ Add line</button>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border font-semibold">Cancel</button>
          <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Create order</button>
        </div>
      </form>
    </Modal>
  );
}
