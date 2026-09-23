// src/components/dashboard/TenantsListView.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Search, PlusCircle, Edit3, Trash2, Users } from 'lucide-react';
import { auth } from '../../services/auth';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { shops as shopsApi } from '../../services/api/shops';
import { shoppingCenters as centersApi } from '../../services/api/shoppingCenters';
import type { Tenant, Shop, ShoppingCenter } from '../../types';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useToast } from '../ui/ToastProvider';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { AssignTenantModal } from '../management/AssignTenantModal';

export const TenantsListView: React.FC = () => {
  const toast = useToast();
  const orgId = auth.getCurrentOrganization()?.id;
  const [search, setSearch] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);

  const { data: tenants = [], isLoading, refetch } = useSupabaseQuery(
    ['tenants', orgId],
    () => tenantsApi.list(),
    { enabled: !!orgId }
  );
  const { data: shops = [], refetch: refetchShops } = useSupabaseQuery(
    ['shops', orgId],
    () => shopsApi.list(),
    { enabled: !!orgId }
  );
  const { data: centers = [] } = useSupabaseQuery(
    ['centers', orgId],
    () => centersApi.list(),
    { enabled: !!orgId }
  );

  const vacantShops = useMemo(
    () => shops.filter((s) => s.status === 'Available'),
    [shops]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.toLowerCase();
    return tenants.filter(
      (t) =>
        t.business_name?.toLowerCase().includes(q) ||
        t.contact_person?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.phone?.toLowerCase().includes(q)
    );
  }, [tenants, search]);

  const removeTenant = useSupabaseMutation({
    mutationFn: (id: string) => tenantsApi.remove(id),
    invalidateKeys: ['tenants', 'shops'],
    onSuccess: () => toast.success('Tenant removed'),
    onError: (e) => toast.error(e.message),
  });

  const handleDelete = async (t: Tenant) => {
    if (!confirm(`Remove tenant ${t.business_name}?`)) return;
    await removeTenant.mutate(t.id);
  };

  const openAssign = () => setShowAssign(true);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Tenants</h1>
          <p className="text-xs text-slate-500">
            Assign vacant units to businesses — portal login optional
          </p>
        </div>
        <button
          type="button"
          onClick={openAssign}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" /> Assign tenant
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tenants…"
          className="w-full pl-9 pr-3 py-2 rounded-xl border bg-white dark:bg-slate-800 text-xs"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="No tenants yet"
          message="Pick a vacant unit and assign a business in one step."
          action={
            <button
              type="button"
              onClick={openAssign}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
            >
              Assign tenant
            </button>
          }
        />
      ) : (
        <div className="rounded-2xl border overflow-hidden bg-white dark:bg-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Business</th>
                <th className="text-left px-4 py-2.5 font-semibold">Contact</th>
                <th className="text-left px-4 py-2.5 font-semibold">Unit</th>
                <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                <th className="text-right px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map((t) => {
                const shop = shops.find((s) => s.id === t.shop_id);
                return (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer"
                    onClick={() => setEditing(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setEditing(t);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    <td className="px-4 py-3 font-semibold">{t.business_name}</td>
                    <td className="px-4 py-3">
                      <div>{t.contact_person}</div>
                      <div className="text-slate-400">{t.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {shop ? `Unit ${shop.shop_number}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold">
                        {t.status}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setEditing(t)}
                        className="p-1.5 text-slate-500 hover:text-blue-600"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        className="p-1.5 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AssignTenantModal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        onAssigned={() => {
          setShowAssign(false);
          void refetch();
          void refetchShops();
        }}
        shop={null}
        vacantShops={vacantShops}
        centers={centers}
      />

      {editing && (
        <EditTenantModal
          open={!!editing}
          tenant={editing}
          shops={shops}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
};

/** Edit existing tenant only — no unit reassignment / portal creation here. */
function EditTenantModal({
  open,
  tenant,
  shops,
  onClose,
  onSaved,
}: {
  open: boolean;
  tenant: Tenant;
  shops: Shop[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [businessName, setBusinessName] = useState(tenant.business_name ?? '');
  const [contactPerson, setContactPerson] = useState(tenant.contact_person ?? '');
  const [email, setEmail] = useState(tenant.email ?? '');
  const [phone, setPhone] = useState(tenant.phone ?? '');
  const [status, setStatus] = useState(tenant.status ?? 'Active');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusinessName(tenant.business_name ?? '');
    setContactPerson(tenant.contact_person ?? '');
    setEmail(tenant.email ?? '');
    setPhone(tenant.phone ?? '');
    setStatus(tenant.status ?? 'Active');
  }, [open, tenant]);

  const shop = shops.find((s) => s.id === tenant.shop_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await tenantsApi.update(tenant.id, {
        business_name: businessName.trim(),
        contact_person: contactPerson.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        status,
      });
      toast.success('Tenant updated');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit tenant" size="md">
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        {shop && (
          <p className="text-[11px] text-slate-500">
            Unit {shop.shop_number}
            {tenant.user_id ? ' · Portal linked' : ' · No portal login'}
          </p>
        )}
        <div>
          <label className="block font-semibold mb-1">Business name *</label>
          <input
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Contact person</label>
            <input
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
            />
          </div>
        </div>
        <div>
          <label className="block font-semibold mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Tenant['status'])}
            className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
          >
            <option value="Active">Active</option>
            <option value="Notice Given">Notice Given</option>
            <option value="Evicted">Evicted</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border font-semibold"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
