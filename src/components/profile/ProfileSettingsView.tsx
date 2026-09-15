import React, { useState } from 'react';
import { User as UserIcon, Save, KeyRound } from 'lucide-react';
import { auth } from '../../services/auth';
import { profiles as profilesApi } from '../../services/api/profiles';
import { getSupabase } from '../../lib/supabase';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';

export function ProfileSettingsView() {
  const current = auth.getCurrentUser();

  const [name, setName] = useState(current?.name ?? '');
  const [email] = useState(current?.email ?? '');
  const [phone, setPhone] = useState(current?.phone ?? '');
  const [message, setMessage] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const updateProfile = useSupabaseMutation({
    mutationFn: (patch: { name: string; phone: string }) =>
      profilesApi.updateSelf({ name: patch.name, phone: patch.phone }),
    onSuccess: () => setMessage('Profile updated.'),
    onError: (e) => setMessage(e.message),
  });

  if (!current) {
    return (
      <div className="p-6 text-slate-500">
        Please sign in to manage your profile.
      </div>
    );
  }

  const handleSave = () => {
    updateProfile.mutate({ name, phone });
  };

  const handleChangePassword = async () => {
    setPwMessage(null);

    if (newPassword.length < 8) {
      setPwMessage('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwMessage('Passwords do not match.');
      return;
    }

    setPwSaving(true);
    try {
      const { error } = await getSupabase().auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPwMessage('Password updated.');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (e) {
      setPwMessage(
        e instanceof Error ? e.message : 'Failed to update password.'
      );
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white font-display flex items-center gap-2">
          <UserIcon className="w-6 h-6 text-blue-600" />
          Account settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Update your display name and contact details. Username and role are
          managed by your organisation administrator.
        </p>
      </div>

      {/* Profile details */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Username
          </label>
          <input
            disabled
            value={current.username}
            className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Role
          </label>
          <input
            disabled
            value={current.role}
            className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Full name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Email (read-only)
          </label>
          <input
            disabled
            value={email}
            className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Phone
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={updateProfile.loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {updateProfile.loading ? 'Saving…' : 'Save changes'}
        </button>

        {message && (
          <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
        )}
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-600" />
            Change password
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Choose a new password. You'll stay signed in on this device.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            New password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Confirm new password
          </label>
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="Repeat password"
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={handleChangePassword}
          disabled={pwSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {pwSaving ? 'Saving…' : 'Update password'}
        </button>

        {pwMessage && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {pwMessage}
          </p>
        )}
      </div>
    </div>
  );
}
