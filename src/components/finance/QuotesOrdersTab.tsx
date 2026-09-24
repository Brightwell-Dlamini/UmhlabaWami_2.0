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
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { Tenant, Shop } from '../../types';
import { Modal } from '../ui/Modal';
import { OrderForm } from './OrderForm';
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
    () => itemsApi.list(),
    { enabled: !!orgId }
  );

  useRealtime({
    table: 'quotes',
    filter: orgId ? `organization_id=eq.${orgId}` : undefined,
    invalidateKeys: ['quotes'],
    enabled: !!orgId,
  });
  useRealtime({
    table: 'sales_orders',
    filter: orgId ? `organization_id=eq.${orgId}` : undefined,
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
    onError: (e) => toast.error('Create failed', e.message),
  });

  const createOrder = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof ordersApi.create>[0]) => ordersApi.create(input),
    invalidateKeys: ['sales_orders'],
    onSuccess: () => {
      toast.success('Order created');
      setShowOrderModal(false);
    },
    onError: (e) => toast.error('Create failed', e.message),
  });

  const convertQuote = useSupabaseMutation({
    mutationFn: (id: string) => quotesApi.convertToInvoice(id),
    invalidateKeys: ['quotes', 'invoices'],
    onSuccess: () => toast.success('Quote converted to invoice'),
    onError: (e) => toast.error('Convert failed', e.message),
  });

  const removeQuote = useSupabaseMutation({
    mutationFn: (id: string) => quotesApi.remove(id),
    invalidateKeys: ['quotes'],
  });

  const removeOrder = useSupabaseMutation({
    mutationFn: (id: string) => ordersApi.remove(id),
    invalidateKeys: ['sales_orders'],
  });

  const filteredQuotes = useMemo(() => {
    if (!search.trim()) return quotes;
    const q = search.toLowerCase();
    return quotes.filter(
      (x) =>
        String((x as { quote_number?: string }).quote_number ?? '').toLowerCase().includes(q) ||
        String((x as { prospect_company?: string }).prospect_company ?? '').toLowerCase().includes(q) ||
        String((x as { prospect_name?: string }).prospect_name ?? '').toLowerCase().includes(q)
    );
  }, [quotes, search]);

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (x) =>
        String((x as { order_number?: string }).order_number ?? '').toLowerCase().includes(q) ||
        String((x as { salesperson_name?: string }).salesperson_name ?? '').toLowerCase().includes(q)
    );
  }, [orders, search]);

  const handleDeleteQuote = async (id: string, label: string) => {
    const ok = await confirm({
      title: `Delete ${label}?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await removeQuote.mutate(id);
      toast.success('Quote deleted');
    } catch (e) {
      toast.error('Delete failed', e instanceof Error ? e.message : 'Could not delete.');
    }
  };

  const handleDeleteOrder = async (id: string, label: string) => {
    const ok = await confirm({
      title: `Delete ${label}?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await removeOrder.mutate(id);
      toast.success('Order deleted');
    } catch (e) {
      toast.error('Delete failed', e instanceof Error ? e.message : 'Could not delete.');
    }
  };

  if (!orgId) {
    return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
          {(
            [
              { id: 'quotes' as const, label: `Quotes (${quotes.length})`, icon: FileText },
              { id: 'orders' as const, label: `Orders (${orders.length})`, icon: ShoppingCart },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
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
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border bg-slate-50 dark:bg-slate-900"
            />
          </div>
          {subTab === 'quotes' ? (
            <button
              type="button"
              onClick={() => setShowQuoteModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> New quote
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowOrderModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> New order
            </button>
          )}
        </div>
      </div>

      {subTab === 'quotes' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
          {filteredQuotes.length === 0 ? (
            <EmptyState
              title="No quotes yet"
              message="Create a quote for a tenant or prospect."
              action={
                <button
                  type="button"
                  onClick={() => setShowQuoteModal(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
                >
                  New quote
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Number</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredQuotes.map((q) => {
                    const qq = q as {
                      id: string;
                      quote_number?: string;
                      prospect_company?: string;
                      prospect_name?: string;
                      status?: string;
                      total?: number;
                      tenant_id?: string;
                    };
                    const client =
                      qq.prospect_company ||
                      qq.prospect_name ||
                      tenants.find((t) => t.id === qq.tenant_id)?.business_name ||
                      '—';
                    return (
                      <tr key={qq.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 font-mono font-bold">{qq.quote_number}</td>
                        <td className="px-4 py-3">{client}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                            {qq.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          E{Number(qq.total ?? 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            {qq.status !== 'Converted' && (
                              <button
                                type="button"
                                onClick={() => convertQuote.mutate(qq.id)}
                                className="px-2 py-1 rounded-lg border text-[11px] font-semibold text-blue-600"
                                title="Convert to invoice"
                              >
                                <ArrowRight className="w-3.5 h-3.5 inline" /> Invoice
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleDeleteQuote(qq.id, qq.quote_number ?? 'quote')}
                              className="p-1.5 rounded-lg border text-red-500"
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
          )}
        </div>
      )}

      {subTab === 'orders' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
          {filteredOrders.length === 0 ? (
            <EmptyState
              title="No orders yet"
              message="Create a sales order for a tenant."
              action={
                <button
                  type="button"
                  onClick={() => setShowOrderModal(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
                >
                  New order
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Number</th>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((o) => {
                    const oo = o as {
                      id: string;
                      order_number?: string;
                      tenant_id?: string;
                      status?: string;
                      total?: number;
                    };
                    const tenantName =
                      tenants.find((t) => t.id === oo.tenant_id)?.business_name || '—';
                    return (
                      <tr key={oo.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3 font-mono font-bold">{oo.order_number}</td>
                        <td className="px-4 py-3">{tenantName}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                            {oo.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          E{Number(oo.total ?? 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void handleDeleteOrder(oo.id, oo.order_number ?? 'order')}
                            className="p-1.5 rounded-lg border text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([
    { description: '', quantity: 1, unit_amount: 0, tax_rate: 0 },
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
    setIssueDate(new Date().toISOString().slice(0, 10));
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setValidUntil(d.toISOString().slice(0, 10));
    setNotes('');
    setLines([{ description: '', quantity: 1, unit_amount: 0, tax_rate: 0 }]);
    setTemplateId('blank');
  }, [open, tenants]);

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const addLine = () =>
    setLines((prev) => [...prev, { description: '', quantity: 1, unit_amount: 0, tax_rate: 0 }]);

  const removeLine = (i: number) =>
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = QUOTE_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    setLines(
      tpl.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit_amount: l.unit_amount,
        tax_rate: 0,
      }))
    );
  };

  const total = lines.reduce(
    (s, l) => s + l.quantity * l.unit_amount * (1 + (l.tax_rate || 0)),
    0
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.description.trim());
    if (validLines.length === 0) return;
    if (clientMode === 'tenant' && !tenantId) return;
    if (clientMode === 'prospect' && !prospectCompany.trim()) return;

    onSubmit({
      type,
      tenant_id: clientMode === 'tenant' ? tenantId : null,
      prospect_company: clientMode === 'prospect' ? prospectCompany.trim() : null,
      prospect_name: clientMode === 'prospect' ? prospectName.trim() || null : null,
      prospect_email: clientMode === 'prospect' ? prospectEmail.trim() || null : null,
      prospect_phone: clientMode === 'prospect' ? prospectPhone.trim() || null : null,
      issue_date: issueDate,
      valid_until: validUntil,
      notes: notes.trim() || null,
      lines: validLines.map((l) => {
        const unit = Math.round(Number(l.unit_amount) * 100) / 100;
        const qty = Math.round(Number(l.quantity) * 100) / 100;
        const tax = Number(l.tax_rate) || 0;
        return {
          description: l.description.trim(),
          quantity: qty,
          unit_amount: unit,
          tax_rate: tax,
        };
      }),
    });
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onCancel} size="lg" title="New quote">
      <form onSubmit={submit} className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
            >
              <option value="Lease Proposal">Lease Proposal</option>
              <option value="Fitout Works">Fitout Works</option>
              <option value="Once-off Service">Once-off Service</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Template</label>
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
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setClientMode('tenant')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${
              clientMode === 'tenant' ? 'bg-blue-600 text-white' : 'border'
            }`}
          >
            Existing tenant
          </button>
          <button
            type="button"
            onClick={() => setClientMode('prospect')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${
              clientMode === 'prospect' ? 'bg-blue-600 text-white' : 'border'
            }`}
          >
            Prospect
          </button>
        </div>

        {clientMode === 'tenant' ? (
          <div>
            <label className="block font-semibold mb-1">Tenant *</label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
              required
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.business_name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Company *</label>
              <input
                required
                placeholder="Company name"
                value={prospectCompany}
                onChange={(e) => setProspectCompany(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Contact name</label>
              <input
                placeholder="Contact person"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Email</label>
              <input
                type="email"
                placeholder="email@example.com"
                value={prospectEmail}
                onChange={(e) => setProspectEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Phone</label>
              <input
                placeholder="+268 …"
                value={prospectPhone}
                onChange={(e) => setProspectPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Issue date</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Valid until</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="font-semibold">Line items *</label>
            <button type="button" onClick={addLine} className="text-blue-600 font-semibold">
              + Add line
            </button>
          </div>
          <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] uppercase text-slate-500 font-semibold">
            <div className="col-span-5">Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-3 text-right">Unit price (E)</div>
            <div className="col-span-2" />
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="col-span-5 px-2 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-900"
                placeholder="e.g. Shop fitting package"
                value={l.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="1"
                className="col-span-2 px-2 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-900 text-right"
                value={l.quantity}
                onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                className="col-span-3 px-2 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-900 text-right font-bold"
                value={l.unit_amount === 0 ? '' : l.unit_amount}
                onChange={(e) =>
                  updateLine(i, {
                    unit_amount: e.target.value === '' ? 0 : Number(e.target.value) || 0,
                  })
                }
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="col-span-2 text-red-500 text-[10px] font-semibold"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="text-right font-bold">
            Total: E{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border font-semibold">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">
            Create quote
          </button>
        </div>
      </form>
    </Modal>
  );
}
