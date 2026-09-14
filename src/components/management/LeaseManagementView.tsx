import React, { useMemo, useState } from 'react';
import {
  FileBadge, CheckCircle2, Edit3, Trash2, X, ShieldCheck,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { leases as leasesApi } from '../../services/api/leases';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { shops as shopsApi } from '../../services/api/shops';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { Lease } from '../../types';

export const LeaseManagementView: React.FC = () => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [feedback, setFeedback] = useState('');
  const [showDraft, setShowDraft] = useState(false);
  const [editing, setEditing] = useState<Lease | null>(null);

  const { data: leases = [] } = useSupabaseQuery(['leases', orgId], () => leasesApi.list(), { enabled: !!orgId });
  const { data: tenants = [] } = useSupabaseQuery(['tenants', orgId], () => tenantsApi.list(), { enabled: !!orgId });
  const { data: shops = [] } = useSupabaseQuery(['shops', orgId], () => shopsApi.list(), { enabled: !!orgId });

  useRealtime({ table: 'leases', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['leases'], enabled: !!orgId });

  const create = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof leasesApi.create>[0]) => leasesApi.create(input),
    invalidateKeys: ['leases'],
    onSuccess: () => { setFeedback('Lease created.'); setTimeout(() => setFeedback(''), 3000); setShowDraft(false); },
  });
  const update = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Lease> }) => leasesApi.update(id, patch),
    invalidateKeys: ['leases'],
    onSuccess: () => { setFeedback('Lease updated.'); setTimeout(() => setFeedback(''), 3000); setEditing(null); },
  });
  const remove = useSupabaseMutation({
    mutationFn: (id: string) => leasesApi.remove(id),
    invalidateKeys: ['leases'],
    onSuccess: () => { setFeedback('Lease removed.'); setTimeout(() => setFeedback(''), 3000); },
  });
  const sign = useSupabaseMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => leasesApi.sign(id, name),
    invalidateKeys: ['leases'],
    onSuccess: () => { setFeedback('Lease signed.'); setTimeout(() => setFeedback(''), 3000); },
  });

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Commercial leases</h1>
          <p className="text-xs text-slate-500">Track renewals, deposits, digital signatures</p>
        </div>
        <button onClick={() => setShowDraft(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
          <FileBadge className="w-4 h-4" /> Draft lease
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {feedback}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Term</th>
                <th className="px-4 py-3">Rent</th>
                <th className="px-4 py-3">Deposit</th>
                <th className="px-4 py-3">Signed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leases.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400 text-xs">No leases yet.</td></tr>
              ) : leases.map((l) => {
                const tenant = tenants.find((t) => t.id === l.tenant_id);
                const shop = shops.find((s) => s.id === l.shop_id);
                return (
                  <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="font-bold">{tenant?.business_name ?? '—'}</div>
                      <div className="text-[10px] text-slate-400">{tenant?.contact_person}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">Unit {shop?.shop_number ?? '—'}</td>
                    <td className="px-4 py-3">{l.start_date} → {l.end_date}</td>
                    <td className="px-4 py-3 font-bold">E{l.rental_amount.toLocaleString()}</td>
                    <td className="px-4 py-3">E{(l.deposit ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {l.is_digitally_signed ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5" /> {l.signer_name ?? 'Signed'}
                        </span>
                      ) : (
                        <button onClick={() => sign.mutate({ id: l.id, name: tenant?.contact_person ?? 'Tenant' })}
                          className="text-[11px] font-bold text-blue-600 hover:underline">
                          Sign now
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                        {l.renewal_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setEditing(l)}
                          className="p-1.5 rounded-lg border text-slate-600 hover:bg-slate-100">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { if (confirm('Delete lease?')) remove.mutate(l.id); }}
                          className="p-1.5 rounded-lg border text-red-500 hover:bg-red-50">
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

      {(showDraft || editing) && (
        <LeaseForm
          tenants={tenants}
          shops={shops}
          initial={editing}
          onCancel={() => { setShowDraft(false); setEditing(null); }}
          onSubmit={(input) => {
            if (editing) update.mutate({ id: editing.id, patch: input as never });
            else create.mutate(input as never);
          }}
        />
      )}
    </div>
  );
};

function LeaseForm({
  tenants, shops, initial, onCancel, onSubmit,
}: {
  tenants: { id: string; business_name: string; contact_person: string; shop_id: string }[];
  shops: { id: string; shop_number: string; rental_amount: number; deposit_amount: number }[];
  initial: Lease | null;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    tenant_id: initial?.tenant_id ?? tenants[0]?.id ?? '',
    shop_id: initial?.shop_id ?? tenants[0]?.shop_id ?? shops[0]?.id ?? '',
    start_date: initial?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: initial?.end_date ?? new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    rental_amount: initial?.rental_amount ?? 15000,
    deposit: initial?.deposit ?? 30000,
    renewal_status: (initial?.renewal_status ?? 'Active') as Lease['renewal_status'],
    document_title: initial?.document_title ?? '',
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{initial ? 'Edit lease' : 'Draft lease'}</h3>
          <button onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form }); }}
          className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Tenant *</label>
              <select value={form.tenant_id}
                onChange={(e) => {
                  const t = tenants.find((x) => x.id === e.target.value);
                  setForm({ ...form, tenant_id: e.target.value, shop_id: t?.shop_id ?? form.shop_id });
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.business_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Unit</label>
              <select value={form.shop_id}
                onChange={(e) => {
                  const s = shops.find((x) => x.id === e.target.value);
                  setForm({
                    ...form, shop_id: e.target.value,
                    rental_amount: s?.rental_amount ?? form.rental_amount,
                    deposit: s?.deposit_amount ?? form.deposit,
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                {shops.map((s) => <option key={s.id} value={s.id}>Unit {s.shop_number}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Start</label>
              <input type="date" required value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
            <div>
              <label className="block font-semibold mb-1">End</label>
              <input type="date" required value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Rent (E)</label>
              <input type="number" required value={form.rental_amount}
                onChange={(e) => setForm({ ...form, rental_amount: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Deposit (E)</label>
              <input type="number" required value={form.deposit}
                onChange={(e) => setForm({ ...form, deposit: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Status</label>
              <select value={form.renewal_status}
                onChange={(e) => setForm({ ...form, renewal_status: e.target.value as Lease['renewal_status'] })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                <option>Active</option><option>Pending Renewal</option>
                <option>Renewed</option><option>Expired</option><option>Terminated</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Document title *</label>
            <input required value={form.document_title}
              onChange={(e) => setForm({ ...form, document_title: e.target.value })}
              placeholder="Commercial lease — Unit G-14"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
              {initial ? 'Save' : 'Create lease'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
