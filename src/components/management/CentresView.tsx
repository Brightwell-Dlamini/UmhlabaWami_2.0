import React, { useState } from 'react';
import { Building2, PlusCircle, Edit3, Trash2, X } from 'lucide-react';
import { auth } from '../../services/auth';
import { shoppingCenters as centresApi } from '../../services/api/shoppingCenters';
import { properties as propertiesApi } from '../../services/api/properties';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { ShoppingCenter, Property } from '../../types';

export const CentresView: React.FC = () => {
  const orgId =
    auth.getCurrentOrganization()?.id ||
    auth.getCurrentUser()?.organization_id ||
    '';
  const [showCentreModal, setShowCentreModal] = useState(false);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [editingCentre, setEditingCentre] = useState<ShoppingCenter | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [selectedCentreForProperty, setSelectedCentreForProperty] = useState<string>('');

  const {
    data: centres = [],
    loading: centresLoading,
    error: centresError,
    refetch: refetchCentres,
  } = useSupabaseQuery(
    ['centers', orgId],
    () => centresApi.list(orgId),
    { enabled: !!orgId }
  );
  const {
    data: properties = [],
    loading: propertiesLoading,
    error: propertiesError,
  } = useSupabaseQuery(
    ['properties', orgId],
    () => propertiesApi.list(orgId),
    { enabled: !!orgId }
  );

  useRealtime({ table: 'shopping_centers', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['centers'], enabled: !!orgId });
  useRealtime({ table: 'properties', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['properties'], enabled: !!orgId });

  const createCentre = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof centresApi.create>[0]) => centresApi.create(input),
    invalidateKeys: ['centers'],
    onSuccess: () => { setShowCentreModal(false); setEditingCentre(null); },
  });
  const updateCentre = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ShoppingCenter> }) => centresApi.update(id, patch),
    invalidateKeys: ['centers'],
    onSuccess: () => { setShowCentreModal(false); setEditingCentre(null); },
  });
  const removeCentre = useSupabaseMutation({
    mutationFn: (id: string) => centresApi.remove(id),
    invalidateKeys: ['centers', 'properties'],
  });

  const createProperty = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof propertiesApi.create>[0]) => propertiesApi.create(input),
    invalidateKeys: ['properties'],
    onSuccess: () => { setShowPropertyModal(false); setEditingProperty(null); },
  });
  const updateProperty = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Property> }) => propertiesApi.update(id, patch),
    invalidateKeys: ['properties'],
    onSuccess: () => { setShowPropertyModal(false); setEditingProperty(null); },
  });
  const removeProperty = useSupabaseMutation({
    mutationFn: (id: string) => propertiesApi.remove(id),
    invalidateKeys: ['properties'],
  });

  if (!orgId) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-3">
        <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
        <h2 className="font-bold text-slate-900 dark:text-white">No organisation linked</h2>
        <p className="text-sm text-slate-500">
          Your account is not linked to an organisation yet. Sign out and sign back in.
          If it still fails, ask the super admin to re-approve the organisation so your
          profile gets an organisation_id.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Centres & properties</h1>
          <p className="text-xs text-slate-500 mt-1">
            Shopping centres you manage and the buildings or wings inside them
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditingCentre(null); setShowCentreModal(true); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" /> Add centre
          </button>
          <button
            onClick={() => { setEditingProperty(null); setShowPropertyModal(true); }}
            disabled={centres.length === 0}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4" /> Add property
          </button>
        </div>
      </div>

      {(centresError || propertiesError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {centresError?.message || propertiesError?.message}
          <button type="button" onClick={() => void refetchCentres()} className="ml-3 underline font-semibold">
            Retry
          </button>
        </div>
      )}

      {(centresLoading || propertiesLoading) && centres.length === 0 && (
        <div className="p-8 text-center text-sm text-slate-500">Loading centres…</div>
      )}

      {!centresLoading && centres.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">No centres yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Start by adding your first shopping centre
          </p>
          <button
            onClick={() => { setEditingCentre(null); setShowCentreModal(true); }}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
          >
            Add your first centre
          </button>
        </div>
      ) : centres.length > 0 ? (
        <div className="space-y-4">
          {centres.map((c) => {
            const cProps = properties.filter((p) => p.shopping_center_id === c.id);
            return (
              <div key={c.id} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-5 flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">{c.name}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">{c.location} · {c.address}</p>
                      {c.amenities && c.amenities.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mt-2">
                          {c.amenities.slice(0, 4).map((a) => (
                            <span key={a} className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setSelectedCentreForProperty(c.id); setEditingProperty(null); setShowPropertyModal(true); }}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Add property
                    </button>
                    <button
                      onClick={() => { setEditingCentre(c); setShowCentreModal(true); }}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete centre "${c.name}"?`)) removeCentre.mutate(c.id); }}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {cProps.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                    {cProps.map((p) => (
                      <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-white">{p.name}</div>
                          <div className="text-[11px] text-slate-500">{p.type} · {p.address}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditingProperty(p); setSelectedCentreForProperty(p.shopping_center_id); setShowPropertyModal(true); }}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Delete property "${p.name}"?`)) removeProperty.mutate(p.id); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {showCentreModal && (
        <CentreForm
          initial={editingCentre}
          onCancel={() => { setShowCentreModal(false); setEditingCentre(null); }}
          onSubmit={(input) => {
            if (editingCentre) updateCentre.mutate({ id: editingCentre.id, patch: input as never });
            else createCentre.mutate(input as never);
          }}
        />
      )}

      {showPropertyModal && (
        <PropertyForm
          centres={centres}
          initial={editingProperty}
          preselectedCentreId={selectedCentreForProperty}
          onCancel={() => { setShowPropertyModal(false); setEditingProperty(null); }}
          onSubmit={(input) => {
            if (editingProperty) updateProperty.mutate({ id: editingProperty.id, patch: input as never });
            else createProperty.mutate(input as never);
          }}
        />
      )}
    </div>
  );
};

function CentreForm({
  initial, onCancel, onSubmit,
}: {
  initial: ShoppingCenter | null;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    address: initial?.address ?? '',
    location: initial?.location ?? 'Mbabane Central',
    description: initial?.description ?? '',
    operating_hours: initial?.operating_hours ?? 'Mon-Sat: 08:00-18:00',
    parking_bays: initial?.parking_bays ?? 0,
    amenities: initial?.amenities?.join(', ') ?? '',
    image: initial?.image ?? '',
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{initial ? 'Edit centre' : 'Add shopping centre'}</h3>
          <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              ...form,
              parking_bays: Number(form.parking_bays) || 0,
              amenities: form.amenities
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block font-semibold mb-1">Centre name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Test Plaza Shopping Centre"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Location *</label>
              <input
                required
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Ezulwini Valley"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Parking bays</label>
              <input
                type="number"
                min={0}
                value={form.parking_bays}
                onChange={(e) => setForm({ ...form, parking_bays: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Address *</label>
            <input
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street address"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Operating hours</label>
            <input
              value={form.operating_hours}
              onChange={(e) => setForm({ ...form, operating_hours: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Amenities (comma separated)</label>
            <input
              value={form.amenities}
              onChange={(e) => setForm({ ...form, amenities: e.target.value })}
              placeholder="24/7 security, Backup generators, Fiber internet"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Image URL (optional)</label>
            <input
              type="url"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              placeholder="https://…"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {initial ? 'Save changes' : 'Create centre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PropertyForm({
  centres, initial, preselectedCentreId, onCancel, onSubmit,
}: {
  centres: ShoppingCenter[];
  initial: Property | null;
  preselectedCentreId: string;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    shopping_center_id: initial?.shopping_center_id ?? (preselectedCentreId || centres[0]?.id || ''),
    name: initial?.name ?? '',
    type: (initial?.type ?? 'Retail shop') as Property['type'],
    address: initial?.address ?? '',
    description: initial?.description ?? '',
  });

  const propertyTypes: Property['type'][] = [
    'Retail shop', 'Office', 'Warehouse', 'Restaurant', 'Kiosk',
    'Commercial unit', 'House', 'Apartment', 'Mixed-use property',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{initial ? 'Edit property' : 'Add property'}</h3>
          <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block font-semibold mb-1">Shopping centre *</label>
            <select
              required
              value={form.shopping_center_id}
              onChange={(e) => setForm({ ...form, shopping_center_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              {centres.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Property name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Wing A"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Type *</label>
              <select
                required
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Property['type'] })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                {propertyTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Address *</label>
            <input
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {initial ? 'Save changes' : 'Create property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
