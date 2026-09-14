import React, { useState } from 'react';
import { User as UserIcon, Save } from 'lucide-react';
import { auth } from '../../services/auth';
import { profiles as profilesApi } from '../../services/api/profiles';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';

export function ProfileSettingsView() {
  const current = auth.getCurrentUser();
  const [name, setName] = useState(current?.name ?? '');
  const [email, setEmail] = useState(current?.email ?? '');
  const [phone, setPhone] = useState(current?.phone ?? '');
  const [message, setMessage] = useState<string | null>(null);

  const update = useSupabaseMutation({
    mutationFn: (patch: { name: string; email: string; phone: string }) =>
      profilesApi.updateSelf({ name: patch.name, phone: patch.phone }),
    onSuccess: () => setMessage('Profile updated.'),
    onError: (e) => setMessage(e.message),
  });

  if (!current) return <div className="p-6 text-slate-500">Please sign in.</div>;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <UserIcon className="w-6 h-6 text-blue-600" /> Account settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">Update your display name and contact details</p>
      </div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Username</label>
          <input disabled value={current.username} className="w-full rounded-md border bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
          <input disabled value={current.role} className="w-full rounded-md border bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Full name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Email (read-only)</label>
          <input disabled value={email} className="w-full rounded-md border bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
        </div>
        <button onClick={() => update.mutate({ name, email, phone })} disabled={update.loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          <Save className="w-4 h-4" /> Save changes
        </button>
        {message && <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
      </div>
    </div>
  );
}
