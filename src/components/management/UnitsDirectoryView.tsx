import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, PlusCircle, Search, Edit3, Trash2, AlertCircle, UserPlus,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { shops as shopsApi } from '../../services/api/shops';
import { shoppingCenters as centersApi } from '../../services/api/shoppingCenters';
import { properties as propertiesApi } from '../../services/api/properties';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { Shop, UnitStatus, Property } from '../../types';
import { Modal } from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/ToastProvider';
import { formatMoney, parseMoney, MONEY_INPUT_PROPS } from '../../lib/money';
import { EmptyState } from '../ui/EmptyState';
import { AssignTenantModal } from './AssignTenantModal';

interface Props {
  onSelectShop?: (shop: Shop) => void;
}

export const UnitsDirectoryView: React.FC<Props> = ({ onSelectShop }) => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const toast = useToast();
  const { confirm } = useConfirm();

  const [selectedCenterId, setSelectedCenterId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [assignShop, setAssignShop] = useState<Shop | null>(null);
  const [detailShop, setDetailShop] = useState<Shop | null>(null);

  const { data: shops = [], refetch: refetchShops } = useSupabaseQuery(['shops', orgId], () => shopsApi.list(), { enabled: !!orgId });
  const { data: centers = [] } = useSupabaseQuery(['centers', orgId], () => centersApi.list(), { enabled: !!orgId });
  const { data: properties = [] } = useSupabaseQuery(['properties', orgId], () => propertiesApi.list(), { enabled: !!orgId });

  useRealtime({ table: 'shops', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['shops'], enabled: !!orgId });

  const createShop = useSupabaseMutation({
    mutationFn: async (input: Parameters<typeof shopsApi.create>[0]) => {
      if (!input.shopping_center_id) throw new Error('Select a centre before creating a unit.');
      let propertyId = input.property_id;
      if (!propertyId) {
        const centerName = centers.find((c) => c.id === input.shopping_center_id)?.name ?? 'Centre';
        const prop = await propertiesApi.create({
          shopping_center_id: input.shopping_center_id,
          name: `${centerName} — main building`,
          type: input.property_type || 'Retail shop',
          address: '',
          description: 'Auto-created when adding a unit',
        });
        propertyId = prop.id;
      }
      return shopsApi.create({ ...input, property_id: propertyId });
    },
    invalidateKeys: ['shops', 'properties'],
    onSuccess: (s) => {
      toast.success('Unit created', `Unit ${s.shop_number} is now in the directory.`);
      setShowAddModal(false);
    },
    onError: (e) => toast.error('Could not create unit', e.message),
  });

  const updateShop = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Shop> }) => shopsApi.update(id, patch),
    invalidateKeys: ['shops'],
    onSuccess: (s) => {
      toast.success('Unit updated', `Unit ${s.shop_number}`);
      setEditingShop(null);
    },
    onError: (e) => toast.error('Could not update unit', e.message),
  });

  const deleteShop = useSupabaseMutation({
    mutationFn: (id: string) => shopsApi.remove(id),
    invalidateKeys: ['shops'],
  });

  const filtered = useMemo(() => shops.filter((s) => {
    if (selectedCenterId !== 'all' && s.shopping_center_id !== selectedCenterId) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.shop_number.toLowerCase().includes(q) && !s.property_type.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [shops, selectedCenterId, statusFilter, search]);

  const handleDelete = async (shop: Shop) => {
    const ok = await confirm({
      title: `Delete Unit ${shop.shop_number}?`,
      message: 'Tenants and leases attached to this unit will become orphaned.',
      confirmLabel: 'Delete unit',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteShop.mutate(shop.id);
      toast.success('Unit removed');
    } catch (e) {
      toast.error('Delete failed', e instanceof Error ? e.message : 'Could not remove unit.');
    }
  };

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Units directory</h1>
          <p className="text-xs text-slate-500">Live occupancy, dimensions, leasing specs</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="bg-transparent focus:outline-none text-xs w-32 sm:w-44" />
          </div>
          <select value={selectedCenterId} onChange={(e) => setSelectedCenterId(e.target.value)} className="px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border text-xs">
            <option value="all">All centers</option>
            {centers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <button type="button" onClick={() => setShowAddModal(true)} disabled={centers.length === 0} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4" /> Add unit
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <EmptyState icon={<Building2 className="w-6 h-6" />} title="No units match your filters" message="Try widening the filters, or add a new unit." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((shop) => {
            const center = centers.find((c) => c.id === shop.shopping_center_id);
            return (
              <div key={shop.id} className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base">Unit {shop.shop_number}</span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">{shop.status}</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" /> {center?.name} • {shop.floor}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Type & size</span>
                      <strong>{shop.property_type} ({shop.size_sqm} m²)</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Rent</span>
                      <strong className="text-blue-600">{formatMoney(shop.rental_amount)}</strong>
                    </div>
                  </div>
                </div>
                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  {shop.status === 'Available' && (
                    <button type="button" onClick={() => setAssignShop(shop)} className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" /> Assign Tenant
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setDetailShop(shop); onSelectShop?.(shop); }}
                    className={`${shop.status === 'Available' ? '' : 'flex-1 '}py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold`}
                  >
                    Details
                  </button>
                  <button type="button" onClick={() => setEditingShop(shop)} className="p-2 rounded-xl border text-slate-600 hover:bg-slate-100" title="Edit unit">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => handleDelete(shop)} className="p-2 rounded-xl border text-red-500 hover:bg-red-50" title="Delete unit">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ShopForm open={showAddModal} centers={centers} properties={properties} initial={null} submitting={createShop.loading} formError={createShop.error?.message ?? null} onCancel={() => setShowAddModal(false)} onSubmit={(input) => { void createShop.mutate(input as Parameters<typeof shopsApi.create>[0]); }} />
      <ShopForm open={!!editingShop} centers={centers} properties={properties} initial={editingShop} submitting={updateShop.loading} formError={updateShop.error?.message ?? null} onCancel={() => setEditingShop(null)} onSubmit={(input) => { if (!editingShop) return; void updateShop.mutate({ id: editingShop.id, patch: input as never }); }} />

      {detailShop && (
        <Modal open onClose={() => setDetailShop(null)} title={`Unit ${detailShop.shop_number}`} size="md">
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Status</div><div className="font-semibold mt-0.5">{detailShop.status}</div></div>
              <div><div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Floor</div><div className="font-semibold mt-0.5">{detailShop.floor || '—'}</div></div>
              <div><div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Size</div><div className="font-semibold mt-0.5">{detailShop.size_sqm ? `${detailShop.size_sqm} m²` : '—'}</div></div>
              <div><div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Monthly rent</div><div className="font-semibold mt-0.5">{formatMoney(detailShop.rental_amount)}</div></div>
              <div><div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Deposit</div><div className="font-semibold mt-0.5">{formatMoney(detailShop.deposit_amount)}</div></div>
              <div><div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Type</div><div className="font-semibold mt-0.5">{detailShop.property_type || '—'}</div></div>
            </div>
            {detailShop.description && (
              <div><div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Description</div><p className="mt-0.5 text-slate-600 dark:text-slate-300">{detailShop.description}</p></div>
            )}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {detailShop.status === 'Available' && (
                <button type="button" onClick={() => { setAssignShop(detailShop); setDetailShop(null); }} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Assign tenant</button>
              )}
              <button type="button" onClick={() => { setEditingShop(detailShop); setDetailShop(null); }} className="px-3 py-2 rounded-xl border text-xs font-bold">Edit unit</button>
              <button type="button" onClick={() => setDetailShop(null)} className="px-3 py-2 rounded-xl border text-xs font-bold ml-auto">Close</button>
            </div>
          </div>
        </Modal>
      )}

      <AssignTenantModal open={!!assignShop} onClose={() => setAssignShop(null)} onAssigned={() => { setAssignShop(null); void refetchShops(); }} shop={assignShop} vacantShops={shops.filter((s) => s.status === 'Available')} centers={centers} />
    </div>
  );
};

function ShopForm({
  open, centers, properties, initial, submitting = false, formError = null, onCancel, onSubmit,
}: {
  open: boolean;
  centers: { id: string; name: string }[];
  properties: { id: string; shopping_center_id: string; name: string }[];
  initial: Shop | null;
  submitting?: boolean;
  formError?: string | null;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    shop_number: initial?.shop_number ?? `G-${Math.floor(20 + Math.random() * 30)}`,
    shopping_center_id: initial?.shopping_center_id ?? centers[0]?.id ?? '',
    property_id: initial?.property_id ?? '',
    floor: initial?.floor ?? 'Ground Floor',
    size_sqm: initial?.size_sqm ?? 75,
    rental_amount: initial?.rental_amount != null ? String(initial.rental_amount) : '',
    deposit_amount: initial?.deposit_amount != null ? String(initial.deposit_amount) : '',
    status: (initial?.status ?? 'Available') as UnitStatus,
    public_listing: false,
    property_type: (initial?.property_type ?? 'Retail shop') as Property['type'],
    description: initial?.description ?? '',
  });
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setForm({
      shop_number: initial?.shop_number ?? `G-${Math.floor(20 + Math.random() * 30)}`,
      shopping_center_id: initial?.shopping_center_id ?? centers[0]?.id ?? '',
      property_id: initial?.property_id ?? '',
      floor: initial?.floor ?? 'Ground Floor',
      size_sqm: initial?.size_sqm ?? 75,
      rental_amount: initial?.rental_amount != null ? String(initial.rental_amount) : '',
      deposit_amount: initial?.deposit_amount != null ? String(initial.deposit_amount) : '',
      status: (initial?.status ?? 'Available') as UnitStatus,
      public_listing: false,
      property_type: (initial?.property_type ?? 'Retail shop') as Property['type'],
      description: initial?.description ?? '',
    });
  }, [open, initial?.id, centers]);

  const availableProps = properties.filter((p) => p.shopping_center_id === form.shopping_center_id);
  const effectivePropertyId = form.property_id || availableProps[0]?.id || '';

  return (
    <Modal open={open} onClose={onCancel} size="md" title={initial ? `Edit Unit ${initial.shop_number}` : 'Add Unit'}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLocalError(null);
          if (!form.shopping_center_id) { setLocalError('Select a shopping centre.'); return; }
          if (!form.shop_number.trim()) { setLocalError('Unit number is required.'); return; }
          onSubmit({
            ...form,
            property_id: effectivePropertyId,
            size_sqm: Number(form.size_sqm),
            rental_amount: parseMoney(form.rental_amount),
            deposit_amount: parseMoney(form.deposit_amount),
          });
        }}
        className="space-y-3 text-xs"
      >
        {(localError || formError) && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-800 dark:text-red-300 text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{localError || formError}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Unit number *</label>
            <input required value={form.shop_number} onChange={(e) => setForm({ ...form, shop_number: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Center *</label>
            <select required value={form.shopping_center_id} onChange={(e) => setForm({ ...form, shopping_center_id: e.target.value, property_id: '' })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
              {centers.length === 0 && <option value="">No centres</option>}
              {centers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold mb-1">Type</label>
            <select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value as Property['type'] })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
              <option value="Retail shop">Retail</option>
              <option value="Office">Office</option>
              <option value="Restaurant">Restaurant</option>
              <option value="Kiosk">Kiosk</option>
              <option value="Warehouse">Warehouse</option>
              <option value="Commercial unit">Commercial</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Floor</label>
            <input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Size (m²)</label>
            <input type="number" required min={1} value={form.size_sqm} onChange={(e) => setForm({ ...form, size_sqm: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Rent (E)</label>
            <input {...MONEY_INPUT_PROPS} required placeholder="0.00" value={form.rental_amount} onChange={(e) => setForm({ ...form, rental_amount: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Deposit (E)</label>
            <input {...MONEY_INPUT_PROPS} required placeholder="0.00" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          </div>
        </div>
        <div>
          <label className="block font-semibold mb-1">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as UnitStatus })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
            <option>Available</option>
            <option>Occupied</option>
            <option>Reserved</option>
            <option>Under Maintenance</option>
          </select>
        </div>
        <div className="pt-3 flex justify-end gap-2 border-t">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border" disabled={submitting}>Cancel</button>
          <button type="submit" disabled={submitting || centers.length === 0} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50">{submitting ? 'Saving…' : initial ? 'Save changes' : 'Create unit'}</button>
        </div>
      </form>
    </Modal>
  );
}
