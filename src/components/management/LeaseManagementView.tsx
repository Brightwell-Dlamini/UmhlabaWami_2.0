import React, { useEffect, useMemo, useState } from 'react';
import { FileBadge, Edit3, Trash2, ShieldCheck } from 'lucide-react';
import { auth } from '../../services/auth';
import { leases as leasesApi } from '../../services/api/leases';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { shops as shopsApi } from '../../services/api/shops';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { Lease } from '../../types';
import { Modal } from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/ToastProvider';
import { EntityAuditTrail } from '../audit/EntityAuditTrail';

export const LeaseManagementView: React.FC = () => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const user = auth.getCurrentUser();
  const isTenant = user?.role === 'tenant';
  const canManage = !isTenant;
  const toast = useToast();
  const { confirm } = useConfirm();

  const [showDraft, setShowDraft] = useState(false);
  const [editing, setEditing] = useState<Lease | null>(null);
  const [reading, setReading] = useState<Lease | null>(null);

  const { data: leases = [] } = useSupabaseQuery(
    ['leases', orgId],
    () => leasesApi.list(),
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

  useRealtime({
    table: 'leases',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['leases'],
    enabled: !!orgId,
  });

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
      (user.shop_id
        ? tenants.find((t) => t.shop_id === user.shop_id)
        : undefined)
    );
  }, [tenants, user]);

  const visibleLeases = useMemo(() => {
    if (!isTenant) return leases;
    if (!myTenant) return [];
    return leases.filter((l) => l.tenant_id === myTenant.id);
  }, [leases, isTenant, myTenant]);

  const create = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof leasesApi.create>[0]) =>
      leasesApi.create(input),
    invalidateKeys: ['leases'],
    onSuccess: () => {
      toast.success('Lease created');
      setShowDraft(false);
    },
    onError: (e) => toast.error('Create failed', e.message),
  });
  const update = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Lease> }) =>
      leasesApi.update(id, patch),
    invalidateKeys: ['leases'],
    onSuccess: () => {
      toast.success('Lease updated');
      setEditing(null);
    },
    onError: (e) => toast.error('Save failed', e.message),
  });
  const remove = useSupabaseMutation({
    mutationFn: (id: string) => leasesApi.remove(id),
    invalidateKeys: ['leases'],
  });
  const sign = useSupabaseMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      leasesApi.sign(id, name),
    invalidateKeys: ['leases'],
    onSuccess: () => toast.success('Lease signed'),
    onError: (e) => toast.error('Sign failed', e.message),
  });

  const handleDelete = async (l: Lease) => {
    const ok = await confirm({
      title: 'Delete this lease?',
      message:
        'The tenant loses access to the terms and the signed certificate. This cannot be undone.',
      confirmLabel: 'Delete lease',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await remove.mutate(l.id);
      toast.success('Lease removed');
    } catch (e) {
      toast.error(
        'Delete failed',
        e instanceof Error ? e.message : 'Could not remove lease.'
      );
    }
  };

  if (!orgId) {
    return (
      <div className="p-6 text-slate-500 text-sm">No organisation context.</div>
    );
  }

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
                  <td
                    colSpan={isTenant ? 7 : 8}
                    className="p-8 text-center text-slate-400 text-xs"
                  >
                    {isTenant
                      ? 'No lease on file for you yet.'
                      : 'No leases yet.'}
                  </td>
                </tr>
              ) : (
                visibleLeases.map((l) => {
                  const tenant = tenants.find((t) => t.id === l.tenant_id);
                  const shop = shops.find((s) => s.id === l.shop_id);
                  return (
                    <tr
                      key={l.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30"
                    >
                      {!isTenant && (
                        <td className="px-4 py-3">
                          <div className="font-bold">
                            {tenant?.business_name ?? '—'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {tenant?.contact_person}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-[11px]">
                        Unit {shop?.shop_number ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {l.start_date} → {l.end_date}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        E{l.rental_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        E{(l.deposit ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {l.is_digitally_signed ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" />{' '}
                            {l.signer_name ?? 'Signed'}
                          </span>
                        ) : isTenant ? (
                          <button
                            onClick={() =>
                              sign.mutate({
                                id: l.id,
                                name:
                                  user?.name ??
                                  tenant?.contact_person ??
                                  'Tenant',
                              })
                            }
                            className="text-[11px] font-bold text-blue-600 hover:underline"
                            type="button"
                          >
                            Sign now
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            Awaiting tenant signature
                          </span>
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
                                onClick={() => handleDelete(l)}
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

      <LeaseTermsModal
        open={!!reading}
        lease={reading}
        tenant={
          reading ? tenants.find((t) => t.id === reading.tenant_id) : undefined
        }
        shop={reading ? shops.find((s) => s.id === reading.shop_id) : undefined}
        onClose={() => setReading(null)}
      />

      {canManage && (
        <LeaseForm
          open={showDraft || !!editing}
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
  open,
  lease,
  tenant,
  shop,
  onClose,
}: {
  open: boolean;
  lease: Lease | null;
  tenant?: { business_name: string; contact_person: string };
  shop?: { shop_number: string };
  onClose: () => void;
}) {
  if (!lease) {
    return (
      <Modal open={false} onClose={onClose}>
        <div />
      </Modal>
    );
  }

  const raw =
    (lease as Lease & { terms_body?: string }).terms_body ||
    lease.document_url ||
    '';
  const terms = raw.startsWith('terms:\n') ? raw.slice(7) : raw;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={lease.document_title}
      subtitle={`${tenant?.business_name ?? 'Tenant'} · Unit ${
        shop?.shop_number ?? '—'
      } · ${lease.start_date} → ${lease.end_date}`}
    >
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
            <div className="text-[10px] uppercase text-slate-400 font-semibold">
              Monthly rent
            </div>
            <div className="font-bold mt-0.5">
              E{lease.rental_amount.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
            <div className="text-[10px] uppercase text-slate-400 font-semibold">
              Deposit
            </div>
            <div className="font-bold mt-0.5">
              E{(lease.deposit ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
            <div className="text-[10px] uppercase text-slate-400 font-semibold">
              Status
            </div>
            <div className="font-bold mt-0.5">{lease.renewal_status}</div>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Lease terms
          </h4>
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

        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <EntityAuditTrail entityId={lease.id} entityType="lease" />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LeaseForm({
  open,
  tenants,
  shops,
  initial,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  tenants: {
    id: string;
    business_name: string;
    contact_person: string;
    shop_id: string;
  }[];
  shops: {
    id: string;
    shop_number: string;
    rental_amount: number;
    deposit_amount: number;
  }[];
  initial: Lease | null;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    tenant_id: initial?.tenant_id ?? tenants[0]?.id ?? '',
    shop_id: initial?.shop_id ?? tenants[0]?.shop_id ?? shops[0]?.id ?? '',
    start_date: initial?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date:
      initial?.end_date ??
      new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    rental_amount: initial?.rental_amount ?? 15000,
    deposit: initial?.deposit ?? 30000,
    renewal_status: (initial?.renewal_status ??
      'Active') as Lease['renewal_status'],
    document_title: initial?.document_title ?? '',
    terms_body: initial?.terms_body ?? '',
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      tenant_id: initial?.tenant_id ?? tenants[0]?.id ?? '',
      shop_id: initial?.shop_id ?? tenants[0]?.shop_id ?? shops[0]?.id ?? '',
      start_date: initial?.start_date ?? new Date().toISOString().slice(0, 10),
      end_date:
        initial?.end_date ??
        new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      rental_amount: initial?.rental_amount ?? 15000,
      deposit: initial?.deposit ?? 30000,
      renewal_status: (initial?.renewal_status ??
        'Active') as Lease['renewal_status'],
      document_title: initial?.document_title ?? '',
      terms_body: initial?.terms_body ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="md"
      title={initial ? 'Edit lease' : 'Draft lease'}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ ...form });
        }}
        className="space-y-3 text-xs"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Tenant *</label>
            <select
              value={form.tenant_id}
              onChange={(e) => {
                const t = tenants.find((x) => x.id === e.target.value);
                setForm({
                  ...form,
                  tenant_id: e.target.value,
                  shop_id: t?.shop_id ?? form.shop_id,
                });
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.business_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Unit</label>
            <select
              value={form.shop_id}
              onChange={(e) => {
                const s = shops.find((x) => x.id === e.target.value);
                setForm({
                  ...form,
                  shop_id: e.target.value,
                  rental_amount: s?.rental_amount ?? form.rental_amount,
                  deposit: s?.deposit_amount ?? form.deposit,
                });
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  Unit {s.shop_number}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Start date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">End date</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Rent (E)</label>
            <input
              type="number"
              required
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.rental_amount}
              onChange={(e) =>
                setForm({ ...form, rental_amount: Number(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Deposit (E)</label>
            <input
              type="number"
              required
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.deposit}
              onChange={(e) =>
                setForm({ ...form, deposit: Number(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
            />
          </div>
        </div>
        <div>
          <label className="block font-semibold mb-1">Status</label>
          <select
            value={form.renewal_status}
            onChange={(e) =>
              setForm({
                ...form,
                renewal_status: e.target.value as Lease['renewal_status'],
              })
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          >
            <option value="Active">Active</option>
            <option value="Pending Renewal">Pending Renewal</option>
            <option value="Renewed">Renewed</option>
            <option value="Expired">Expired</option>
            <option value="Terminated">Terminated</option>
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Document title</label>
          <input
            value={form.document_title}
            onChange={(e) => setForm({ ...form, document_title: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Terms</label>
          <textarea
            rows={5}
            value={form.terms_body}
            onChange={(e) => setForm({ ...form, terms_body: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          />
        </div>
        <div className="pt-3 flex justify-end gap-2 border-t">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">
            {initial ? 'Save changes' : 'Create lease'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
