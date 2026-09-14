import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { auth } from '../../services/auth';
import { conversations as convApi } from '../../services/api/conversations';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';

export const MessagesView: React.FC = () => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const currentUser = auth.getCurrentUser();
  const [activeChannel, setActiveChannel] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const { data: channels = [] } = useSupabaseQuery(
    ['conversations', orgId],
    () => convApi.list(),
    { enabled: !!orgId }
  );

  useEffect(() => {
    if (!activeChannel && channels.length > 0) setActiveChannel(channels[0].id);
  }, [channels, activeChannel]);

  const { data: messages = [] } = useSupabaseQuery(
    ['chat_messages', activeChannel],
    () => activeChannel ? convApi.messages(activeChannel) : Promise.resolve([]),
    { enabled: !!activeChannel }
  );

  useRealtime({
    table: 'chat_messages',
    invalidateKeys: ['chat_messages'],
    enabled: !!activeChannel,
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = useSupabaseMutation({
    mutationFn: ({ text }: { text: string }) => convApi.send(activeChannel, text),
    invalidateKeys: ['chat_messages', activeChannel],
    onSuccess: () => setInputText(''),
  });

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold">Operations communications</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">Multi-party chat between tenants, managers and technicians</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border grid grid-cols-1 md:grid-cols-3 min-h-[520px] overflow-hidden">
        <div className="border-r p-4 space-y-2 bg-slate-50/50 dark:bg-slate-900/40">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Channels</h2>
          {channels.length === 0 ? (
            <div className="text-xs text-slate-400 p-3">No channels yet.</div>
          ) : channels.map((c) => (
            <div key={c.id} onClick={() => setActiveChannel(c.id)}
              className={`p-3 rounded-xl cursor-pointer ${
                activeChannel === c.id ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}>
              <div className="text-xs font-bold truncate">
                {c.participant_names.join(', ') || 'Conversation'}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.last_message || '—'}</p>
            </div>
          ))}
        </div>

        <div className="md:col-span-2 flex flex-col">
          <div className="p-4 border-b">
            <div className="text-sm font-bold">
              {channels.find((c) => c.id === activeChannel)?.participant_names.join(', ') || 'Select a channel'}
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-3 max-h-[380px]">
            {messages.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-8">No messages yet.</div>
            ) : messages.map((m) => {
              const isMe = m.sender_id === currentUser?.id;
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                    <span className="font-semibold">{m.sender_name}</span>
                    <span className="uppercase px-1.5 rounded bg-slate-100 dark:bg-slate-700">{m.sender_role}</span>
                    <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className={`p-3 rounded-2xl max-w-md text-xs ${
                    isMe ? 'bg-blue-600 text-white rounded-br-xs' : 'bg-slate-100 dark:bg-slate-700 rounded-bl-xs'
                  }`}>{m.message}</div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (inputText.trim() && activeChannel) send.mutate({ text: inputText.trim() }); }}
            className="p-3 border-t flex items-center gap-2">
            <input value={inputText} onChange={(e) => setInputText(e.target.value)}
              placeholder="Type message…"
              disabled={!activeChannel}
              className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-800 border" />
            <button type="submit" disabled={!inputText.trim() || !activeChannel || send.loading}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
