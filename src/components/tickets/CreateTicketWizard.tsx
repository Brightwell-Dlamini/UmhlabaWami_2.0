import React, { useMemo, useState } from 'react';
import {
  X, PlusCircle, Clock, Upload, ArrowRight, ArrowLeft,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { tickets as ticketsApi } from '../../services/api/tickets';
import { shops as shopsApi } from '../../services/api/shops';
import { tenants as tenantsApi } from '../../services/api/tenants';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { invalidate } from '../../lib/queryClient';
import type { TicketPriority, TicketCategory } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (ticketNumber: string) => void;
}

export const CreateTicketWizard: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const user = auth.getCurrentUser();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TicketCategory>('Plumbing');
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [description, setDescription] = useState('');
  const [exactLocation, setExactLocation] = useState('');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: shops = [] } = useSupabaseQuery(
    ['shops', user?.organization_id ?? ''],
    () => shopsApi.list(),
    { enabled: !!user?.organization_id && isOpen }
  );

  const { data: tenants = [] } = useSupabaseQuery(
    ['tenants', user?.organization_id ?? ''],
    () => tenantsApi.list(),
    { enabled: !!user?.organization_id && isOpen }
  );

  const linkedTenant = useMemo(() => {
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

  const effectiveShopId =
    selectedShopId ||
    linkedTenant?.shop_id ||
    user?.shop_id ||
    (user?.role !== 'tenant' ? shops[0]?.id : '') ||
    '';
  const shop = shops.find((s) => s.id === effectiveShopId);
  const tenant =
    linkedTenant ??
    tenants.find((t) => t.shop_id === effectiveShopId);

  const isTenantRole = user?.role === 'tenant';

  const slaHours = useMemo(() => {
    switch (priority) {
      case 'Emergency': return { response: '15 min', resolution: '4 hrs' };
      case 'High': return { response: '1 hr', resolution: '8 hrs' };
      case 'Medium': return { response: '4 hrs', resolution: '24 hrs' };
      case 'Low': return { response: '24 hrs', resolution: '72 hrs' };
    }
  }, [priority]);

  if (!isOpen) return null;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File exceeds 2MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) setUploadedImages((prev) => [...prev, reader.result as string]);
    };
    reader.readAsDataURL(file);
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) setStep(step + 1);
    else void submit();
  };

  const submit = async () => {
    if (!user) {
      setError('You are not signed in. Please refresh and try again.');
      return;
    }
    if (!tenant) {
      setError(
        isTenantRole
          ? 'Your account is not linked to a tenant record yet. Ask your organisation admin to link your user to a tenant under Tenants Directory.'
          : 'No tenant is associated with the selected unit. Create or link a tenant first.'
      );
      return;
    }
    if (!shop) {
      setError(
        isTenantRole
          ? 'No unit is linked to your tenant record. Ask your organisation admin to assign a unit.'
          : 'Select a unit (shop) before submitting the ticket.'
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await ticketsApi.create({
        shopping_center_id: shop.shopping_center_id,
        property_id: shop.property_id,
        shop_id: shop.id,
        tenant_id: tenant.id,
        title,
        description,
        exact_location_description: exactLocation,
        priority,
        category,
        before_images: uploadedImages,
      });
      // Refresh every tickets list/detail without requiring a full page reload
      invalidate('tickets');
      invalidate('notifications');
      onSuccess(ticket.ticket_number);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border overflow-hidden my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Log maintenance ticket</h3>
              <p className="text-[11px] text-slate-500">
                Step {step} of 4:{' '}
                {step === 1 ? 'Issue' : step === 2 ? 'Priority & SLA' : step === 3 ? 'Location & photos' : 'Review'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1">
          <div className="bg-blue-600 h-1 transition-all" style={{ width: `${(step / 4) * 100}%` }} />
        </div>

        <form onSubmit={handleNext} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Issue title *</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Water leak beneath restroom basin"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Category *</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs">
                  <option>Plumbing</option><option>Electrical</option>
                  <option>Air Conditioning</option><option>Cleaning</option>
                  <option>Security</option><option>Parking</option>
                  <option>Noise Complaint</option><option>Structural Damage</option>
                  <option>Water Leak</option><option>Signage</option>
                  <option>Internet / Network</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Description *</label>
                <textarea rows={3} required value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="When it started, impact on operations, etc."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(['Emergency', 'High', 'Medium', 'Low'] as TicketPriority[]).map((p) => (
                  <div key={p} onClick={() => setPriority(p)}
                    className={`p-3 rounded-xl border-2 cursor-pointer ${
                      priority === p ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200 dark:border-slate-700'
                    }`}>
                    <div className="text-xs font-bold">{p}</div>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Response: <strong>{slaHours?.response}</strong></span>
                </div>
                <div>Resolution: <strong>{slaHours?.resolution}</strong></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {user?.role !== 'tenant' && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Shop / Unit</label>
                  <select value={effectiveShopId}
                    onChange={(e) => setSelectedShopId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs">
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>Unit {s.shop_number} — {s.floor}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1">Exact location</label>
                <input value={exactLocation} onChange={(e) => setExactLocation(e.target.value)}
                  placeholder="Behind the storeroom counter, under the sink…"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Photo evidence (max 2MB per file)
                </label>
                {uploadError && <div className="text-[11px] text-red-600 mb-2">{uploadError}</div>}
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer">
                    <Upload className="w-4 h-4 text-blue-600" /> Attach photo
                    <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                  </label>
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="w-12 h-12 rounded-lg overflow-hidden border">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 space-y-2">
                <div className="text-xs font-bold text-blue-700 uppercase">Ticket preview</div>
                <h4 className="font-bold text-sm">{title}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">{description}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border">
                  <div className="text-[10px] text-slate-500">Priority</div>
                  <div className="font-bold">{priority}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border">
                  <div className="text-[10px] text-slate-500">Category</div>
                  <div className="font-bold">{category}</div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-3 border-t flex items-center justify-between">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-md flex items-center gap-1.5">
                <span>{submitting ? 'Submitting…' : step === 4 ? 'Dispatch ticket' : 'Continue'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
