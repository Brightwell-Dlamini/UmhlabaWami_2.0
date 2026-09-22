import React, { useMemo, useState } from 'react';
import {
  Users, Search, PlusCircle, CheckCircle2, Edit3, Trash2, X,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { shops as shopsApi } from '../../services/api/shops';
import { shoppingCenters as centersApi } from '../../services/api/shoppingCenters';
import { properties as propertiesApi } from '../../services/api/properties';
import { profiles as profilesApi } from '../../services/api/profiles';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { Tenant } from '../../types';

interface Props {
  onOpenCreateTicketForShop?: (shopId: string) => void;
  onViewLeases?: () => void;
}

export const TenantsListView: React.FC<Props> = ({ onOpenCreateTicketForShop, onViewLeases }) => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedCenter, setSelectedCenter] = useState('All');
  const [feedback, setFeedback] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);

  const { data: tenants = [] } = useSupabaseQuery(['tenants', orgId], () => tenantsApi.list(), { enabled: !!orgId });
  const { data: shops = [] } = useSupabaseQuery(['shops', orgId], () => shopsApi.list(), { enabled: !!orgId });
  const { data: centers = [] } = useSupabaseQuery(['centers', orgId], () => centersApi.list(), { enabled: !!orgId });
  const { data: properties = [] } = useSupabaseQuery(['properties', orgId], () => propertiesApi.list(), { enabled: !!orgId });
  const { data: portalUsers = [] } = useSupabaseQuery(
    ['profiles', orgId, 'tenant_role'],
    () => profilesApi.list(orgId).then((list) => list.filter((u) => u.role === 'tenant')),
    { enabled: !!orgId }
  );

  useRealtime({ table: 'tenants', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['tenants', 'shops'], enabled: !!orgId });

  const create = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof tenantsApi.create>[0]) => tenantsApi.create(input),
    invalidateKeys: ['tenants', 'shops', 'profiles'],
    onSuccess: (t) => { setFeedback(`Tenant "${t.business_name}" registered.`); setTimeout(() => setFeedback(''), 3000); setShowAdd(false); },
    onError: (e) => { setFeedback(`Failed: ${e.message}`); setTimeout(() => setFeedback(''), 6000); },
  });
  const update = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Tenant> }) => tenantsApi.update(id, patch),
    invalidateKeys: ['tenants'],
    onSuccess: () => { setFeedback('Tenant updated.'); setTimeout(() => setFeedback(''), 3000); setEditing(null); },
  });
  const remove = useSupabaseMutation({
    mutationFn: (id: string) => tenantsApi.remove(id),
    invalidateKeys: ['tenants', 'shops'],
    onSuccess: () => { setFeedback('Tenant removed.'); setTimeout(() => setFeedback(''), 3000); },
  });

  const filtered = useMemo(() => tenants.filter((t) => {
    if (statusFilter !== 'All' && t.status !== statusFilter) return false;
    if (selectedCenter !== 'All' && t.shopping_center_id !== selectedCenter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.business_name.toLowerCase().includes(q) ||
        t.contact_person.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q)
      );
    }
    return true;
  }), [tenants, statusFilter, selectedCenter, search]);

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Commercial tenants</h1>
          <p className="text-xs text-slate-500">Occupancies, lease links, portal login — create both in one step</p>
        </div>
        <div className="flex items-center gap-2">
          {onViewLeases && (
            <button onClick={onViewLeases} type="button"
              className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 rounded-xl text-xs font-semibold">
              Manage leases
            </button>
          )}
          <button onClick={() => setShowAdd(true)} type="button"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4" /> Add tenant
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
          /fail/i.test(feedback) ? 'bg-red-50 border-red-300 text-red-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800'
        }`}>
          <CheckCircle2 className="w-4 h-4" /> {feedback}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total tenants', value: tenants.length },
          { label: 'Active', value: tenants.filter((t) => t.status === 'Active').length },
          { label: 'Notice given', value: tenants.filter((t) => t.status === 'Notice Given').length },
          {
            label: 'Monthly bill',
            value: `E ${tenants.reduce((s, t) => {
              const shop = shops.find((sh) => sh.id === t.shop_id);
              return s + (shop?.rental_amount || 0);
            }, 0).toLocaleString()}`,
          },
        ].map((c) => (
          <div key={c.label} className="p-4 rounded-xl bg-white dark:bg-slate-800 border">
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className="text-xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business, contact, phone…"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border" />
        </div>
        <select value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border">
          <option value="All">All centers</option>
          {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border">
          <option value="All">All statuses</option>
          <option>Active</option><option>Notice Given</option><option>Pending</option><option>Evicted</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 text-[10px] uppercase">
              <tr>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Rent</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Portal</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((t) => {
                const shop = shops.find((s) => s.id === t.shop_id);
                const center = centers.find((c) => c.id === t.shopping_center_id);
                const linked = t.user_id ? portalUsers.find((u) => u.id === t.user_id) : undefined;
                return (
                  <tr key={t.id} onClick={() => setEditing(t)}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 cursor-pointer">
                    <td className="py-3 px-4">
                      <div className="font-bold">{t.business_name}</div>
                      <div className="text-[11px] text-slate-400">{t.contact_person}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-[11px]">{shop?.shop_number ?? '—'}</div>
                      <div className="text-[10px] text-slate-400">{center?.name}</div>
                    </td>
                    <td className="py-3 px-4">{t.trade_type}</td>
                    <td className="py-3 px-4">
                      <div className="text-[11px]">{t.phone}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[160px]">{t.email}</div>
                    </td>
                    <td className="py-3 px-4 font-bold">E {(shop?.rental_amount ?? 0).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        t.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800'
                      }`}>{t.status}</span>
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      {linked ? (
                        <span className="text-emerald-600 font-semibold">{linked.name}</span>
                      ) : (
                        <span className="text-slate-400">Not linked</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setEditing(t)} type="button"
                          className="p-1.5 rounded-lg border text-slate-600 hover:bg-slate-100">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {onOpenCreateTicketForShop && shop && (
                          <button onClick={() => onOpenCreateTicketForShop(shop.id)} type="button"
                            className="px-2 py-1 text-[10px] font-bold bg-blue-50 text-blue-600 rounded-lg">
                            Log issue
                          </button>
                        )}
                        <button onClick={() => { if (confirm(`Remove tenant ${t.business_name}?`)) remove.mutate(t.id); }} type="button"
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

      {(showAdd || editing) && (
        <TenantForm
          centers={centers}
          shops={shops}
          properties={properties}
          portalUsers={portalUsers}
          initial={editing}
          onCancel={() => { setShowAdd(false); setEditing(null); }}
          onSubmit={(input) => {
            if (editing) update.mutate({ id: editing.id, patch: input as never });
            else create.mutate(input as never);
          }}
        />
      )}
    </div>
  );
};

function TenantForm({
  centers, shops, properties, portalUsers, initial, onCancel, onSubmit,
}: {
  centers: { id: string; name: string }[];
  shops: { id: string; shop_number: string; shopping_center_id: string; property_id: string; rental_amount: number }[];
  properties: { id: string; name: string }[];
  portalUsers: { id: string; name: string; email: string; username?: string }[];
  initial: Tenant | null;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    business_name: initial?.business_name ?? '',
    contact_person: initial?.contact_person ?? '',
    phone: initial?.phone ?? '+268 ',
    email: initial?.email ?? '',
    trade_type: initial?.trade_type ?? 'Retail',
    shopping_center_id: initial?.shopping_center_id ?? centers[0]?.id ?? '',
    shop_id: initial?.shop_id ?? '',
    status: initial?.status ?? 'Active',
    user_id: initial?.user_id ?? '',
  });
  const [createPortal, setCreatePortal] = useState(false);
  const [portalPassword, setPortalPassword] = useState('');
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const availableShops = shops.filter((s) => s.shopping_center_id === form.shopping_center_id);
  const effectiveShopId = form.shop_id || availableShops[0]?.id || '';
  const shop = shops.find((s) => s.id === effectiveShopId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{initial ? 'Edit tenant' : 'Register tenant'}</h3>
          <button type="button" onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setPortalError(null);
          let linkedUserId = form.user_id || undefined;
          if (createPortal && !linkedUserId) {
            if (!form.email) {
              setPortalError('Email is required to create a portal login.');
              return;
            }
            setPortalBusy(true);
            try {
              const result = await profilesApi.addStaff({
                email: form.email,
                name: form.contact_person || form.business_name,
                role: 'tenant',
                phone: form.phone || undefined,
                password: portalPassword || undefined,
              });
              linkedUserId = result.userId;
            } catch (err) {
              setPortalError(err instanceof Error ? err.message : 'Failed to create portal login.');
              setPortalBusy(false);
              return;
            }
            setPortalBusy(false);
          }
          onSubmit({
            ...form,
            shop_id: effectiveShopId,
            property_id: shop?.property_id ?? '',
            user_id: linkedUserId,
          });
        }} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Business name *</label>
              <input required value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Contact person *</label>
              <input required value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Email</label>
              <input type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Trade type</label>
              <input value={form.trade_type}
                onChange={(e) => setForm({ ...form, trade_type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Status</label>
              <select value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Tenant['status'] })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                <option>Active</option><option>Pending</option>
                <option>Notice Given</option><option>Evicted</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Center</label>
              <select value={form.shopping_center_id}
                onChange={(e) => setForm({ ...form, shopping_center_id: e.target.value, shop_id: '' })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Unit</label>
              <select value={effectiveShopId}
                onChange={(e) => setForm({ ...form, shop_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                {availableShops.map((s) => (
                  <option key={s.id} value={s.id}>
                    Unit {s.shop_number} — E{s.rental_amount.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Linked portal login (role = tenant)</label>
            <select value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
              <option value="">— not linked —</option>
              {portalUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email || u.username || u.id.slice(0, 8)})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Link an existing portal user, or create one below in the same step.
            </p>
            {!initial && (
              <div className="mt-3 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input type="checkbox" checked={createPortal}
                    onChange={(e) => setCreatePortal(e.target.checked)} className="rounded" />
                  Create portal login now (role = tenant)
                </label>
                {createPortal && (
                  <div>
                    <label className="block text-[10px] font-semibold mb-1">Temporary password (optional)</label>
                    <input type="password" value={portalPassword}
                      onChange={(e) => setPortalPassword(e.target.value)}
                      placeholder="Leave blank to auto-generate"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border text-xs" />
                    <p className="text-[10px] text-slate-400 mt-1">Uses the email and contact name above.</p>
                  </div>
                )}
                {portalError && (
                  <div className="text-[11px] text-red-600 font-semibold">{portalError}</div>
                )}
              </div>
            )}
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">Cancel</button>
            <button type="submit" disabled={portalBusy}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold">
              {portalBusy ? 'Creating…' : initial ? 'Save' : 'Create tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
