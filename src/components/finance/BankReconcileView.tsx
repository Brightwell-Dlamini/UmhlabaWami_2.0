// src/components/finance/BankReconcileView.tsx
import React, { useMemo, useRef, useState } from 'react';
import {
  Landmark,
  Upload,
  Link2,
  Unlink,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { bankTransactions as bankApi } from '../../services/api/bankTransactions';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useRealtime } from '../../hooks/useRealtime';
import type { BankTransaction, PaymentRecord } from '../../types';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/ToastProvider';
import { EmptyState } from '../ui/EmptyState';

export function BankReconcileView() {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open');
  const [importing, setImporting] = useState(false);
  const [matchTx, setMatchTx] = useState<BankTransaction | null>(null);
  const [suggestions, setSuggestions] = useState<PaymentRecord[]>([]);
  const [matchBusy, setMatchBusy] = useState(false);

  const { data: rows = [], refetch } = useSupabaseQuery(
    ['bank_transactions', orgId],
    () => bankApi.list(),
    { enabled: !!orgId }
  );

  useRealtime({
    table: 'bank_transactions',
    filter: orgId ? `organization_id=eq.${orgId}` : undefined,
    invalidateKeys: ['bank_transactions'],
    enabled: !!orgId,
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'open' && r.reconciled) return false;
      if (filter === 'done' && !r.reconciled) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.description.toLowerCase().includes(q) ||
          String(r.amount).includes(q) ||
          r.date.includes(q)
        );
      }
      return true;
    });
  }, [rows, filter, search]);

  const openCount = useMemo(
    () => rows.filter((r) => !r.reconciled).length,
    [rows]
  );

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const n = await bankApi.importCsv(text);
      if (n > 0) {
        toast.success(
          `Imported ${n} line${n === 1 ? '' : 's'}`,
          'Bank transactions are ready to match.'
        );
      } else {
        toast.info(
          'Nothing imported',
          'Check the CSV has date + amount (or debit/credit) columns.'
        );
      }
      void refetch();
    } catch (e) {
      toast.error(
        'Import failed',
        e instanceof Error ? e.message : 'Could not read CSV.'
      );
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const openMatch = async (tx: BankTransaction) => {
    setMatchTx(tx);
    setSuggestions([]);
    setMatchBusy(true);
    try {
      const list = await bankApi.suggestMatches(tx.id);
      setSuggestions(list);
    } catch (e) {
      toast.error(
        'Could not load matches',
        e instanceof Error ? e.message : 'Try again.'
      );
    } finally {
      setMatchBusy(false);
    }
  };

  const reconcile = async (paymentId?: string) => {
    if (!matchTx) return;
    setMatchBusy(true);
    try {
      await bankApi.reconcile(matchTx.id, paymentId);
      toast.success(
        'Reconciled',
        paymentId
          ? 'Bank line linked to a payment.'
          : 'Bank line marked reconciled without a payment link.'
      );
      setMatchTx(null);
      void refetch();
    } catch (e) {
      toast.error(
        'Reconcile failed',
        e instanceof Error ? e.message : 'Could not reconcile.'
      );
    } finally {
      setMatchBusy(false);
    }
  };

  const unreconcile = async (tx: BankTransaction) => {
    try {
      await bankApi.unreconcile(tx.id);
      toast.success('Unreconciled', 'Line is open again.');
      void refetch();
    } catch (e) {
      toast.error(
        'Failed',
        e instanceof Error ? e.message : 'Could not unreconcile.'
      );
    }
  };

  if (!orgId) {
    return (
      <div className="p-6 text-slate-500 text-sm">No organisation context.</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-600" />
            Bank reconciliation
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Import a bank CSV, then match credits to recorded payments
            {openCount > 0 ? ` · ${openCount} open` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
            }}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, amount, date…"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-800"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-800"
        >
          <option value="open">Open only</option>
          <option value="done">Reconciled</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Landmark className="w-5 h-5" />}
            title="No bank lines yet"
            message="Import a CSV export from your bank (date, description, amount or debit/credit columns)."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Dir</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                    <td className="px-3 py-2 whitespace-nowrap">{tx.date}</td>
                    <td className="px-3 py-2 max-w-[280px] truncate">{tx.description}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          tx.direction === 'credit'
                            ? 'text-emerald-600 font-semibold'
                            : 'text-red-600 font-semibold'
                        }
                      >
                        {tx.direction}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      E{Number(tx.amount).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {tx.reconciled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </span>
                      ) : (
                        <span className="text-amber-600 font-semibold">Open</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {tx.reconciled ? (
                        <button
                          type="button"
                          onClick={() => void unreconcile(tx)}
                          className="text-slate-500 font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <Unlink className="w-3.5 h-3.5" /> Undo
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void openMatch(tx)}
                          className="text-blue-600 font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <Link2 className="w-3.5 h-3.5" /> Match
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {matchTx && (
        <Modal
          open
          onClose={() => setMatchTx(null)}
          title="Match bank line"
          size="md"
        >
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
              <div className="font-bold">{matchTx.description}</div>
              <div className="text-slate-500 mt-0.5">
                {matchTx.date} · {matchTx.direction} · E
                {Number(matchTx.amount).toLocaleString()}
              </div>
            </div>

            {matchBusy && suggestions.length === 0 ? (
              <p className="text-slate-400">Looking for matching payments…</p>
            ) : suggestions.length === 0 ? (
              <p className="text-slate-500">
                No payment records with a similar amount. You can still mark this
                line reconciled without a link.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                <p className="font-semibold text-slate-600">Suggested payments</p>
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={matchBusy}
                    onClick={() => void reconcile(p.id)}
                    className="w-full text-left p-3 rounded-xl border hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition"
                  >
                    <div className="font-bold">
                      E{Number(p.amount).toLocaleString()} · {p.method}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {p.reference || 'No ref'} ·{' '}
                      {p.paid_at?.slice?.(0, 10) || p.paid_at}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setMatchTx(null)}
                className="px-4 py-2 rounded-xl border"
              >
                Close
              </button>
              <button
                type="button"
                disabled={matchBusy}
                onClick={() => void reconcile()}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold disabled:opacity-60"
              >
                Mark reconciled (no link)
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
