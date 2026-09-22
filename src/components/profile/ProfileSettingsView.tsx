import React, { useState } from 'react';
import { User as UserIcon, Save, KeyRound, ShieldCheck } from 'lucide-react';
import { auth } from '../../services/auth';
import { profiles as profilesApi } from '../../services/api/profiles';
import { getSupabase } from '../../lib/supabase';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useToast } from '../ui/ToastProvider';
import { PasswordInput } from '../ui/PasswordInput';

export function ProfileSettingsView() {
  const current = auth.getCurrentUser();
  const toast = useToast();

  const [name, setName] = useState(current?.name ?? '');
  const [email] = useState(current?.email ?? '');
  const [phone, setPhone] = useState(current?.phone ?? '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const updateProfile = useSupabaseMutation({
    mutationFn: (patch: { name: string; phone: string }) =>
      profilesApi.updateSelf({ name: patch.name, phone: patch.phone }),
    onSuccess: () => toast.success('Profile updated'),
    onError: (e) => toast.error('Update failed', e.message),
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
    if (!currentPassword) {
      toast.error('Enter your current password', 'We need it to confirm it\'s you.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password too short', 'Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match', 'Please re-enter the new password.');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error('Same as current', 'Choose a different password.');
      return;
    }

    setPwSaving(true);
    try {
      const sb = getSupabase();
      // Step 1: verify the current password by signing in with the same
      // credentials in an isolated client. This prevents a session-hijack
      // scenario where an attacker changes the password without proving they
      // know the old one.
      const { createClient } = await import('@supabase/supabase-js');
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (!url || !key) {
        throw new Error('Supabase env vars missing.');
      }
      const isolated = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      const { error: verifyErr } = await isolated.auth.signInWithPassword({
        email: current.email,
        password: currentPassword,
      });
      if (verifyErr) {
        throw new Error('Current password is incorrect.');
      }

      // Step 2: apply the change on the primary client.
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success('Password updated', 'You\'ll stay signed in on this device.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (e) {
      toast.error(
        'Password change failed',
        e instanceof Error ? e.message : 'Could not update password.'
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
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-600" />
            Change password
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            You must enter your current password to make this change.
          </p>
        </div>

        <PasswordInput
          label="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Your current password"
          autoComplete="current-password"
          className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
        />

        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
        />

        <PasswordInput
          label="Confirm new password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder="Repeat new password"
          autoComplete="new-password"
          className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
        />

        <button
          type="button"
          onClick={handleChangePassword}
          disabled={pwSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          <ShieldCheck className="w-4 h-4" />
          {pwSaving ? 'Verifying…' : 'Update password'}
        </button>
      </div>
    </div>
  );
}
