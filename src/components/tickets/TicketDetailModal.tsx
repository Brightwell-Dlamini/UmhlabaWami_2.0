// src/components/tickets/TicketDetailModal.tsx
import React, { useRef, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  User,
  Wrench,
  Star,
  Send,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { tickets as ticketsApi } from '../../services/api/tickets';
import { ticketComments as commentsApi } from '../../services/api/ticketComments';
import { profiles as profilesApi } from '../../services/api/profiles';
import { uploadFile } from '../../services/storage';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { Modal } from '../ui/Modal';

interface Props {
  ticketId: string | null;
  onClose: () => void;
  onRefresh?: () => void;
}

const MAX_AFTER_PHOTO_BYTES = 5 * 1024 * 1024;

export const TicketDetailModal: React.FC<Props> = ({
  ticketId,
  onClose,
  onRefresh,
}) => {
  const currentUser = auth.getCurrentUser();
  const orgId = currentUser?.organization_id ?? '';

  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [repairNotes, setRepairNotes] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [hoursSpent, setHoursSpent] = useState('1.5');
  const [cost, setCost] = useState('450');
  const [afterPhotoUrls, setAfterPhotoUrls] = useState<string[]>([]);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedTechId, setSelectedTechId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const resolvedOnce = useRef(false);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const { data: ticket, loading } = useSupabaseQuery(
    ['tickets', 'detail', ticketId ?? ''],
    () =>
      ticketId
        ? ticketsApi.get(ticketId)
        : Promise.reject(new Error('no id')),
    { enabled: !!ticketId }
  );

  const { data: comments = [] } = useSupabaseQuery(
    ['ticket_comments', ticketId ?? ''],
    () => (ticketId ? commentsApi.list(ticketId) : Promise.resolve([])),
    { enabled: !!ticketId }
  );

  const { data: technicians = [] } = useSupabaseQuery(
    ['profiles', 'technicians', orgId],
    () =>
      profilesApi
        .list()
        .then((list) => list.filter((u) => u.role === 'maintenance')),
    { enabled: !!orgId }
  );

  const confirm = useSupabaseMutation({
    mutationFn: ({ rating, feedback }: { rating: number; feedback: string }) =>
      ticketsApi.confirm(ticketId!, rating, feedback),
    invalidateKeys: ['tickets', 'notifications'],
  });

  const reopen = useSupabaseMutation({
    mutationFn: ({ reason }: { reason: string }) =>
      ticketsApi.reopen(ticketId!, reason),
    invalidateKeys: ['tickets', 'notifications'],
  });

  const assign = useSupabaseMutation({
    mutationFn: ({
      techId,
      techName,
    }: {
      techId: string;
      techName: string;
    }) => ticketsApi.assign(ticketId!, techId, techName),
    invalidateKeys: ['tickets', 'notifications'],
  });

  const accept = useSupabaseMutation({
    mutationFn: () => ticketsApi.accept(ticketId!),
    invalidateKeys: ['tickets', 'notifications'],
  });

  const resolve = useSupabaseMutation({
    mutationFn: () =>
      ticketsApi.resolve(ticketId!, {
        repair_notes:
          repairNotes || 'Completed repairs per safety standards.',
        materials_used: materialsUsed || undefined,
        time_spent_hours: Number(hoursSpent) || undefined,
        cost: Number(cost) || undefined,
        after_images: afterPhotoUrls,
      }),
    invalidateKeys: ['tickets', 'notifications', 'finance_transactions'],
  });

  const addComment = useSupabaseMutation({
    mutationFn: ({ text }: { text: string }) =>
      commentsApi.add(ticketId!, text),
    invalidateKeys: ['ticket_comments', 'tickets'],
  });

  const runAction = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    setActionBusy(true);
    try {
      await fn();
      onRefresh?.();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirm = () =>
    runAction(async () => {
      await confirm.mutate({ rating, feedback });
      onClose();
    });

  const handleReopen = () =>
    runAction(async () => {
      await reopen.mutate({ reason: reopenReason });
      onClose();
    });

  const handleAssign = () => {
    const tech = technicians.find((t) => t.id === selectedTechId);
    if (!tech) return;
    void runAction(() =>
      assign.mutate({ techId: tech.id, techName: tech.name })
    );
  };

  const handleAccept = () => runAction(() => accept.mutate());

  const handleAfterPhotoSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!ticketId || !orgId) return;

    setActionError(null);
    setUploadingAfter(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_AFTER_PHOTO_BYTES) {
          throw new Error(
            `"${file.name}" exceeds 5MB. Choose a smaller image.`
          );
        }
        const { publicUrl, path } = await uploadFile({
          bucket: 'ticket-attachments',
          organizationId: orgId,
          entityId: ticketId,
          file,
        });
        uploaded.push(publicUrl ?? path);
      }
      setAfterPhotoUrls((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Photo upload failed.'
      );
    } finally {
      setUploadingAfter(false);
      if (afterInputRef.current) afterInputRef.current.value = '';
    }
  };

  const removeAfterPhoto = (url: string) => {
    setAfterPhotoUrls((prev) => prev.filter((u) => u !== url));
  };

  const handleResolve = () => {
    if (resolvedOnce.current || actionBusy || resolve.loading) return;
    resolvedOnce.current = true;
    void runAction(async () => {
      try {
        await resolve.mutate();
        onClose();
      } catch (e) {
        resolvedOnce.current = false;
        throw e;
      }
    });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    void runAction(async () => {
      await addComment.mutate({ text: newComment.trim() });
      setNewComment('');
    });
  };

  if (!ticketId) return null;

  if (loading && !ticket) {
    return (
      <Modal open onClose={onClose} size="lg" bareBody>
        <div className="p-16 text-center text-sm text-slate-500">
          Loading ticket…
        </div>
      </Modal>
    );
  }
  if (!ticket) return null;

  const now = new Date();
  const resDeadline = new Date(ticket.resolution_deadline);
  const diffMs = resDeadline.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const isBreached =
    diffMs < 0 &&
    ticket.status !== 'Resolved' &&
    ticket.status !== 'Closed';

  const canAssign =
    ticket.status === 'Open' ||
    ticket.status === 'In Progress' ||
    ticket.status === 'Reopened';
  const canMaintenanceAct =
    ticket.status === 'Open' ||
    ticket.status === 'In Progress' ||
    ticket.status === 'Reopened';

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      bareBody
      title={
        <span className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700">
            {ticket.ticket_number}
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-md uppercase bg-slate-100 dark:bg-slate-700">
            {ticket.status}
          </span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
            {ticket.priority} Priority
          </span>
        </span>
      }
      subtitle={
        <span className={isBreached ? 'text-red-600 font-semibold' : ''}>
          {ticket.status === 'Closed' || ticket.status === 'Resolved'
            ? 'Completed'
            : isBreached
              ? `Breached (${Math.abs(diffHours)} hrs overdue)`
              : `${diffHours} hours remaining`}{' '}
          · Deadline: {new Date(ticket.resolution_deadline).toLocaleString()}
        </span>
      }
      icon={
        <Clock
          className={`w-4 h-4 ${isBreached ? 'text-red-600' : 'text-blue-600'}`}
        />
      }
    >
      <div className="p-6 space-y-6">
        {actionError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-800 dark:text-red-300 text-xs font-semibold">
            {actionError}
          </div>
        )}

        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {ticket.title}
          </h2>
          <div className="mt-1 text-xs text-slate-500 space-y-0.5">
            <div>
              Category: <strong>{ticket.category}</strong>
            </div>
            <div>
              Assigned:{' '}
              <strong>{ticket.assigned_to_name || 'Unassigned'}</strong>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border text-xs space-y-2">
          <div className="font-semibold text-[10px] uppercase tracking-wider">
            Description
          </div>
          <p>{ticket.description}</p>
          {ticket.exact_location_description && (
            <p className="text-[11px] pt-2 border-t">
              <strong>Location:</strong> {ticket.exact_location_description}
            </p>
          )}
        </div>

        {ticket.repair_notes && (
          <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 text-xs space-y-2">
            <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Completion report
            </div>
            <p>{ticket.repair_notes}</p>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t text-[11px]">
              <div>
                Materials: <strong>{ticket.materials_used || '—'}</strong>
              </div>
              <div>
                Time: <strong>{ticket.time_spent_hours ?? '—'} hrs</strong>
              </div>
              <div>
                Cost: <strong>E{ticket.cost ?? 0}</strong>
              </div>
            </div>
          </div>
        )}

        {ticket.status === 'Resolved' && currentUser?.role === 'tenant' && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-400 space-y-4">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>Has the issue been fixed?</span>
            </div>

            {!showReopenInput ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold">Rate:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setRating(s)}
                        className="p-1"
                        type="button"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            s <= rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Optional feedback"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border text-xs"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirm}
                    disabled={actionBusy || confirm.loading}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2"
                    type="button"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Yes, fixed
                  </button>
                  <button
                    onClick={() => setShowReopenInput(true)}
                    className="py-2.5 px-4 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl flex items-center gap-1.5"
                    type="button"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reopen
                  </button>
                </div>
              </>
            ) : (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 space-y-3">
                <textarea
                  rows={2}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Why is it not fixed?"
                  className="w-full px-3 py-2 rounded-xl border text-xs"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowReopenInput(false)}
                    className="px-3 py-1.5 text-xs text-slate-600"
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReopen}
                    disabled={!reopenReason || actionBusy || reopen.loading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs rounded-xl font-semibold"
                    type="button"
                  >
                    Reopen ticket
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {currentUser?.role === 'maintenance' && canMaintenanceAct && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border space-y-3">
            <div className="font-bold text-xs flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-blue-600" /> Technician actions
            </div>
            {ticket.status === 'Open' || ticket.status === 'Reopened' ? (
              <button
                onClick={handleAccept}
                disabled={actionBusy || accept.loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl"
                type="button"
              >
                Accept job & mark In Progress
              </button>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={repairNotes}
                    onChange={(e) => setRepairNotes(e.target.value)}
                    placeholder="Repair notes"
                    className="px-3 py-2 rounded-xl border text-xs"
                  />
                  <input
                    value={materialsUsed}
                    onChange={(e) => setMaterialsUsed(e.target.value)}
                    placeholder="Materials used"
                    className="px-3 py-2 rounded-xl border text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.5"
                    value={hoursSpent}
                    onChange={(e) => setHoursSpent(e.target.value)}
                    placeholder="Hours"
                    className="px-3 py-2 rounded-xl border text-xs"
                  />
                  <input
                    type="number"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="Cost (E)"
                    className="px-3 py-2 rounded-xl border text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      After photos
                    </span>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-[11px] font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600">
                      <Upload className="w-3 h-3" />
                      {uploadingAfter ? 'Uploading…' : 'Add photo'}
                      <input
                        ref={afterInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={uploadingAfter}
                        onChange={handleAfterPhotoSelected}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {afterPhotoUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {afterPhotoUrls.map((url) => (
                        <div
                          key={url}
                          className="relative w-16 h-16 rounded-lg overflow-hidden border"
                        >
                          <img
                            src={url}
                            alt="After repair"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeAfterPhoto(url)}
                            className="absolute top-0.5 right-0.5 px-1 py-0.5 rounded bg-black/60 text-white text-[10px]"
                            aria-label="Remove photo"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleResolve}
                  disabled={actionBusy || resolve.loading || uploadingAfter || resolvedOnce.current}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2"
                  type="button"
                >
                  <CheckCircle2 className="w-4 h-4" /> Complete job & send to
                  tenant
                </button>
              </div>
            )}
          </div>
        )}

        {(currentUser?.role === 'property_manager' ||
          currentUser?.role === 'admin') &&
          canAssign && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border space-y-3">
            <div className="font-bold text-xs">Assign technician</div>
            <select
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-xs"
            >
              <option value="">Select technician…</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAssign}
              disabled={!selectedTechId || actionBusy || assign.loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl"
              type="button"
            >
              Assign
            </button>
          </div>
        )}

        {(currentUser?.role === 'property_manager' ||
          currentUser?.role === 'admin') &&
          (ticket.status === 'Resolved' || ticket.status === 'Closed') && (
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-600">
            This ticket is <strong>{ticket.status}</strong>. Assignment is
            locked. Reopen it if more work is needed.
          </div>
        )}

        <div className="space-y-3">
          <div className="font-bold text-xs flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" /> Comments
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {comments.length === 0 && (
              <p className="text-xs text-slate-400">No comments yet.</p>
            )}
            {comments.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border text-xs"
              >
                <div className="font-semibold">{c.author_name}</div>
                <p className="mt-1">{c.body}</p>
                <div className="text-[10px] text-slate-400 mt-1">
                  {new Date(c.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 px-3 py-2 rounded-xl border text-xs"
            />
            <button
              onClick={handleAddComment}
              disabled={
                !newComment.trim() || actionBusy || addComment.loading
              }
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1"
              type="button"
            >
              <Send className="w-3.5 h-3.5" /> Send
            </button>
          </div>
        </div>

        {ticket.timeline && ticket.timeline.length > 0 && (
          <div className="space-y-2">
            <div className="font-bold text-xs">Audit trail</div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {[...ticket.timeline]
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                )
                .map((ev) => (
                  <div
                    key={ev.id}
                    className="text-[11px] flex gap-2 text-slate-600 dark:text-slate-300"
                  >
                    <span className="font-semibold shrink-0">{ev.event_type}</span>
                    <span className="flex-1">{ev.notes || ev.event_type}</span>
                    <span className="text-slate-400 shrink-0">
                      {ev.actor_name} ·{' '}
                      {new Date(ev.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
