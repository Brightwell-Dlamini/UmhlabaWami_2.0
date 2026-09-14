import React, { useMemo, useState } from 'react';
import { Megaphone, PlusCircle, CheckCircle2, Trash2, Edit3, X, Archive, Search } from 'lucide-react';
import { auth } from '../../services/auth';
import { announcements as annApi } from '../../services/api/announcements';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { Announcement } from '../../types';

export const AnnouncementsView: React.FC = () => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const user = auth.getCurrentUser();
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [feedback, setFeedback] = useState('');

  const { data: announcements = [] } = useSupabaseQuery(
    ['announcements', orgId],
    () => annApi.list(),
    { enabled: !!orgId }
  );

  useRealtime({ table: 'announcements', filter: `organization_id=eq.${orgId}`, invalidateKeys: ['announcements'], enabled: !!orgId });

  const create = useSupabaseMutation({
    mutationFn: (input: Parameters<typeof annApi.create>[0]) => annApi.create(input),
    invalidateKeys: ['announcements'],
    onSuccess: () => { setFeedback('Announcement published.'); setTimeout(() => setFeedback(''), 3000); setShowModal(false); },
  });
  const update = useSupabaseMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Announcement> }) => annApi.update(id, patch),
    invalidateKeys: ['announcements'],
    onSuccess: () => { setFeedback('Announcement updated.'); setTimeout(() => setFeedback(''), 3000); setEditing(null); setShowModal(false); },
  });
  const remove = useSupabaseMutation({
    mutationFn: (id: string) => annApi.remove(id),
    invalidateKeys: ['announcements'],
    onSuccess: () => { setFeedback('Announcement removed.'); setTimeout(() => setFeedback(''), 3000); },
  });
  const toggleActive = useSupabaseMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => annApi.toggleActive(id, is_active),
    invalidateKeys: ['announcements'],
  });

  const filtered = useMemo(() => announcements.filter((a) => {
    if (priorityFilter !== 'All' && a.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q);
    }
    return true;
  }), [announcements, priorityFilter, search]);

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold">Center announcements</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">Broadcast advisories to tenants and staff</p>
        </div>
        {user?.role !== 'tenant' && (
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4" /> New announcement
          </button>
        )}
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {feedback}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {['All', 'General', 'Important', 'Emergency'].map((p) => (
          <button key={p} onClick={() => setPriorityFilter(p)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
              priorityFilter === p ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700'
            }`}>
            {p} ({p === 'All' ? announcements.length : announcements.filter((a) => a.priority === p).length})
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border w-48" />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border text-slate-400 text-xs">
            No announcements yet.
          </div>
        ) : filtered.map((a) => (
          <div key={a.id} className={`p-5 rounded-2xl bg-white dark:bg-slate-800 border ${!a.is_active ? 'opacity-60 border-dashed' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  a.priority === 'Emergency' ? 'bg-red-100 text-red-800'
                  : a.priority === 'Important' ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800'
                }`}>{a.priority}</span>
                <span className="text-xs text-slate-400">Audience: {a.target_audience}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">{new Date(a.created_at).toLocaleDateString()}</span>
                {user?.role !== 'tenant' && (
                  <>
                    <button onClick={() => toggleActive.mutate({ id: a.id, is_active: !a.is_active })}
                      className="p-1.5 rounded-lg border text-slate-600 hover:bg-slate-100"><Archive className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setEditing(a); setShowModal(true); }}
                      className="p-1.5 rounded-lg border text-slate-600 hover:bg-slate-100"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => confirm('Delete?') && remove.mutate(a.id)}
                      className="p-1.5 rounded-lg border text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            </div>
            <h2 className="text-base font-bold">{a.title}</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">{a.message}</p>
            <div className="pt-3 mt-3 border-t text-[11px] text-slate-400">
              Published by: {a.created_by_name}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <AnnouncementForm
          initial={editing}
          onCancel={() => { setShowModal(false); setEditing(null); }}
          onSubmit={(input) => {
            if (editing) update.mutate({ id: editing.id, patch: input as never });
            else create.mutate(input as never);
          }}
        />
      )}
    </div>
  );
};

function AnnouncementForm({
  initial, onCancel, onSubmit,
}: {
  initial: Announcement | null;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [message, setMessage] = useState(initial?.message ?? '');
  const [priority, setPriority] = useState(initial?.priority ?? 'General');
  const [targetAudience, setTargetAudience] = useState(initial?.target_audience ?? 'All Tenants');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{initial ? 'Edit' : 'Post'} announcement</h3>
          <button onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ title, message, priority, target_audience: targetAudience }); }}
          className="space-y-3 text-xs">
          <input required value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          <div className="grid grid-cols-2 gap-3">
            <select value={priority} onChange={(e) => setPriority(e.target.value as never)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
              <option>General</option><option>Important</option><option>Emergency</option>
            </select>
            <select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value as never)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
              <option>All Tenants</option><option>Specific Property</option><option>Specific Floor</option>
            </select>
          </div>
          <textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Message"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          <div className="pt-3 flex justify-end gap-2 border-t">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
              {initial ? 'Save' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
