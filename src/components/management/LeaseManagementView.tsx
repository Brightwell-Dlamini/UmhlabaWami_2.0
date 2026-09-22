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
  const user = auth.getCurrentUser();
  const isTenant = user?.role === 'tenant';
  const canManage = !isTenant;
  const [feedback, setFeedback] = useState('');
  const [showDraft, setShowDraft] = useState(false);
  const [editing, setEditing] = useState<Lease | null>(null);
  const [reading, setReading] = useState<Lease | null>(null);

  const { data: leases = [] } = useSupabaseQuery(['leases', orgId], () => leasesApi.list(), { enabled: !!orgId });
  const { data: tenants = [] } = useSupabaseQuery(['tenants', orgId], () => tenantsApi.list(), { enabled: !!orgId });
  const { data: shops = [] } = useSupabaseQuery(['shops', orgId], () => shopsApi.list(), { enabled: !!orgId });

  useRealtime({ table: 'leases', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['leases'], enabled: !!orgId });

  const myTenant = useMemo(() => {
    if (!user) return undefined;
    return (
      tenants.find((t) => t.user_id === user.id) ??
      tenants.find(
        (t) =>
          t.email &&
          user.email &&
          t.email.toLowerCase() === user.email.toLowerCase()
      ) ??
      (user.shop_id ? tenants.find((t) => t.shop_id === user.shop_id) : undefined)
    );
  }, [tenants, user]);

  const visibleLeases = useMemo(() => {
    if (!isTenant) return leases;
    if (!myTenant) return [];
    return leases.filter((l) => l.tenant_id === myTenant.id);
  }, [leases, isTenant, myTenant]);

  const flash = (msg: string, ms = 4000) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), ms);
  };

  const create = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof leasesApi.create>[0]) => leasesApi.create(input),
    invalidateKeys: ['leases'],
    onSuccess: () => {
      flash('Lease created successfully.');
      setShowDraft(false);
    },
    onError: (e) => flash(`Create failed: ${e.message}`, 8000),
  });
  const update = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Lease> }) => leasesApi.update(id, patch),
    invalidateKeys: ['leases'],
    onSuccess: () => {
      flash('Lease updated successfully.');
      setEditing(null);
    },
    onError: (e) => flash(`Save failed: ${e.message}`, 8000),
  });
  const remove = useSupabaseMutation({
    mutationFn: (id: string) => leasesApi.remove(id),
    invalidateKeys: ['leases'],
    onSuccess: () => flash('Lease removed.'),
    onError: (e) => flash(`Delete failed: ${e.message}`, 8000),
  });
  const sign = useSupabaseMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => leasesApi.sign(id, name),
    invalidateKeys: ['leases'],
    onSuccess: () => flash('Lease signed.'),
    onError: (e) => flash(`Sign failed: ${e.message}`, 8000),
  });

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {isTenant ? 'My lease' : 'Commercial leases'}
          </h1>
          <p className="text-xs text-slate-500">
            {isTenant
              ? 'Read your lease terms, status and digital signature'
              : 'Track renewals, deposits, full terms and digital signatures'}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowDraft(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            type="button"
          >
            <FileBadge className="w-4 h-4" /> Draft lease
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
            /fail|error/i.test(feedback)
              ? 'bg-red-50 border-red-300 text-red-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" /> {feedback}
        </div>
      )}

      {isTenant && !myTenant && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs">
          Your account is not linked to a tenant record yet. Documents and leases
          will appear once your organisation admin links your user under{' '}
          <strong>Tenants Directory</strong>.
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
              <tr>
                {!isTenant && <th className="px-4 py-3">Tenant</th>}
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
              {visibleLeases.length === 0 ? (
                <tr>
                  <td colSpan={isTenant ? 7 : 8} className="p-8 text-center text-slate-400 text-xs">
                    {isTenant ? 'No lease on file for you yet.' : 'No leases yet.'}
                  </td>
                </tr>
              ) : (
                visibleLeases.map((l) => {
                  const tenant = tenants.find((t) => t.id === l.tenant_id);
                  const shop = shops.find((s) => s.id === l.shop_id);
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                      {!isTenant && (
                        <td className="px-4 py-3">
                          <div className="font-bold">{tenant?.business_name ?? '—'}</div>
                          <div className="text-[10px] text-slate-400">{tenant?.contact_person}</div>
                        </td>
                      )}
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
                          <button
                            onClick={() =>
                              sign.mutate({
                                id: l.id,
                                name: isTenant
                                  ? (user?.name ?? tenant?.contact_person ?? 'Tenant')
                                  : (tenant?.contact_person ?? 'Tenant'),
                              })
                            }
                            className="text-[11px] font-bold text-blue-600 hover:underline"
                            type="button"
                          >
                            {isTenant ? 'Sign now' : 'Mark signed'}
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
                          <button
                            onClick={() => setReading(l)}
                            className="px-2 py-1 rounded-lg border text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
                            type="button"
                            title="Read full terms"
                          >
                            Read terms
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => setEditing(l)}
                                className="p-1.5 rounded-lg border text-slate-600 hover:bg-slate-100"
                                type="button"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Delete lease?')) remove.mutate(l.id);
                                }}
                                className="p-1.5 rounded-lg border text-red-500 hover:bg-red-50"
                                type="button"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
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

      {reading && (
        <LeaseTermsModal
          lease={reading}
          tenant={tenants.find((t) => t.id === reading.tenant_id)}
          shop={shops.find((s) => s.id === reading.shop_id)}
          onClose={() => setReading(null)}
        />
      )}

      {canManage && (showDraft || editing) && (
        <LeaseForm
          tenants={tenants}
          shops={shops}
          initial={editing}
          onCancel={() => {
            setShowDraft(false);
            setEditing(null);
          }}
          onSubmit={(input) => {
            if (editing) update.mutate({ id: editing.id, patch: input as never });
            else create.mutate(input as never);
          }}
        />
      )}
    </div>
  );
};

function LeaseTermsModal({
  lease,
  tenant,
  shop,
  onClose,
}: {
  lease: Lease;
  tenant?: { business_name: string; contact_person: string };
  shop?: { shop_number: string };
  onClose: () => void;
}) {
  const raw =
    (lease as Lease & { terms_body?: string }).terms_body ||
    lease.document_url ||
    '';
  const terms = raw.startsWith('terms:\n') ? raw.slice(7) : raw;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">{lease.document_title}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {tenant?.business_name ?? 'Tenant'} · Unit {shop?.shop_number ?? '—'} ·{' '}
              {lease.start_date} → {lease.end_date}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
            <div className="text-[10px] uppercase text-slate-400 font-semibold">Monthly rent</div>
            <div className="font-bold mt-0.5">E{lease.rental_amount.toLocaleString()}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
            <div className="text-[10px] uppercase text-slate-400 font-semibold">Deposit</div>
            <div className="font-bold mt-0.5">E{(lease.deposit ?? 0).toLocaleString()}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
            <div className="text-[10px] uppercase text-slate-400 font-semibold">Status</div>
            <div className="font-bold mt-0.5">{lease.renewal_status}</div>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Lease terms</h4>
          {terms ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs whitespace-pre-wrap leading-relaxed p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border max-h-80 overflow-y-auto">
              {terms}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs">
              No full terms text has been attached to this lease yet. Ask your
              property manager to add the lease wording under{' '}
              <strong>Draft / Edit lease → Terms</strong>.
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border text-xs font-semibold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

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
    terms_body: initial?.terms_body ?? '',
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{initial ? 'Edit lease' : 'Draft lease'}</h3>
          <button type="button" onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
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
          <div>
            <label className="block font-semibold mb-1">
              Full lease terms (what the tenant reads before signing)
            </label>
            <textarea
              value={form.terms_body}
              onChange={(e) => setForm({ ...form, terms_body: e.target.value })}
              rows={8}
              placeholder="Paste or write the full lease wording here — parties, demised premises, rent, escalation, deposit, permitted use, termination, etc."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border text-xs leading-relaxed"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Tenants will see this text under “Read terms” before they sign.
            </p>
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
