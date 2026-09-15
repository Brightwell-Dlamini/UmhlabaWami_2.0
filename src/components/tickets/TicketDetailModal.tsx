import React, { useState } from 'react';
import {
  X, Clock, CheckCircle2, AlertTriangle, User, Wrench, Star, Send,
  MessageSquare, ShieldCheck, RefreshCw,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { tickets as ticketsApi } from '../../services/api/tickets';
import { ticketComments as commentsApi } from '../../services/api/ticketComments';
import { profiles as profilesApi } from '../../services/api/profiles';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';

interface Props {
  ticketId: string | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export const TicketDetailModal: React.FC<Props> = ({ ticketId, onClose, onRefresh }) => {
  const currentUser = auth.getCurrentUser();
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [repairNotes, setRepairNotes] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [hoursSpent, setHoursSpent] = useState('1.5');
  const [cost, setCost] = useState('450');
  const [afterPhotoUrl, setAfterPhotoUrl] = useState('');
  const [newComment, setNewComment] = useState('');
  const [selectedTechId, setSelectedTechId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const { data: ticket, loading } = useSupabaseQuery(
    ['tickets', 'detail', ticketId ?? ''],
    () => (ticketId ? ticketsApi.get(ticketId) : Promise.reject(new Error('no id'))),
    { enabled: !!ticketId }
  );

  const { data: comments = [] } = useSupabaseQuery(
    ['ticket_comments', ticketId ?? ''],
    () => (ticketId ? commentsApi.list(ticketId) : Promise.resolve([])),
    { enabled: !!ticketId }
  );

  const { data: technicians = [] } = useSupabaseQuery(
    ['profiles', 'technicians', currentUser?.organization_id ?? ''],
    () =>
      profilesApi
        .list()
        .then((list) => list.filter((u) => u.role === 'maintenance')),
    { enabled: !!currentUser?.organization_id }
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
    mutationFn: ({ techId, techName }: { techId: string; techName: string }) =>
      ticketsApi.assign(ticketId!, techId, techName),
    invalidateKeys: ['tickets', 'notifications'],
  });

  const accept = useSupabaseMutation({
    mutationFn: () => ticketsApi.accept(ticketId!),
    invalidateKeys: ['tickets', 'notifications'],
  });

  const resolve = useSupabaseMutation({
    mutationFn: () =>
      ticketsApi.resolve(ticketId!, {
        repair_notes: repairNotes || 'Completed repairs per safety standards.',
        materials_used: materialsUsed || undefined,
        time_spent_hours: Number(hoursSpent) || undefined,
        cost: Number(cost) || undefined,
        after_images: afterPhotoUrl ? [afterPhotoUrl] : [],
      }),
    invalidateKeys: ['tickets', 'notifications', 'finance_transactions'],
  });

  const addComment = useSupabaseMutation({
    mutationFn: ({ text }: { text: string }) => commentsApi.add(ticketId!, text),
    invalidateKeys: ['ticket_comments', 'tickets'],
  });

  // Wrap every async action so errors surface and success closes/refreshes.
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
    void runAction(() => assign.mutate({ techId: tech.id, techName: tech.name }));
  };

  const handleAccept = () =>
    runAction(() => accept.mutate(undefined as never));

  const handleResolve = () =>
    runAction(async () => {
      await resolve.mutate(undefined as never);
      onClose();
    });

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80">
        <div className="text-white text-sm">Loading ticket…</div>
      </div>
    );
  }
  if (!ticket) return null;

  const now = new Date();
  const resDeadline = new Date(ticket.resolution_deadline);
  const diffMs = resDeadline.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const isBreached =
    diffMs < 0 && ticket.status !== 'Resolved' && ticket.status !== 'Closed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50/60 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700">
              {ticket.ticket_number}
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-md uppercase bg-slate-100 dark:bg-slate-700">
              {ticket.status}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
              {ticket.priority} Priority
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className={`px-6 py-2.5 flex items-center justify-between text-xs border-b ${
            isBreached
              ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300'
              : 'bg-blue-50/50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="font-semibold">
              {ticket.status === 'Closed' || ticket.status === 'Resolved'
                ? 'Completed'
                : isBreached
                  ? `Breached (${Math.abs(diffHours)} hrs overdue)`
                  : `${diffHours} hours remaining`}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Deadline: {new Date(ticket.resolution_deadline).toLocaleString()}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {actionError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-800 dark:text-red-300 text-xs font-semibold">
              {actionError}
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{ticket.title}</h2>
            <div className="mt-1 text-xs text-slate-500 space-y-0.5">
              <div>
                Category: <strong>{ticket.category}</strong>
              </div>
              <div>
                Assigned: <strong>{ticket.assigned_to_name || 'Unassigned'}</strong>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border text-xs space-y-2">
            <div className="font-semibold text-[10px] uppercase tracking-wider">Description</div>
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

          {/* Tenant confirmation */}
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
                              s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
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

          {/* Technician actions */}
          {currentUser?.role === 'maintenance' &&
            ticket.status !== 'Closed' &&
            ticket.status !== 'Resolved' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border space-y-3">
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-blue-600" /> Technician actions
                </div>
                {ticket.status === 'Open' ? (
                  <button
                    onClick={handleAccept}
                    disabled={actionBusy || accept.loading}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl"
                    type="button"
                  >
                    Accept job &amp; mark In Progress
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
                    <input
                      value={afterPhotoUrl}
                      onChange={(e) => setAfterPhotoUrl(e.target.value)}
                      placeholder="After photo URL (optional)"
                      className="w-full px-3 py-2 rounded-xl border text-xs"
                    />
                    <button
                      onClick={handleResolve}
                      disabled={actionBusy || resolve.loading}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2"
                      type="button"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Complete job &amp; send to tenant
                    </button>
                  </div>
                )}
              </div>
            )}

          {/* Manager assign */}
          {(currentUser?.role === 'property_manager' || currentUser?.role === 'admin') && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs">
                <strong>Assign technician:</strong>{' '}
                <span className="text-slate-500">allocate to center maintenance team</span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <select
                  value={selectedTechId}
                  onChange={(e) => setSelectedTechId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border text-xs"
                >
                  <option value="">-- Choose --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssign}
                  disabled={!selectedTechId || actionBusy || assign.loading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl"
                  type="button"
                >
                  Assign
                </button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-3">Audit trail</h4>
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {ticket.timeline.map((item) => (
                <div key={item.id} className="relative">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
                  <div className="text-xs font-semibold">{item.title}</div>
                  {item.description && (
                    <div className="text-[11px] text-slate-500">{item.description}</div>
                  )}
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {item.actor_name} ({item.actor_role}) •{' '}
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="border-t pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" /> Discussion
            </h4>
            <div className="space-y-2.5 mb-3 max-h-48 overflow-y-auto">
              {comments.length === 0 ? (
                <div className="text-xs text-slate-400 py-2">No comments yet.</div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{c.user_name}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p>{c.comment}</p>
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddComment();
              }}
              className="flex gap-2"
            >
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || actionBusy || addComment.loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
