import React, { useMemo, useState } from 'react';
import {
  Users, Search, PlusCircle, CheckCircle2, Edit3, Trash2, X,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { profiles as profilesApi } from '../../services/api/profiles';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { User, UserRole } from '../../types';

export const OrgUsersView: React.FC = () => {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const { data: users = [] } = useSupabaseQuery(['profiles', orgId], () => profilesApi.list(), { enabled: !!orgId });

  useRealtime({
    table: 'profiles',
    filter: `organization_id=eq.${orgId}`,
    invalidateKeys: ['profiles'],
    enabled: !!orgId,
  });

  const invite = useSupabaseMutation({
    mutationFn: (args: { email: string; name: string; role: UserRole; phone?: string }) => profilesApi.invite(args),
    invalidateKeys: ['profiles'],
    onSuccess: () => { setFeedback('Invite sent.'); setTimeout(() => setFeedback(''), 3000); setShowInvite(false); },
  });
  const setRole = useSupabaseMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => profilesApi.setRole(id, role),
    invalidateKeys: ['profiles'],
    onSuccess: () => { setFeedback('Role updated.'); setTimeout(() => setFeedback(''), 3000); setEditing(null); },
  });
  const setStatus = useSupabaseMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => profilesApi.setStatus(id, status),
    invalidateKeys: ['profiles'],
    onSuccess: () => { setFeedback('Status updated.'); setTimeout(() => setFeedback(''), 3000); },
  });
  const remove = useSupabaseMutation({
    mutationFn: (id: string) => profilesApi.remove(id),
    invalidateKeys: ['profiles'],
    onSuccess: () => { setFeedback('User deactivated.'); setTimeout(() => setFeedback(''), 3000); },
  });

  const filtered = useMemo(() => users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  }), [users, search]);

  if (!orgId) return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Staff & user roles</h1>
          <p className="text-xs text-slate-500">Manage admins, managers, technicians, finance</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
          <PlusCircle className="w-4 h-4" /> Invite staff
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {feedback}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff…"
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border text-xs" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 flex items-center justify-center font-bold text-xs">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold">{u.name}</div>
                        <div className="text-[11px] text-slate-400">@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 capitalize">
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>{u.email}</div>
                    <div className="text-[11px] text-slate-400">{u.phone || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setStatus.mutate({ id: u.id, status: u.status === 'Active' ? 'Suspended' : 'Active' })}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        u.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                      {u.status || 'Active'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => setEditing(u)}
                        className="p-1.5 rounded-lg border text-slate-600 hover:bg-slate-100">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm(`Deactivate ${u.name}?`)) remove.mutate(u.id); }}
                        className="p-1.5 rounded-lg border text-red-500 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showInvite && (
        <InviteForm onCancel={() => setShowInvite(false)}
          onSubmit={(args) => invite.mutate(args)} />
      )}
      {editing && (
        <RoleForm user={editing} onCancel={() => setEditing(null)}
          onSubmit={(role) => setRole.mutate({ id: editing.id, role })} />
      )}
    </div>
  );
};

function InviteForm({
  onCancel, onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (args: { email: string; name: string; role: UserRole; phone?: string }) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('property_manager');
  const [phone, setPhone] = useState('+268 ');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Invite staff member</h3>
          <button onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ email, name, role, phone }); }}
          className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Full name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Email *</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border capitalize">
              <option value="property_manager">Property Manager</option>
              <option value="maintenance">Maintenance</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
              <option value="tenant">Tenant</option>
            </select>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
              Send invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleForm({
  user, onCancel, onSubmit,
}: {
  user: User;
  onCancel: () => void;
  onSubmit: (role: UserRole) => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full border p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Change role: {user.name}</h3>
          <button onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border text-xs capitalize">
          <option value="property_manager">Property Manager</option>
          <option value="maintenance">Maintenance</option>
          <option value="finance">Finance</option>
          <option value="admin">Admin</option>
          <option value="tenant">Tenant</option>
        </select>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border text-xs">Cancel</button>
          <button onClick={() => onSubmit(role)}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
