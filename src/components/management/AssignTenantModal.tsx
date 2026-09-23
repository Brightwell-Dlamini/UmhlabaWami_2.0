import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { tenants as tenantsApi } from '../../services/api/tenants';
import type { Shop, ShoppingCenter } from '../../types';
import { Modal } from '../ui/Modal';
import { PasswordInput } from '../ui/PasswordInput';
import { useToast } from '../ui/ToastProvider';

export interface AssignTenantModalProps {
  open: boolean;
  onClose: () => void;
  onAssigned: () => void;
  /** Pre-selected unit (primary path from Units directory). */
  shop: Shop | null;
  /** When shop is null, user picks from vacant units (secondary path from Tenants list). */
  vacantShops: Shop[];
  centers: ShoppingCenter[];
}

/**
 * Unit-first assign flow:
 * Business + contact + lease start + optional portal password.
 * No separate staff creation. No manual link step.
 */
export const AssignTenantModal: React.FC<AssignTenantModalProps> = ({
  open,
  onClose,
  onAssigned,
  shop: lockedShop,
  vacantShops,
  centers,
}) => {
  const toast = useToast();
  const [shopId, setShopId] = useState(lockedShop?.id ?? '');
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [moveInDate, setMoveInDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [createPortal, setCreatePortal] = useState(true);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShopId(lockedShop?.id ?? '');
    setBusinessName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setMoveInDate(new Date().toISOString().slice(0, 10));
    setCreatePortal(true);
    setPassword('');
  }, [open, lockedShop?.id]);

  const effectiveShop = useMemo(() => {
    if (lockedShop) return lockedShop;
    return vacantShops.find((s) => s.id === shopId) ?? null;
  }, [lockedShop, vacantShops, shopId]);

  const centerName = effectiveShop
    ? centers.find((c) => c.id === effectiveShop.shopping_center_id)?.name
    : undefined;

  const title = effectiveShop
    ? `Assign Tenant → Unit ${effectiveShop.shop_number}`
    : 'Assign Tenant';

  const subtitle = effectiveShop
    ? [centerName, effectiveShop.floor].filter(Boolean).join(' · ')
    : 'Pick a vacant unit first';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveShop) {
      toast.error('Select a vacant unit');
      return;
    }
    setSubmitting(true);
    try {
      await tenantsApi.assignToUnit({
        shop: effectiveShop,
        business_name: businessName,
        contact_person: contactPerson,
        email,
        phone,
        move_in_date: moveInDate,
        createPortal,
        password: createPortal ? password : undefined,
      });
      toast.success(
        `Unit ${effectiveShop.shop_number} assigned`,
        businessName.trim()
      );
      onAssigned();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not assign tenant'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={<UserPlus className="w-4 h-4" />}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        {!lockedShop && (
          <div>
            <label className="block font-semibold mb-1">Vacant unit *</label>
            <select
              required
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
            >
              <option value="">Select unit…</option>
              {vacantShops.map((s) => {
                const c = centers.find((x) => x.id === s.shopping_center_id);
                return (
                  <option key={s.id} value={s.id}>
                    Unit {s.shop_number}
                    {c ? ` · ${c.name}` : ''}
                    {s.rental_amount
                      ? ` · E${s.rental_amount.toLocaleString()}/mo`
                      : ''}
                  </option>
                );
              })}
            </select>
            {vacantShops.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                No vacant units. Mark a unit as Available first, or add a new unit.
              </p>
            )}
          </div>
        )}

        {effectiveShop && (
          <div className="rounded-xl border bg-slate-50 dark:bg-slate-900/50 px-3 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
            <span>
              <span className="text-slate-400">Rent </span>
              <strong className="text-blue-600">
                E{Number(effectiveShop.rental_amount || 0).toLocaleString()}
              </strong>
              /mo
            </span>
            {effectiveShop.size_sqm != null && (
              <span>
                <span className="text-slate-400">Size </span>
                <strong>{effectiveShop.size_sqm} m²</strong>
              </span>
            )}
            <span>
              <span className="text-slate-400">Status </span>
              <strong>{effectiveShop.status}</strong>
            </span>
          </div>
        )}

        <div>
          <label className="block font-semibold mb-1">Business name *</label>
          <input
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Acme Trading (Pty) Ltd"
            className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Contact person *</label>
            <input
              required
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+268 …"
              className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1">Email *</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tenant@business.com"
            className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Lease start</label>
          <input
            type="date"
            value={moveInDate}
            onChange={(e) => setMoveInDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
          />
        </div>

        <div className="border-t pt-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={createPortal}
              onChange={(e) => setCreatePortal(e.target.checked)}
              className="rounded"
            />
            <span className="font-semibold">Create portal login</span>
          </label>
          <p className="text-[11px] text-slate-500 leading-snug">
            Lets the tenant log in to view invoices, documents and raise tickets.
            You can invite them later if you skip this.
          </p>
          {createPortal && (
            <PasswordInput
              label="Portal password *"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={createPortal}
              minLength={8}
              placeholder="Min 8 characters"
              autoComplete="new-password"
              className="px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900"
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !effectiveShop}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-60"
          >
            {submitting ? 'Assigning…' : 'Assign Tenant'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
