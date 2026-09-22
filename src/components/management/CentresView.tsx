import React, { useEffect, useState } from 'react';
import { Building2, PlusCircle, Edit3, Trash2 } from 'lucide-react';
import { auth } from '../../services/auth';
import { shoppingCenters as centresApi } from '../../services/api/shoppingCenters';
import { properties as propertiesApi } from '../../services/api/properties';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { ShoppingCenter, Property } from '../../types';
import { Modal } from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/ToastProvider';
import { EmptyState } from '../ui/EmptyState';

export const CentresView: React.FC = () => {
  const orgId =
    auth.getCurrentOrganization()?.id ||
    auth.getCurrentUser()?.organization_id ||
    '';
  const toast = useToast();
  const { confirm } = useConfirm();

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
  } = useSupabaseQuery(['centers', orgId], () => centresApi.list(orgId), { enabled: !!orgId });
  const {
    data: properties = [],
    loading: propertiesLoading,
    error: propertiesError,
  } = useSupabaseQuery(['properties', orgId], () => propertiesApi.list(orgId), { enabled: !!orgId });

  useRealtime({ table: 'shopping_centers', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['centers'], enabled: !!orgId });
  useRealtime({ table: 'properties', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['properties'], enabled: !!orgId });

  const createCentre = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof centresApi.create>[0]) => centresApi.create(input),
    invalidateKeys: ['centers'],
    onSuccess: () => {
      toast.success('Centre created');
      setShowCentreModal(false);
      setEditingCentre(null);
    },
    onError: (e) => toast.error('Could not create centre', e.message),
  });
  const updateCentre = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ShoppingCenter> }) => centresApi.update(id, patch),
    invalidateKeys: ['centers'],
    onSuccess: () => {
      toast.success('Centre updated');
      setShowCentreModal(false);
      setEditingCentre(null);
    },
  });
  const removeCentre = useSupabaseMutation({
    mutationFn: (id: string) => centresApi.remove(id),
    invalidateKeys: ['centers', 'properties'],
  });

  const createProperty = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof propertiesApi.create>[0]) => propertiesApi.create(input),
    invalidateKeys: ['properties'],
    onSuccess: () => {
      toast.success('Property created');
      setShowPropertyModal(false);
      setEditingProperty(null);
    },
    onError: (e) => toast.error('Could not create property', e.message),
  });
  const updateProperty = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Property> }) => propertiesApi.update(id, patch),
    invalidateKeys: ['properties'],
    onSuccess: () => {
      toast.success('Property updated');
      setShowPropertyModal(false);
      setEditingProperty(null);
    },
  });
  const removeProperty = useSupabaseMutation({
    mutationFn: (id: string) => propertiesApi.remove(id),
    invalidateKeys: ['properties'],
  });

  const handleDeleteCentre = async (c: ShoppingCenter) => {
    const ok = await confirm({
      title: `Delete centre "${c.name}"?`,
      message: 'Properties and units under this centre may be affected.',
      confirmLabel: 'Delete centre',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await removeCentre.mutate(c.id);
      toast.success('Centre removed');
    } catch (e) {
      toast.error('Delete failed', e instanceof Error ? e.message : 'Could not remove centre.');
    }
  };

  const handleDeleteProperty = async (p: Property) => {
    const ok = await confirm({
      title: `Delete property "${p.name}"?`,
      message: 'Units linked to this property will become orphaned.',
      confirmLabel: 'Delete property',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await removeProperty.mutate(p.id);
      toast.success('Property removed');
    } catch (e) {
      toast.error('Delete failed', e instanceof Error ? e.message : 'Could not remove property.');
    }
  };

  if (!orgId) {
    return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Centres & properties</h1>
          <p className="text-xs text-slate-500">Shopping centres and the buildings within them</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setEditingCentre(null); setShowCentreModal(true); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" /> Add centre
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingProperty(null);
              setSelectedCentreForProperty(centres[0]?.id ?? '');
              setShowPropertyModal(true);
            }}
            disabled={centres.length === 0}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" /> Add property
          </button>
        </div>
      </div>

      {(centresError || propertiesError) && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
          {centresError?.message || propertiesError?.message}
        </div>
      )}

      {centresLoading ? (
        <div className="text-sm text-slate-500">Loading centres…</div>
      ) : centres.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="No centres yet"
          message="Create your first shopping centre to start adding units and tenants."
        />
      ) : (
        <div className="space-y-4">
          {centres.map((c) => {
            const props = properties.filter((p) => p.shopping_center_id === c.id);
            return (
              <div key={c.id} className="rounded-2xl border bg-white dark:bg-slate-800 overflow-hidden">
                <div className="p-4 flex items-center justify-between gap-3 border-b">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{c.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{c.address || 'No address'}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCentreForProperty(c.id);
                        setEditingProperty(null);
                        setShowPropertyModal(true);
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border hover:bg-slate-50"
                    >
                      Add property
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingCentre(c); setShowCentreModal(true); }}
                      className="p-1.5 rounded-lg border hover:bg-slate-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCentre(c)}
                      className="p-1.5 rounded-lg border text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  {props.length === 0 ? (
                    <p className="text-xs text-slate-400 px-1">No properties yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {props.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 text-xs"
                        >
                          <span className="font-medium truncate">{p.name} <span className="text-slate-400 font-normal">· {p.type}</span></span>
                          <span className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => { setEditingProperty(p); setShowPropertyModal(true); }} className="p-1 rounded hover:bg-slate-100">
                              <Edit3 className="w-3 h-3 text-slate-500" />
                            </button>
                            <button type="button" onClick={() => handleDeleteProperty(p)} className="p-1 rounded hover:bg-red-50">
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CentreForm
        open={showCentreModal}
        initial={editingCentre}
        onCancel={() => { setShowCentreModal(false); setEditingCentre(null); }}
        onSubmit={(input) => {
          if (editingCentre) updateCentre.mutate({ id: editingCentre.id, patch: input as never });
          else createCentre.mutate(input as never);
        }}
        submitting={createCentre.loading || updateCentre.loading}
      />

      <PropertyForm
        open={showPropertyModal}
        centres={centres}
        initial={editingProperty}
        defaultCentreId={selectedCentreForProperty}
        onCancel={() => { setShowPropertyModal(false); setEditingProperty(null); }}
        onSubmit={(input) => {
          if (editingProperty) updateProperty.mutate({ id: editingProperty.id, patch: input as never });
          else createProperty.mutate(input as never);
        }}
        submitting={createProperty.loading || updateProperty.loading}
      />
    </div>
  );
};

function CentreForm({
  open,
  initial,
  onCancel,
  onSubmit,
  submitting = false,
}: {
  open: boolean;
  initial: ShoppingCenter | null;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
  submitting?: boolean;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setAddress(initial?.address ?? '');
    setCity((initial as { city?: string } | null)?.city ?? '');
  }, [open, initial?.id]);

  return (
    <Modal open={open} onClose={onCancel} size="sm" title={initial ? 'Edit centre' : 'Add centre'}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name, address, city });
        }}
        className="space-y-3 text-xs"
      >
        <div>
          <label className="block font-semibold mb-1">Name *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
        </div>
        <div>
          <label className="block font-semibold mb-1">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
        </div>
        <div>
          <label className="block font-semibold mb-1">City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
        </div>
        <div className="pt-3 flex justify-end gap-2 border-t">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">Cancel</button>
          <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold">
            {submitting ? 'Saving…' : initial ? 'Save changes' : 'Create centre'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PropertyForm({
  open,
  centres,
  initial,
  defaultCentreId,
  onCancel,
  onSubmit,
  submitting = false,
}: {
  open: boolean;
  centres: ShoppingCenter[];
  initial: Property | null;
  defaultCentreId: string;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
  submitting?: boolean;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Property['type']>('Retail shop');
  const [address, setAddress] = useState('');
  const [shopping_center_id, setShoppingCenterId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setType(initial?.type ?? 'Retail shop');
    setAddress(initial?.address ?? '');
    setShoppingCenterId(initial?.shopping_center_id ?? defaultCentreId ?? centres[0]?.id ?? '');
    setDescription(initial?.description ?? '');
  }, [open, initial?.id, defaultCentreId, centres]);

  const propertyTypes: Property['type'][] = [
    'Retail shop', 'Office', 'Restaurant', 'Kiosk', 'Warehouse',
    'Commercial unit', 'House', 'Apartment', 'Mixed-use property',
  ];

  return (
    <Modal open={open} onClose={onCancel} size="md" title={initial ? 'Edit property' : 'Add property'}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name, type, address, shopping_center_id, description });
        }}
        className="space-y-3 text-xs"
      >
        <div>
          <label className="block font-semibold mb-1">Centre *</label>
          <select required value={shopping_center_id} onChange={(e) => setShoppingCenterId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
            {centres.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Property name *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
        </div>
        <div>
          <label className="block font-semibold mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as Property['type'])} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
            {propertyTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
        </div>
        <div>
          <label className="block font-semibold mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
        </div>
        <div className="pt-3 flex justify-end gap-2 border-t">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">Cancel</button>
          <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold">
            {submitting ? 'Saving…' : initial ? 'Save changes' : 'Create property'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
