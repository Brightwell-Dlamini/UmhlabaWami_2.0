import React, { useEffect, useState } from 'react';
import { auth } from '../../services/auth';
import { Modal } from '../ui/Modal';

export function RequisitionForm({
  open,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    requested_by_name: string;
    type: string;
    amount: number;
    purpose: string;
  }) => void;
}) {
  const user = auth.getCurrentUser();
  const [requestedBy, setRequestedBy] = useState(user?.name ?? '');
  const [type, setType] = useState('Petty Cash');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');

  useEffect(() => {
    if (!open) return;
    setRequestedBy(user?.name ?? '');
    setType('Petty Cash');
    setAmount('');
    setPurpose('');
  }, [open, user?.name]);

  return (
    <Modal open={open} onClose={onCancel} title="New requisition" size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = Math.round(Number(amount) * 100) / 100;
          if (!(n > 0) || !purpose.trim() || !requestedBy.trim()) return;
          onSubmit({
            requested_by_name: requestedBy.trim(),
            type,
            amount: n,
            purpose: purpose.trim(),
          });
        }}
        className="space-y-3 text-xs"
      >
        <div>
          <label htmlFor="req-by" className="block font-semibold mb-1">Requested by *</label>
          <input
            id="req-by"
            required
            placeholder="Your name"
            value={requestedBy}
            onChange={(e) => setRequestedBy(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          />
        </div>
        <div>
          <label htmlFor="req-type" className="block font-semibold mb-1">Type</label>
          <select
            id="req-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          >
            <option>Petty Cash</option>
            <option>Supplier Payment</option>
            <option>Refund</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="req-amt" className="block font-semibold mb-1">Amount (E) *</label>
          <input
            id="req-amt"
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
          <label htmlFor="req-purpose" className="block font-semibold mb-1">Purpose *</label>
          <input
            id="req-purpose"
            required
            placeholder="What is this for?"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          />
        </div>
        <div className="pt-3 border-t flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">Cancel</button>
          <button type="submit" disabled={busy} className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60">
            {busy ? 'Submitting…' : 'Submit requisition'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
