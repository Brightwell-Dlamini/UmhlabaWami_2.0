import React, { useEffect, useState } from 'react';
import type { InvoiceItem } from '../../services/api/accounting';
import { Modal } from '../ui/Modal';

export function ItemForm({
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
  const [unitPrice, setUnitPrice] = useState(
    initial?.unit_price != null ? String(initial.unit_price) : ''
  );
  const [taxRate, setTaxRate] = useState(initial?.tax_rate ?? 0);
  const [defaultQty, setDefaultQty] = useState(
    initial?.default_quantity != null ? String(initial.default_quantity) : '1'
  );
  const [category, setCategory] = useState(initial?.category ?? 'Other');

  useEffect(() => {
    if (!open) return;
    setCode(initial?.code ?? '');
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setUnitPrice(
      initial?.unit_price != null ? String(initial.unit_price) : ''
    );
    setTaxRate(initial?.tax_rate ?? 0);
    setDefaultQty(
      initial?.default_quantity != null
        ? String(initial.default_quantity)
        : '1'
    );
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
          const price = Math.round(Number(unitPrice) * 100) / 100;
          const qty = Number(defaultQty) || 1;
          if (!name.trim()) return;
          if (!(price >= 0) || Number.isNaN(price)) return;
          onSubmit({
            code: code.trim() || undefined,
            name: name.trim(),
            description: description.trim() || undefined,
            unit_price: price,
            tax_rate: taxRate,
            default_quantity: qty,
            category: category || undefined,
          });
        }}
        className="space-y-3 text-xs"
      >
        <div>
          <label htmlFor="item-code" className="block font-semibold mb-1">
            Code
          </label>
          <input
            id="item-code"
            placeholder="e.g. RENT-001 (optional)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
          />
        </div>

        <div>
          <label htmlFor="item-name" className="block font-semibold mb-1">
            Name *
          </label>
          <input
            id="item-name"
            required
            placeholder="e.g. Monthly base rent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
        </div>

        <div>
          <label htmlFor="item-desc" className="block font-semibold mb-1">
            Description
          </label>
          <input
            id="item-desc"
            placeholder="Shown on invoices (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="item-price" className="block font-semibold mb-1">
              Unit price (E) *
            </label>
            <input
              id="item-price"
              type="number"
              required
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
            />
          </div>
          <div>
            <label htmlFor="item-tax" className="block font-semibold mb-1">
              Tax rate
            </label>
            <select
              id="item-tax"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              <option value={0}>0% (no tax)</option>
              <option value={0.15}>15%</option>
              <option value={0.14}>14%</option>
            </select>
          </div>
          <div>
            <label htmlFor="item-qty" className="block font-semibold mb-1">
              Default qty
            </label>
            <input
              id="item-qty"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="1"
              value={defaultQty}
              onChange={(e) => setDefaultQty(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        <div>
          <label htmlFor="item-cat" className="block font-semibold mb-1">
            Category
          </label>
          <select
            id="item-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          >
            <option value="Rent">Rent</option>
            <option value="Service Charge">Service Charge</option>
            <option value="Utility">Utility</option>
            <option value="Parking">Parking</option>
            <option value="Signage">Signage</option>
            <option value="Penalty">Penalty</option>
            <option value="Deposit">Deposit</option>
            <option value="Fitout">Fitout</option>
            <option value="Other">Other</option>
          </select>
        </div>

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
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Create item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
