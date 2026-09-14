import React, { useState } from 'react';
import { X, Radio, Send, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { auth } from '../../services/auth';
import { emergencyBroadcasts as emergApi } from '../../services/api/announcements';
import { shoppingCenters as centersApi } from '../../services/api/shoppingCenters';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
}

export const BroadcastModal: React.FC<Props> = ({ isOpen, onClose, onSent }) => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'Fire' | 'Security' | 'Water Outage' | 'Power Outage' | 'Evacuation' | 'Major Maintenance'>('Water Outage');
  const [targetPropertyId, setTargetPropertyId] = useState('all');
  const [success, setSuccess] = useState(false);

  const { data: centers = [] } = useSupabaseQuery(
    ['centers', orgId],
    () => centersApi.list(),
    { enabled: !!orgId && isOpen }
  );

  const send = useSupabaseMutation({
    mutationFn: () => emergApi.broadcast({
      property_id: targetPropertyId === 'all' ? undefined : targetPropertyId,
      type,
      headline: title,
      instructions: message,
    }),
    invalidateKeys: ['emergency_broadcasts', 'notifications'],
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSent?.();
        onClose();
      }, 1500);
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-red-500 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-red-600 text-white">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 animate-pulse" />
            <h3 className="font-bold text-sm">Emergency broadcast</h3>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <h4 className="font-bold text-base">Dispatched</h4>
            <p className="text-xs text-slate-500">Broadcast live across all tenants and staff.</p>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); send.mutate(undefined as never); }}
            className="p-6 space-y-4">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Dispatches immediately to all tenants and on-call staff.
            </div>

            <select value={targetPropertyId} onChange={(e) => setTargetPropertyId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs">
              <option value="all">All centers (entire portfolio)</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select value={type} onChange={(e) => setType(e.target.value as never)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs">
              <option>Fire</option><option>Security</option>
              <option>Water Outage</option><option>Power Outage</option>
              <option>Evacuation</option><option>Major Maintenance</option>
            </select>

            <input required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Headline"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs" />

            <textarea required rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Detailed instructions"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border text-xs" />

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 rounded-xl">Cancel</button>
              <button type="submit" disabled={send.loading}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Send broadcast
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
