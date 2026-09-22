import React, { useState } from 'react';
import { Radio, Send, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { auth } from '../../services/auth';
import { emergencyBroadcasts as emergApi } from '../../services/api/announcements';
import { shoppingCenters as centersApi } from '../../services/api/shoppingCenters';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/ToastProvider';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
}

export const BroadcastModal: React.FC<Props> = ({ isOpen, onClose, onSent }) => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'Fire' | 'Security' | 'Water Outage' | 'Power Outage' | 'Evacuation' | 'Major Maintenance'>('Water Outage');
  const [targetPropertyId, setTargetPropertyId] = useState('all');

  const { data: centers = [] } = useSupabaseQuery(
    ['centers', orgId],
    () => centersApi.list(),
    { enabled: !!orgId && isOpen }
  );

  const send = useSupabaseMutation({
    mutationFn: () =>
      emergApi.broadcast({
        property_id: targetPropertyId === 'all' ? undefined : targetPropertyId,
        type,
        headline: title,
        instructions: message,
      }),
    invalidateKeys: ['emergency_broadcasts', 'notifications'],
    onSuccess: () => {
      toast.success('Broadcast sent', 'All tenants and on-call staff notified.');
      setTitle('');
      setMessage('');
      onSent?.();
      onClose();
    },
    onError: (e) => toast.error('Broadcast failed', e.message),
  });

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      title="Emergency broadcast"
      icon={<Radio className="w-5 h-5 text-red-600 animate-pulse" />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate(undefined as never);
        }}
        className="space-y-4 text-xs"
      >
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-800 dark:text-red-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Dispatches immediately to all tenants and on-call staff.
        </div>

        <select
          value={targetPropertyId}
          onChange={(e) => setTargetPropertyId(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border"
        >
          <option value="all">All centers (entire portfolio)</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value as never)}
          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border"
        >
          <option>Fire</option>
          <option>Security</option>
          <option>Water Outage</option>
          <option>Power Outage</option>
          <option>Evacuation</option>
          <option>Major Maintenance</option>
        </select>

        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Headline"
          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border"
        />

        <textarea
          required
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Detailed instructions"
          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border"
        />

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 rounded-xl">
            Cancel
          </button>
          <button
            type="submit"
            disabled={send.loading}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> {send.loading ? 'Sending…' : 'Send broadcast'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
