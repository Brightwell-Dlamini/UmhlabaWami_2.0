import React, { useMemo, useState } from 'react';
import {
  Users, Search, PlusCircle, CheckCircle2, Edit3, Trash2, X,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { profiles as profilesApi } from '../../services/api/profiles';
import { organizations as orgApi } from '../../services/api/organizations';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { User, UserRole } from '../../types';

const ALL_ROLES: UserRole[] = [
  'tenant',
  'property_manager',
  'maintenance',
  'finance',
  'admin',
  'super_admin',
];

const ORG_ROLES: UserRole[] = [
  'tenant',
  'property_manager',
  'maintenance',
  'finance',
  'admin',
];

export const OrgUsersView: React.FC = () => {
  const isSuper = auth.isSuperAdmin();
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [feedback, setFeedback] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const { data: orgs = [] } = useSupabaseQuery(
    ['super_orgs_for_users'],
    () => orgApi.list(),
    { enabled: isSuper }
  );

  const listKey = isSuper ? ['profiles', 'all'] : ['profiles', orgId];
  const { data: users = [] } = useSupabaseQuery(
    listKey,
    () => (isSuper ? profilesApi.listAll() : profilesApi.list(orgId)),
    { enabled: isSuper || !!orgId }
  );

  useRealtime({
    table: 'profiles',
    filter: isSuper ? undefined : `organization_id=eq.${orgId}`,
    invalidateKeys: isSuper ? ['profiles'] : ['profiles'],
    enabled: isSuper || !!orgId,
  });

  const invite = useSupabaseMutation({
    mutationFn: (args: {
      email: string;
      name: string;
      role: UserRole;
      phone?: string;
      organizationId?: string;
    }) => profilesApi.invite(args),
    invalidateKeys: ['profiles'],
    onSuccess: () => {
      setFeedback('Invite sent.');
      setTimeout(() => setFeedback(''), 3000);
      setShowInvite(false);
    },
  });
  const setRole = useSupabaseMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => profilesApi.setRole(id, role),
    invalidateKeys: ['profiles'],
    onSuccess: () => {
      setFeedback('Role updated.');
      setTimeout(() => setFeedback(''), 3000);
      setEditing(null);
    },
  });
  const setStatus = useSupabaseMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => profilesApi.setStatus(id, status),
    invalidateKeys: ['profiles'],
    onSuccess: () => {
      setFeedback('Status updated.');
      setTimeout(() => setFeedback(''), 3000);
    },
  });
  const remove = useSupabaseMutation({
    mutationFn: (id: string) => profilesApi.remove(id),
    invalidateKeys: ['profiles'],
    onSuccess: () => {
      setFeedback('User deactivated.');
      setTimeout(() => setFeedback(''), 3000);
    },
  });
  const reassignOrg = useSupabaseMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId: string | null }) =>
      profilesApi.assignOrganization(id, organizationId),
    invalidateKeys: ['profiles'],
    onSuccess: () => {
      setFeedback('Organisation assignment updated.');
      setTimeout(() => setFeedback(''), 3000);
    },
  });

  const orgName = (id?: string) =>
    orgs.find((o) => o.id === id)?.company_name || (id ? id.slice(0, 8) : '— platform —');

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (isSuper && orgFilter !== 'all') {
        if (orgFilter === 'none' && u.organization_id) return false;
        if (orgFilter !== 'none' && u.organization_id !== orgFilter) return false;
      }
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
      );
    });
  }, [users, search, isSuper, orgFilter]);

  if (!isSuper && !orgId) {
    return <div className="p-6 text-slate-500 text-sm">No organisation context.</div>;
  }

  const roleOptions = isSuper ? ALL_ROLES : ORG_ROLES;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {isSuper ? 'Platform user directory' : 'Staff & user roles'}
          </h1>
          <p className="text-xs text-slate-500">
            {isSuper
              ? 'Create, suspend, reassign and change roles for every user on the platform'
              : 'Manage admins, managers, technicians, finance'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" /> {isSuper ? 'Invite user' : 'Invite staff'}
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {feedback}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isSuper ? 'Search all users…' : 'Search staff…'}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border text-xs"
          />
        </div>
        {isSuper && (
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border text-xs max-w-xs"
          >
            <option value="all">All organisations</option>
            <option value="none">No organisation</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.company_name} ({o.organization_code})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                {isSuper && <th className="px-4 py-3">Organisation</th>}
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isSuper ? 7 : 6} className="p-8 text-center text-slate-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {(u.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold">{u.name}</div>
                          <div className="text-[10px] text-slate-500">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    {isSuper && (
                      <td className="px-4 py-3">
                        <select
                          value={u.organization_id || ''}
                          onChange={(e) =>
                            reassignOrg.mutate({
                              id: u.id,
                              organizationId: e.target.value || null,
                            })
                          }
                          className="max-w-[160px] px-2 py-1 rounded-lg border bg-transparent text-[11px]"
                        >
                          <option value="">— none —</option>
                          {orgs.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.company_name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="px-4 py-3 capitalize">{u.role.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <div>{u.email}</div>
                      <div className="text-[10px] text-slate-500">{u.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.status === 'Suspended'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Change role"
                          onClick={() => setEditing(u)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                        {u.status === 'Active' ? (
                          <button
                            type="button"
                            title="Suspend"
                            onClick={() => setStatus.mutate({ id: u.id, status: 'Suspended' })}
                            className="px-2 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-50 rounded-lg"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Activate"
                            onClick={() => setStatus.mutate({ id: u.id, status: 'Active' })}
                            className="px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          type="button"
                          title="Deactivate"
                          onClick={() => {
                            if (confirm(`Deactivate ${u.name}?`)) remove.mutate(u.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showInvite && (
        <InviteForm
          roles={roleOptions}
          orgs={isSuper ? orgs : []}
          requireOrg={isSuper}
          defaultOrgId={orgId}
          onCancel={() => setShowInvite(false)}
          onSubmit={(args) => invite.mutate(args)}
        />
      )}
      {editing && (
        <RoleForm
          user={editing}
          roles={roleOptions}
          onCancel={() => setEditing(null)}
          onSubmit={(role) => setRole.mutate({ id: editing.id, role })}
        />
      )}
    </div>
  );
};

function InviteForm({
  roles,
  orgs,
  requireOrg,
  defaultOrgId,
  onCancel,
  onSubmit,
}: {
  roles: UserRole[];
  orgs: { id: string; company_name: string; organization_code: string }[];
  requireOrg: boolean;
  defaultOrgId?: string;
  onCancel: () => void;
  onSubmit: (args: {
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
    organizationId?: string;
  }) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(roles.includes('property_manager') ? 'property_manager' : roles[0]);
  const [phone, setPhone] = useState('');
  const [organizationId, setOrganizationId] = useState(defaultOrgId || '');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> Invite user
          </h3>
          <button type="button" onClick={onCancel}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (requireOrg && !organizationId) {
              alert('Select an organisation.');
              return;
            }
            onSubmit({
              email,
              name,
              role,
              phone: phone || undefined,
              organizationId: organizationId || undefined,
            });
          }}
          className="space-y-3 text-xs"
        >
          {requireOrg && (
            <div>
              <label className="block font-semibold mb-1">Organisation</label>
              <select
                required
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
              >
                <option value="">Select organisation…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.company_name} ({o.organization_code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block font-semibold mb-1">Full name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border capitalize"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border">
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              Send invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleForm({
  user,
  roles,
  onCancel,
  onSubmit,
}: {
  user: User;
  roles: UserRole[];
  onCancel: () => void;
  onSubmit: (role: UserRole) => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full border p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Change role: {user.name}</h3>
          <button type="button" onClick={onCancel}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border text-xs capitalize"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border text-xs">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(role)}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
