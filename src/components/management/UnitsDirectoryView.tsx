import React, { useMemo, useState } from 'react';
import {
  Building2, PlusCircle, Search, Edit3, Trash2, X, CheckCircle2,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { shops as shopsApi } from '../../services/api/shops';
import { shoppingCenters as centersApi } from '../../services/api/shoppingCenters';
import { properties as propertiesApi } from '../../services/api/properties';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { Shop, UnitStatus, Property } from '../../types';

interface Props {
  onSelectShop?: (shop: Shop) => void;
}

export const UnitsDirectoryView: React.FC<Props> = ({ onSelectShop }) => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [selectedCenterId, setSelectedCenterId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);

  const { data: shops = [] } = useSupabaseQuery(['shops', orgId], () => shopsApi.list(), { enabled: !!orgId });
  const { data: centers = [] } = useSupabaseQuery(['centers', orgId], () => centersApi.list(), { enabled: !!orgId });
  const { data: properties = [] } = useSupabaseQuery(['properties', orgId], () => propertiesApi.list(), { enabled: !!orgId });

  useRealtime({ table: 'shops', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['shops'], enabled: !!orgId });

  const createShop = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof shopsApi.create>[0]) => shopsApi.create(input),
    invalidateKeys: ['shops'],
    onSuccess: (s) => { setFeedback(`Unit ${s.shop_number} created.`); setTimeout(() => setFeedback(''), 3000); setShowAddModal(false); },
  });
  const updateShop = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Shop> }) => shopsApi.update(id, patch),
    invalidateKeys: ['shops'],
    onSuccess: (s) => { setFeedback(`Unit ${s.shop_number} updated.`); setTimeout(() => setFeedback(''), 3000); setEditingShop(null); },
  });
  const deleteShop = useSupabaseMutation({
    mutationFn: (id: string) => shopsApi.remove(id),
    invalidateKeys: ['shops'],
    onSuccess: () => { setFeedback('Unit removed.'); setTimeout(() => setFeedback(''), 3000); },
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

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Units directory</h1>
          <p className="text-xs text-slate-500">Live occupancy, dimensions, leasing specs</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…" className="bg-transparent focus:outline-none text-xs w-32 sm:w-44" />
          </div>
          <select value={selectedCenterId} onChange={(e) => setSelectedCenterId(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border text-xs">
            <option value="all">All centers</option>
            {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4" /> Add unit
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((shop) => {
          const center = centers.find((c) => c.id === shop.shopping_center_id);
          return (
            <div key={shop.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base">Unit {shop.shop_number}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                      {shop.status}
                    </span>
                  </div>
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
                    <strong className="text-blue-600">E{shop.rental_amount.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
              <div className="pt-2 flex items-center gap-2">
                <button onClick={() => onSelectShop?.(shop)}
                  className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold">
                  Details
                </button>
                <button onClick={() => setEditingShop(shop)}
                  className="p-2 rounded-xl border text-slate-600 hover:bg-slate-100">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { if (confirm(`Delete Unit ${shop.shop_number}?`)) deleteShop.mutate(shop.id); }}
                  className="p-2 rounded-xl border text-red-500 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <ShopForm
          centers={centers}
          properties={properties}
          initial={null}
          onCancel={() => setShowAddModal(false)}
          onSubmit={(input) => createShop.mutate(input as never)}
        />
      )}
      {editingShop && (
        <ShopForm
          centers={centers}
          properties={properties}
          initial={editingShop}
          onCancel={() => setEditingShop(null)}
          onSubmit={(input) =>
            updateShop.mutate({ id: editingShop.id, patch: input as never })
          }
        />
      )}
    </div>
  );
};

// ---- inline add/edit form ----
function ShopForm({
  centers, properties, initial, onCancel, onSubmit,
}: {
  centers: { id: string; name: string }[];
  properties: { id: string; shopping_center_id: string; name: string }[];
  initial: Shop | null;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    shop_number: initial?.shop_number ?? `G-${Math.floor(20 + Math.random() * 30)}`,
    shopping_center_id: initial?.shopping_center_id ?? centers[0]?.id ?? '',
    property_id: initial?.property_id ?? '',
    floor: initial?.floor ?? 'Ground Floor',
    size_sqm: initial?.size_sqm ?? 75,
    rental_amount: initial?.rental_amount ?? 16500,
    deposit_amount: initial?.deposit_amount ?? 33000,
    status: (initial?.status ?? 'Available') as UnitStatus,
    public_listing: false,
    property_type: (initial?.property_type ?? 'Retail shop') as Property['type'],
    description: initial?.description ?? '',
  });

  const availableProps = properties.filter((p) => p.shopping_center_id === form.shopping_center_id);
  const effectivePropertyId = form.property_id || availableProps[0]?.id || '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{initial ? `Edit Unit ${initial.shop_number}` : 'Add Unit'}</h3>
          <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ ...form, property_id: effectivePropertyId, size_sqm: Number(form.size_sqm), rental_amount: Number(form.rental_amount), deposit_amount: Number(form.deposit_amount) });
        }} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Unit number *</label>
              <input required value={form.shop_number} onChange={(e) => setForm({ ...form, shop_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Center *</label>
              <select value={form.shopping_center_id}
                onChange={(e) => setForm({ ...form, shopping_center_id: e.target.value, property_id: '' })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Type</label>
              <select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value as Property['type'] })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
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
              <input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Size (m²)</label>
              <input type="number" required value={form.size_sqm}
                onChange={(e) => setForm({ ...form, size_sqm: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Rent (E)</label>
              <input type="number" required value={form.rental_amount}
                onChange={(e) => setForm({ ...form, rental_amount: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Deposit (E)</label>
              <input type="number" required value={form.deposit_amount}
                onChange={(e) => setForm({ ...form, deposit_amount: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as UnitStatus })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
              <option>Available</option><option>Occupied</option>
              <option>Reserved</option><option>Under Maintenance</option>
            </select>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <button type="button" onClick={onCancel}
              className="px-4 py-2 rounded-xl border text-slate-600">Cancel</button>
            <button type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
              {initial ? 'Save changes' : 'Create unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
