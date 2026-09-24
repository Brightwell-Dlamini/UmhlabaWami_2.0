import React, { useEffect, useMemo, useState } from 'react';
import type { InvoiceItem } from '../../services/api/accounting';
import type { Shop, Tenant } from '../../types';
import { Modal } from '../ui/Modal';

interface LineDraft {
  item_id?: string;
  description: string;
  quantity: number;
  unit_amount: number;
  tax_rate: number;
}

const emptyLine = (): LineDraft => ({
  description: '',
  quantity: 1,
  unit_amount: 0,
  tax_rate: 0,
});

export function OrderForm({
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
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  useEffect(() => {
    if (!open) return;
    setTenantId(tenants[0]?.id ?? '');
    setShopId('');
    setOrderDate(new Date().toISOString().slice(0, 10));
    setDueDate('');
    setNotes('');
    setLines([emptyLine()]);
  }, [open, tenants]);

  const tenantShops = useMemo(() => {
    const t = tenants.find((x) => x.id === tenantId);
    if (!t?.shop_id) return shops;
    // Prefer tenant's unit first, still allow other vacant/occupied units for edge cases
    const primary = shops.filter((s) => s.id === t.shop_id);
    const rest = shops.filter((s) => s.id !== t.shop_id);
    return [...primary, ...rest];
  }, [tenants, tenantId, shops]);

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + l.quantity * l.unit_amount * (1 + (l.tax_rate || 0)),
        0
      ),
    [lines]
  );

  const updateLine = (i: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };

  const applyCatalogItem = (i: number, itemId: string) => {
    const item = catalog.find((c) => c.id === itemId);
    if (!item) {
      updateLine(i, { item_id: undefined });
      return;
    }
    updateLine(i, {
      item_id: item.id,
      description: item.name,
      unit_amount: Number(item.unit_price) || 0,
      tax_rate: Number(item.tax_rate) || 0,
      quantity: Number(item.default_quantity) || 1,
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.description.trim() && l.quantity > 0);
    if (!tenantId || validLines.length === 0) return;
    onSubmit({
      tenant_id: tenantId,
      shop_id: shopId || null,
      order_date: orderDate,
      due_date: dueDate || null,
      notes: notes.trim() || null,
      lines: validLines.map((l) => {
        const unit = Math.round(Number(l.unit_amount) * 100) / 100;
        const qty = Math.round(Number(l.quantity) * 100) / 100;
        const tax = Number(l.tax_rate) || 0;
        return {
          item_id: l.item_id || null,
          description: l.description.trim(),
          quantity: qty,
          unit_amount: unit,
          tax_rate: tax,
          amount: Math.round(qty * unit * (1 + tax) * 100) / 100,
        };
      }),
    });
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onCancel} size="lg" title="New sales order">
      <form onSubmit={submit} className="space-y-3 text-xs">
        <div>
          <label htmlFor="order-tenant" className="block font-semibold mb-1">
            Tenant *
          </label>
          <select
            id="order-tenant"
            value={tenantId}
            onChange={(e) => {
              setTenantId(e.target.value);
              const t = tenants.find((x) => x.id === e.target.value);
              if (t?.shop_id) setShopId(t.shop_id);
            }}
            className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
            required
          >
            {tenants.length === 0 && <option value="">No tenants</option>}
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.business_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="order-unit" className="block font-semibold mb-1">
            Unit (optional)
          </label>
          <select
            id="order-unit"
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
          >
            <option value="">— Not linked to a unit —</option>
            {tenantShops.map((s) => (
              <option key={s.id} value={s.id}>
                Unit {s.shop_number}
                {s.rental_amount != null
                  ? ` · E${Number(s.rental_amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}/mo`
                  : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="order-date" className="block font-semibold mb-1">
              Order date *
            </label>
            <input
              id="order-date"
              type="date"
              required
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
            />
          </div>
          <div>
            <label htmlFor="order-due" className="block font-semibold mb-1">
              Due date
            </label>
            <input
              id="order-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold">Line items *</label>
            {catalog.length > 0 && (
              <span className="text-[10px] text-slate-500">
                Pick from catalog or type freely
              </span>
            )}
          </div>

          <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-slate-500 font-semibold px-0.5">
            <div className="col-span-5">Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit price (E)</div>
            <div className="col-span-2 text-right">Tax</div>
            <div className="col-span-1" />
          </div>

          {lines.map((l, i) => (
            <div key={i} className="space-y-1.5 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2 items-start">
              <div className="sm:col-span-5 space-y-1">
                {catalog.length > 0 && (
                  <select
                    aria-label={`Catalog item for line ${i + 1}`}
                    value={l.item_id ?? ''}
                    onChange={(e) => applyCatalogItem(i, e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-900 text-[11px]"
                  >
                    <option value="">Custom line…</option>
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code ? `${c.code} — ` : ''}
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  required
                  placeholder="e.g. Monthly service charge"
                  value={l.description}
                  onChange={(e) => updateLine(i, { description: e.target.value, item_id: undefined })}
                  className="w-full px-2 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-900"
                  aria-label={`Description line ${i + 1}`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="sm:hidden text-[10px] font-semibold text-slate-500">Qty</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="1"
                  value={l.quantity}
                  onChange={(e) =>
                    updateLine(i, { quantity: Number(e.target.value) || 0 })
                  }
                  className="w-full px-2 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-900 text-right"
                  aria-label={`Quantity line ${i + 1}`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="sm:hidden text-[10px] font-semibold text-slate-500">
                  Unit price (E)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={l.unit_amount === 0 ? '' : l.unit_amount}
                  onChange={(e) =>
                    updateLine(i, {
                      unit_amount: e.target.value === '' ? 0 : Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-900 text-right font-bold"
                  aria-label={`Unit price line ${i + 1}`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="sm:hidden text-[10px] font-semibold text-slate-500">Tax</label>
                <select
                  value={l.tax_rate}
                  onChange={(e) => updateLine(i, { tax_rate: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-900"
                  aria-label={`Tax rate line ${i + 1}`}
                >
                  <option value={0}>0%</option>
                  <option value={0.15}>15%</option>
                  <option value={0.14}>14%</option>
                </select>
              </div>
              <div className="sm:col-span-1 flex sm:justify-end">
                <button
                  type="button"
                  className="px-2 py-1.5 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={lines.length <= 1}
                  aria-label={`Remove line ${i + 1}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
            className="text-blue-600 font-semibold hover:underline"
          >
            + Add line
          </button>

          <div className="text-right font-bold text-sm pt-1">
            Total:{' '}
            E
            {total.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        <div>
          <label htmlFor="order-notes" className="block font-semibold mb-1">
            Notes
          </label>
          <textarea
            id="order-notes"
            rows={2}
            placeholder="Internal notes or delivery instructions (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900 resize-y"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            Create order
          </button>
        </div>
      </form>
    </Modal>
  );
}
