import React, { useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { auth } from '../../services/auth';
import { preventiveMaintenance as pmApi } from '../../services/api/preventiveMaintenance';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { TicketCategory } from '../../types';

const CATEGORIES: TicketCategory[] = [
  'Air Conditioning',
  'Electrical',
  'Plumbing',
  'Security',
  'Structural Damage',
  'Other',
];

export function PreventiveMaintenanceView() {
  const org = auth.getCurrentOrganization();
  const orgId = org?.id ?? '';

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TicketCategory>('Other');
  const [frequency, setFrequency] = useState(90);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: tasks = [] } = useSupabaseQuery(['pm', orgId], () => pmApi.list(), {
    enabled: !!orgId,
  });

  useRealtime({
    table: 'preventive_maintenance',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['pm'],
    enabled: !!orgId,
  });

  const showFeedback = (text: string, ms = 3500) => {
    setFeedback(text);
    setTimeout(() => setFeedback(null), ms);
  };

  const add = useSupabaseMutation({
    mutationFn: () =>
      pmApi.create({
        title: title.trim(),
        category,
        frequency_days: frequency,
      }),
    invalidateKeys: ['pm'],
    onSuccess: () => {
      setTitle('');
      showFeedback('PM task scheduled.');
    },
    onError: (e) => showFeedback(`Failed: ${e.message}`, 5000),
  });

  const complete = useSupabaseMutation({
    mutationFn: (id: string) => pmApi.complete(id),
    invalidateKeys: ['pm'],
    onSuccess: () => showFeedback('Marked complete.'),
    onError: (e) => showFeedback(`Failed: ${e.message}`, 5000),
  });

  const remove = useSupabaseMutation({
    mutationFn: (id: string) => pmApi.remove(id),
    invalidateKeys: ['pm'],
    onSuccess: () => showFeedback('Task removed.'),
    onError: (e) => showFeedback(`Failed: ${e.message}`, 5000),
  });

  if (!orgId) {
    return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-blue-600" /> Preventive maintenance
        </h1>
        <p className="text-sm text-slate-500 mt-1">Recurring facility schedules</p>
      </div>

      {feedback && (
        <div className="rounded-lg border bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm">
          {feedback}
        </div>
      )}

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="md:col-span-2 rounded-lg border bg-transparent px-3 py-2 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value) || 30)}
              className="w-24 rounded-lg border bg-transparent px-3 py-2 text-sm"
              title="Frequency (days)"
            />
            <button
              onClick={() => add.mutate(undefined as never)}
              disabled={!title.trim() || add.loading}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
              type="button"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Task</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Every (days)</th>
              <th className="px-4 py-3 font-medium">Next due</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                  No PM tasks yet.
                </td>
              </tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3">{t.title}</td>
                  <td className="px-4 py-3">{t.category}</td>
                  <td className="px-4 py-3">{t.frequency_days}</td>
                  <td className="px-4 py-3">
                    {new Date(t.next_due_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        t.status === 'Overdue' ? 'text-red-600 font-semibold' : ''
                      }
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => complete.mutate(t.id)}
                      disabled={complete.loading}
                      className="text-blue-600 hover:underline text-xs font-medium mr-3 disabled:opacity-60"
                      type="button"
                    >
                      Mark complete
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this PM task?')) remove.mutate(t.id);
                      }}
                      disabled={remove.loading}
                      className="text-red-500 hover:underline text-xs disabled:opacity-60"
                      type="button"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
