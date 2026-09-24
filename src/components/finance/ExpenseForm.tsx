import React, { useState } from 'react';
import { Modal } from '../ui/Modal';

export function ExpenseForm({
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
  const [amount, setAmount] = useState('');
  const [centerId, setCenterId] = useState(centers[0]?.id ?? '');

  return (
    <Modal open={open} onClose={onCancel} title="Record expense" size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = Math.round(Number(amount) * 100) / 100;
          if (!(n > 0) || !description.trim() || !centerId) return;
          onSubmit({
            description: description.trim(),
            category,
            amount: n,
            shopping_center_id: centerId,
          });
        }}
        className="space-y-3 text-xs"
      >
        <div>
          <label htmlFor="exp-desc" className="block font-semibold mb-1">Description *</label>
          <input
            id="exp-desc"
            required
            placeholder="e.g. Plumbing repair — Block A"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          />
        </div>
        <div>
          <label htmlFor="exp-cat" className="block font-semibold mb-1">Category</label>
          <select
            id="exp-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          >
            <option>Maintenance</option>
            <option>Utilities</option>
            <option>Security</option>
            <option>Cleaning</option>
            <option>Insurance</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="exp-amt" className="block font-semibold mb-1">Amount (E) *</label>
          <input
            id="exp-amt"
            type="number"
            required
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border font-bold"
          />
        </div>
        <div>
          <label htmlFor="exp-centre" className="block font-semibold mb-1">Centre *</label>
          <select
            id="exp-centre"
            required
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          >
            {centers.length === 0 && <option value="">No centres</option>}
            {centers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="pt-3 border-t flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">Cancel</button>
          <button type="submit" disabled={busy} className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60">
            {busy ? 'Saving…' : 'Record expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
