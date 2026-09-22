// src/components/auth/FindOrgModal.tsx
import React, { useState } from 'react';
import { Building2, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { orgLookup } from '../../services/api/orgLookup';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the user decides to use the found code — typically prefills login. */
  onUseCode?: (code: string) => void;
}

export function FindOrgModal({ isOpen, onClose, onUseCode }: Props) {
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { kind: 'idle' }
    | { kind: 'found'; code: string; message: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult({ kind: 'idle' });
    try {
      const res = await orgLookup.findByCompanyAndEmail(company, email);
      if (res.found && res.code) {
        setResult({ kind: 'found', code: res.code, message: res.message });
      } else {
        setResult({ kind: 'error', message: res.message });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUse = () => {
    if (result.kind === 'found') {
      onUseCode?.(result.code);
      onClose();
      // reset for next open
      setCompany('');
      setEmail('');
      setResult({ kind: 'idle' });
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Find your organisation code"
      subtitle="Enter the registered details to look it up"
      icon={<Building2 className="w-5 h-5 text-blue-600" />}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div>
          <label className="block font-semibold mb-1">Company name</label>
          <input
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Ezulwini Commercial Holdings"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Owner email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@company.sz"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
        </div>

        {result.kind === 'found' && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Found your code</div>
              <div className="font-mono text-sm mt-0.5">{result.code}</div>
            </div>
          </div>
        )}

        {result.kind === 'error' && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{result.message}</span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold"
          >
            Cancel
          </button>
          {result.kind === 'found' ? (
            <button
              type="button"
              onClick={handleUse}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Use this code
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-60 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              {busy ? 'Searching…' : 'Find my code'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
