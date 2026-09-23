// src/components/dashboard/TenantsListView.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Search, PlusCircle, Edit3, Trash2 } from 'lucide-react';
import { auth } from '../../services/auth';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { shops as shopsApi } from '../../services/api/shops';
import { centers as centersApi } from '../../services/api/centers';
import { profiles as profilesApi } from '../../services/api/profiles';
import type { Tenant, Shop, ShoppingCenter, User } from '../../types';
import { useSupabaseQuery, useSupabaseMutation } from '../../hooks/useSupabaseQuery';
import { useToast } from '../ui/ToastProvider';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { PasswordInput } from '../ui/PasswordInput';
import { Users } from 'lucide-react';

export const TenantsListView: React.FC = () => {
  const toast = useToast();
  const orgId = auth.getCurrentOrganization()?.id;
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);

  const { data: tenants = [], isLoading, refetch } = useSupabaseQuery(
    ['tenants', orgId],
    () => tenantsApi.list(),
    { enabled: !!orgId }
  );
  const { data: shops = [] } = useSupabaseQuery(
    ['shops', orgId],
    () => shopsApi.list(),
    { enabled: !!orgId }
  );
  const { data: centers = [] } = useSupabaseQuery(
    ['centers', orgId],
    () => centersApi.list(),
    { enabled: !!orgId }
  );
  const { data: profiles = [] } = useSupabaseQuery(
    ['profiles', orgId],
    () => profilesApi.list(),
    { enabled: !!orgId }
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
    invalidateKeys: ['tenants'],
    onSuccess: () => toast.success('Tenant removed'),
    onError: (e) => toast.error(e.message),
  });

  const handleDelete = async (t: Tenant) => {
    if (!confirm(`Remove tenant ${t.business_name}?`)) return;
    await removeTenant.mutate(t.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Tenants</h1>
          <p className="text-xs text-slate-500">Manage tenant records and portal logins</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" /> Add tenant
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
          message="Add your first tenant to start managing leases and invoices."
          action={
            <button
              type="button"
              onClick={() => { setEditing(null); setShowModal(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
            >
              Add tenant
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
                    onClick={() => { setEditing(t); setShowModal(true); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setEditing(t);
                        setShowModal(true);
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
                    <td className="px-4 py-3">{shop ? `Unit ${shop.shop_number}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold">
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => { setEditing(t); setShowModal(true); }}
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

      {showModal && (
        <TenantForm
          open={showModal}
          initial={editing}
          shops={shops}
          centers={centers}
          profiles={profiles}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => { setShowModal(false); setEditing(null); void refetch(); }}
        />
      )}
    </div>
  );
};

function TenantForm({
  open,
  initial,
  shops,
  centers,
  profiles,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: Tenant | null;
  shops: Shop[];
  centers: ShoppingCenter[];
  profiles: User[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [businessName, setBusinessName] = useState(initial?.business_name ?? '');
  const [contactPerson, setContactPerson] = useState(initial?.contact_person ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [shopId, setShopId] = useState(initial?.shop_id ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'Active');
  const [createPortal, setCreatePortal] = useState(false);
  const [portalPassword, setPortalPassword] = useState('');
  const [portalUserId, setPortalUserId] = useState(initial?.user_id ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusinessName(initial?.business_name ?? '');
    setContactPerson(initial?.contact_person ?? '');
    setEmail(initial?.email ?? '');
    setPhone(initial?.phone ?? '');
    setShopId(initial?.shop_id ?? '');
    setStatus(initial?.status ?? 'Active');
    setCreatePortal(false);
    setPortalPassword('');
    setPortalUserId(initial?.user_id ?? '');
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        business_name: businessName.trim(),
        contact_person: contactPerson.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        shop_id: shopId || null,
        status,
      };
      if (createPortal && portalPassword) {
        payload.create_portal = true;
        payload.password = portalPassword;
      }
      if (portalUserId) payload.user_id = portalUserId;

      if (initial) {
        await tenantsApi.update(initial.id, payload as never);
        toast.success('Tenant updated');
      } else {
        await tenantsApi.create(payload as never);
        toast.success('Tenant created');
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const tenantProfiles = profiles.filter((p) => p.role === 'tenant');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit tenant' : 'Add tenant'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div>
          <label className="block font-semibold mb-1">Business name *</label>
          <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Contact person</label>
            <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" />
          </div>
        </div>
        <div>
          <label className="block font-semibold mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Unit</label>
            <select value={shopId} onChange={(e) => setShopId(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900">
              <option value="">— none —</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>Unit {s.shop_number}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Tenant['status'])} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900">
              <option value="Active">Active</option>
              <option value="Notice Given">Notice Given</option>
              <option value="Evicted">Evicted</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2">
          <label className="block font-semibold">Portal login</label>
          {initial?.user_id ? (
            <p className="text-slate-500">Linked to existing portal user.</p>
          ) : (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={createPortal} onChange={(e) => setCreatePortal(e.target.checked)} />
                <span>Create portal login for this tenant</span>
              </label>
              {createPortal && (
                <div>
                  <label className="block font-semibold mb-1">Portal password</label>
                  <PasswordInput
                    value={portalPassword}
                    onChange={(e) => setPortalPassword(e.target.value)}
                    required={createPortal}
                    minLength={8}
                    className="w-full"
                    placeholder="Min 8 characters"
                  />
                </div>
              )}
              <div>
                <label className="block font-semibold mb-1">Or link existing tenant user</label>
                <select value={portalUserId} onChange={(e) => setPortalUserId(e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900">
                  <option value="">— none —</option>
                  {tenantProfiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border font-semibold" disabled={submitting}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60">
            {submitting ? 'Saving…' : initial ? 'Save' : 'Create tenant'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
