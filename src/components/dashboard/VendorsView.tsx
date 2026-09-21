// src/components/dashboard/VendorsView.tsx
import React, { useMemo, useState } from 'react';
import {
  Wrench,
  Search,
  Star,
  PlusCircle,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { vendors as vendorsApi } from '../../services/api/vendors';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { Vendor } from '../../types';

export const VendorsView: React.FC = () => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [feedback, setFeedback] = useState('');

  const { data: vendors = [] } = useSupabaseQuery(
    ['vendors', orgId],
    () => vendorsApi.list(),
    { enabled: !!orgId }
  );

  useRealtime({
    table: 'vendors',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['vendors'],
    enabled: !!orgId,
  });

  const create = useSupabaseMutation({
    mutationFn: (input: Omit<Vendor, 'id' | 'organization_id'>) =>
      vendorsApi.create(input),
    invalidateKeys: ['vendors'],
    onSuccess: () => {
      setFeedback('Vendor registered.');
      setTimeout(() => setFeedback(''), 3000);
      setShowModal(false);
    },
  });

  const update = useSupabaseMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Vendor>;
    }) => vendorsApi.update(id, patch),
    invalidateKeys: ['vendors'],
    onSuccess: () => {
      setFeedback('Vendor updated.');
      setTimeout(() => setFeedback(''), 3000);
      setEditing(null);
      setShowModal(false);
    },
  });

  const remove = useSupabaseMutation({
    mutationFn: (id: string) => vendorsApi.remove(id),
    invalidateKeys: ['vendors'],
    onSuccess: () => {
      setFeedback('Vendor removed.');
      setTimeout(() => setFeedback(''), 3000);
    },
  });

  const categories = useMemo(
    () => Array.from(new Set(vendors.map((v) => v.service_category))),
    [vendors]
  );

  const filtered = vendors.filter((v) => {
    if (
      selectedCategory !== 'All' &&
      v.service_category !== selectedCategory
    ) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        v.company_name.toLowerCase().includes(q) ||
        v.service_category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (!orgId) {
    return (
      <div className="p-6 text-slate-500 text-sm">
        No organisation context.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" /> Approved contractors
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Verified suppliers and emergency callout contacts
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" /> Add vendor
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {feedback}
        </div>
      )}

      <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors…"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border"
        >
          <option value="All">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((v) => (
          <div
            key={v.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-800 border space-y-3 flex flex-col"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                {v.service_category}
              </span>
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span className="text-xs font-bold">
                  {v.performance_rating}
                </span>
              </div>
            </div>
            <h2 className="text-base font-bold">{v.company_name}</h2>
            <div className="text-xs text-slate-500">
              Contact: {v.contact_person}
            </div>
            <div className="text-xs">{v.phone}</div>
            <div className="text-[11px] text-slate-400 truncate">
              {v.email}
            </div>
            <div className="pt-3 border-t flex gap-2">
              <button
                onClick={() => {
                  setEditing(v);
                  setShowModal(true);
                }}
                className="p-1.5 rounded-lg border text-slate-600 hover:bg-slate-100"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() =>
                  confirm('Delete?') && remove.mutate(v.id)
                }
                className="p-1.5 rounded-lg border text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <VendorForm
          initial={editing}
          onCancel={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSubmit={(input) => {
            if (editing) update.mutate({ id: editing.id, patch: input });
            else create.mutate(input);
          }}
        />
      )}
    </div>
  );
};

function VendorForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: Vendor | null;
  onCancel: () => void;
  onSubmit: (
    input: Omit<Vendor, 'id' | 'organization_id'>
  ) => void;
}) {
  const [form, setForm] = useState({
    company_name: initial?.company_name ?? '',
    service_category: initial?.service_category ?? 'HVAC',
    contact_person: initial?.contact_person ?? '',
    phone: initial?.phone ?? '+268 ',
    email: initial?.email ?? '',
    contract_expiry: initial?.contract_expiry ?? '2027-12-31',
    performance_rating: initial?.performance_rating ?? 4.5,
    status: (initial?.status ?? 'Active') as Vendor['status'],
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">
            {initial ? 'Edit vendor' : 'Add vendor'}
          </h3>
          <button onClick={onCancel}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
          className="space-y-3 text-xs"
        >
          <input
            required
            value={form.company_name}
            onChange={(e) =>
              setForm({ ...form, company_name: e.target.value })
            }
            placeholder="Company name"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          />
          <input
            required
            value={form.service_category}
            onChange={(e) =>
              setForm({ ...form, service_category: e.target.value })
            }
            placeholder="Service category"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          />
          <input
            required
            value={form.contact_person}
            onChange={(e) =>
              setForm({ ...form, contact_person: e.target.value })
            }
            placeholder="Contact person"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
            />
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
            />
          </div>
          <input
            type="date"
            value={form.contract_expiry}
            onChange={(e) =>
              setForm({ ...form, contract_expiry: e.target.value })
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          />
          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as Vendor['status'],
              })
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          >
            <option>Active</option>
            <option>Under Review</option>
            <option>Inactive</option>
          </select>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {initial ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
