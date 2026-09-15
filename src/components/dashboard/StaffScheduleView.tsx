import React, { useMemo, useState } from 'react';
import { Calendar, PlusCircle, CheckCircle2, Edit3, Trash2, X } from 'lucide-react';
import { auth } from '../../services/auth';
import { staffShifts as shiftsApi } from '../../services/api/staffShifts';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { StaffShift } from '../../types';

export const StaffScheduleView: React.FC = () => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [filterRole, setFilterRole] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StaffShift | null>(null);
  const [feedback, setFeedback] = useState('');

  const { data: shifts = [] } = useSupabaseQuery(['staff_shifts', orgId], () => shiftsApi.list(), { enabled: !!orgId });
  useRealtime({ table: 'staff_shifts', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['staff_shifts'], enabled: !!orgId });

 const create = useSupabaseMutation({
  mutationFn: (input: {
    staff_name: string;
    staff_role: StaffShift['staff_role'];
    date: string;
    shift_type: StaffShift['shift_type'];
    status: StaffShift['status'];
    notes?: string;
    property_id?: string | null;
    staff_id?: string | null;
  }) =>
    shiftsApi.create({
      staff_name: input.staff_name,
      staff_role: input.staff_role,
      date: input.date,
      shift_type: input.shift_type,
      status: input.status,
      notes: input.notes ?? null,
      property_id: input.property_id ?? null,
      // Deliberately omit staff_id unless a real profile uuid is provided
      staff_id: input.staff_id ?? null,
    } as never),
  invalidateKeys: ['staff_shifts'],
  onSuccess: () => { ... },
});
  const update = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<StaffShift> }) => shiftsApi.update(id, patch),
    invalidateKeys: ['staff_shifts'],
    onSuccess: () => { setFeedback('Shift updated.'); setTimeout(() => setFeedback(''), 3000); setEditing(null); setShowModal(false); },
  });
  const remove = useSupabaseMutation({
    mutationFn: (id: string) => shiftsApi.remove(id),
    invalidateKeys: ['staff_shifts'],
    onSuccess: () => { setFeedback('Shift removed.'); setTimeout(() => setFeedback(''), 3000); },
  });

  const filtered = useMemo(() => shifts.filter((s) => filterRole === 'All' || s.staff_role === filterRole), [shifts, filterRole]);

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" /> Roster & shifts
          </h1>
          <p className="text-xs text-slate-500 mt-1">Daily shift schedule and on-call coverage</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
          <PlusCircle className="w-4 h-4" /> Add shift
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {feedback}
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {['All', 'Maintenance', 'Security', 'Cleaning', 'Manager', 'Finance'].map((role) => (
          <button key={role} onClick={() => setFilterRole(role)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
              filterRole === role ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border'
            }`}>
            {role} ({role === 'All' ? shifts.length : shifts.filter((s) => s.staff_role === role).length})
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border divide-y">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No shifts.</div>
        ) : filtered.map((s) => (
          <div key={s.id} className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-xs">
                {s.staff_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs">{s.staff_name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800">{s.staff_role}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{s.shift_type}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                s.status === 'On-Call' ? 'bg-amber-100 text-amber-800'
                : s.status === 'Completed' ? 'bg-slate-100 text-slate-600'
                : 'bg-emerald-100 text-emerald-800'
              }`}>{s.status}</span>
              <span className="text-xs text-slate-400 hidden md:inline">{s.date}</span>
              <button onClick={() => { setEditing(s); setShowModal(true); }}
                className="p-1.5 rounded-lg border text-slate-600 hover:bg-slate-100">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => confirm('Delete?') && remove.mutate(s.id)}
                className="p-1.5 rounded-lg border text-red-500 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <ShiftForm initial={editing}
          onCancel={() => { setShowModal(false); setEditing(null); }}
          onSubmit={(input) => {
            if (editing) update.mutate({ id: editing.id, patch: input as never });
            else create.mutate(input as never);
          }} />
      )}
    </div>
  );
};

function ShiftForm({
  initial, onCancel, onSubmit,
}: {
  initial: StaffShift | null;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    staff_id: initial?.staff_id ?? 'manual',
    staff_name: initial?.staff_name ?? '',
    staff_role: (initial?.staff_role ?? 'Maintenance') as StaffShift['staff_role'],
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    shift_type: (initial?.shift_type ?? 'Morning (07:00-15:00)') as StaffShift['shift_type'],
    status: (initial?.status ?? 'Scheduled') as StaffShift['status'],
    notes: initial?.notes ?? '',
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{initial ? 'Edit shift' : 'Add shift'}</h3>
          <button onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3 text-xs">
          <input required value={form.staff_name} onChange={(e) => setForm({ ...form, staff_name: e.target.value })}
            placeholder="Staff name"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.staff_role} onChange={(e) => setForm({ ...form, staff_role: e.target.value as never })}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
              <option>Maintenance</option><option>Security</option><option>Cleaning</option>
              <option>Manager</option><option>Finance</option>
            </select>
            <input type="date" required value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          </div>
          <select value={form.shift_type} onChange={(e) => setForm({ ...form, shift_type: e.target.value as never })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
            <option>Morning (07:00-15:00)</option>
            <option>Afternoon (14:00-22:00)</option>
            <option>Night (22:00-07:00)</option>
            <option>General (08:00-17:00)</option>
          </select>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as never })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
            <option>Scheduled</option><option>On-Call</option><option>Completed</option><option>Leave</option>
          </select>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
              {initial ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
