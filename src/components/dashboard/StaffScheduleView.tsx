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

  const { data: shifts = [] } = useSupabaseQuery(
    ['staff_shifts', orgId],
    () => shiftsApi.list(),
    { enabled: !!orgId }
  );

  useRealtime({
    table: 'staff_shifts',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['staff_shifts'],
    enabled: !!orgId,
  });

  const create = useSupabaseMutation({
    mutationFn: (input: {
      staff_name: string;
      staff_role: string;
      date: string;
      shift_type: string;
      status: string;
      notes?: string;
    }) => shiftsApi.create(input),
    invalidateKeys: ['staff_shifts'],
    onSuccess: () => {
      setFeedback('Shift scheduled.');
      setTimeout(() => setFeedback(''), 3000);
      setShowModal(false);
    },
    onError: (e) => {
      setFeedback(`Failed: ${e.message}`);
      setTimeout(() => setFeedback(''), 5000);
    },
  });

  const update = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<StaffShift> }) =>
      shiftsApi.update(id, patch),
    invalidateKeys: ['staff_shifts'],
    onSuccess: () => {
      setFeedback('Shift updated.');
      setTimeout(() => setFeedback(''), 3000);
      setEditing(null);
      setShowModal(false);
    },
    onError: (e) => {
      setFeedback(`Failed: ${e.message}`);
      setTimeout(() => setFeedback(''), 5000);
    },
  });

  const remove = useSupabaseMutation({
    mutationFn: (id: string) => shiftsApi.remove(id),
    invalidateKeys: ['staff_shifts'],
    onSuccess: () => {
      setFeedback('Shift removed.');
      setTimeout(() => setFeedback(''), 3000);
    },
  });

  const filtered = useMemo(
    () =>
      shifts.filter((s) => filterRole === 'All' || s.staff_role === filterRole),
    [shifts, filterRole]
  );

  if (!orgId)
    return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" /> Roster &amp; shifts
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Daily shift schedule and on-call coverage
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" /> Add shift
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {feedback}
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {['All', 'Maintenance', 'Security', 'Cleaning', 'Manager', 'Finance'].map(
          (role) => (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                filterRole === role
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {role} (
              {role === 'All'
                ? shifts.length
                : shifts.filter((s) => s.staff_role === role).length}
              )
            </button>
          )
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No shifts.</div>
        ) : (
          filtered.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-xs">
                  {s.staff_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">{s.staff_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {s.staff_role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {s.shift_type}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    s.status === 'On-Call'
                      ? 'bg-amber-100 text-amber-800'
                      : s.status === 'Completed'
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {s.status}
                </span>
                <span className="text-xs text-slate-400 hidden md:inline">
                  {s.date}
                </span>
                <button
                  onClick={() => {
                    setEditing(s);
                    setShowModal(true);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete shift?')) remove.mutate(s.id);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <ShiftForm
          initial={editing}
          onCancel={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSubmit={(input) => {
            if (editing) update.mutate({ id: editing.id, patch: input as never });
            else create.mutate(input as never);
          }}
        />
      )}
    </div>
  );
};

function ShiftForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: StaffShift | null;
  onCancel: () => void;
  onSubmit: (input: {
    staff_name: string;
    staff_role: string;
    date: string;
    shift_type: string;
    status: string;
    notes?: string;
  }) => void;
}) {
  const [staffName, setStaffName] = useState(initial?.staff_name ?? '');
  const [staffRole, setStaffRole] = useState<StaffShift['staff_role']>(
    initial?.staff_role ?? 'Maintenance'
  );
  const [date, setDate] = useState(
    initial?.date ?? new Date().toISOString().slice(0, 10)
  );
  const [shiftType, setShiftType] = useState<StaffShift['shift_type']>(
    initial?.shift_type ?? 'Morning (07:00-15:00)'
  );
  const [status, setStatus] = useState<StaffShift['status']>(
    initial?.status ?? 'Scheduled'
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">
            {initial ? 'Edit shift' : 'Add shift'}
          </h3>
          <button onClick={onCancel}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              staff_name: staffName,
              staff_role: staffRole,
              date,
              shift_type: shiftType,
              status,
              notes: notes || undefined,
            });
          }}
          className="space-y-3 text-xs"
        >
          <input
            required
            placeholder="Staff name"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as StaffShift['staff_role'])}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              <option>Maintenance</option>
              <option>Security</option>
              <option>Cleaning</option>
              <option>Manager</option>
              <option>Finance</option>
            </select>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>
          <select
            value={shiftType}
            onChange={(e) =>
              setShiftType(e.target.value as StaffShift['shift_type'])
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          >
            <option>Morning (07:00-15:00)</option>
            <option>Afternoon (14:00-22:00)</option>
            <option>Night (22:00-07:00)</option>
            <option>General (08:00-17:00)</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StaffShift['status'])}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          >
            <option>Scheduled</option>
            <option>On-Call</option>
            <option>Completed</option>
            <option>Leave</option>
          </select>
          <textarea
            rows={2}
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
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
