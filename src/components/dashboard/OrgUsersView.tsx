import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  PlusCircle,
  CheckCircle2,
  Edit3,
  Trash2,
  Shield,
} from 'lucide-react';
import { PasswordInput } from '../ui/PasswordInput';
import { Modal } from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
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
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<'ok' | 'error'>('ok');
  const [showAddStaff, setShowAddStaff] = useState(false);
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
    invalidateKeys: ['profiles'],
    enabled: isSuper || !!orgId,
  });

  const flash = (text: string, tone: 'ok' | 'error' = 'ok', ms = 5000) => {
    setFeedbackTone(tone);
    setFeedback(text);
    setTimeout(() => setFeedback(''), ms);
  };

  const addStaff = useSupabaseMutation({
    mutationFn: (args: {
      email: string;
      name: string;
      role: UserRole;
      phone?: string;
      organizationId?: string | null;
      password?: string;
    }) => profilesApi.addStaff(args),
    invalidateKeys: ['profiles'],
    onSuccess: (result) => {
      const pwdHint = result.temporaryPassword
        ? ` Temporary password: ${result.temporaryPassword}`
        : result.warning
          ? ` ${result.warning}`
          : '';
      flash(`Staff member added.${pwdHint}`, 'ok', 8000);
      setShowAddStaff(false);
    },
    onError: (e) => flash(`Could not add staff: ${e.message}`, 'error', 8000),
  });

  const updateUser = useSupabaseMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<
        Pick<
          User,
          'name' | 'email' | 'phone' | 'role' | 'status' | 'organization_id' | 'username'
        >
      >;
    }) => profilesApi.updateAsAdmin(id, patch),
    invalidateKeys: ['profiles'],
    onSuccess: () => {
      flash('User updated.');
      setEditing(null);
    },
    onError: (e) => flash(`Update failed: ${e.message}`, 'error'),
  });

  const setRole = useSupabaseMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      profilesApi.setRole(id, role),
    invalidateKeys: ['profiles'],
    onSuccess: () => {
      flash('Role updated.');
      setEditing(null);
    },
  });

  const setStatus = useSupabaseMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      profilesApi.setStatus(id, status),
    invalidateKeys: ['profiles'],
    onSuccess: () => flash('Status updated.'),
    onError: (e) => flash(`Status change failed: ${e.message}`, 'error'),
  });

  const remove = useSupabaseMutation({
    mutationFn: (id: string) => profilesApi.remove(id),
    invalidateKeys: ['profiles'],
    onSuccess: () => flash('User deactivated.'),
  });

  const purge = useSupabaseMutation({
    mutationFn: (id: string) => profilesApi.purge(id),
    invalidateKeys: ['profiles'],
    onSuccess: () => flash('User purged from organisation and deactivated.'),
  });

  const reassignOrg = useSupabaseMutation({
    mutationFn: ({
      id,
      organizationId,
    }: {
      id: string;
      organizationId: string | null;
    }) => profilesApi.assignOrganization(id, organizationId),
    invalidateKeys: ['profiles'],
    onSuccess: () => flash('Organisation assignment updated.'),
  });

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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {isSuper && <Shield className="w-6 h-6 text-blue-600" />}
            {isSuper ? 'Platform user directory' : 'Staff & user roles'}
          </h1>
          <p className="text-xs text-slate-500">
            {isSuper
              ? 'Full control: create, edit, suspend, reassign, promote or deactivate every user on the platform'
              : 'Manage admins, managers, technicians, finance and tenant portal logins'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddStaff(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" /> Add staff
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
            feedbackTone === 'error'
              ? 'bg-red-50 border-red-300 text-red-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
          }`}
        >
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
            <option value="none">No organisation (platform)</option>
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
                  <tr
                    key={u.id}
                    onClick={() => setEditing(u)}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 cursor-pointer"
                  >
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
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                    <td className="px-4 py-3 capitalize">
                      {u.role.replace(/_/g, ' ')}
                    </td>
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
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Edit user"
                          onClick={() => setEditing(u)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                        {u.status === 'Active' ? (
                          <button
                            type="button"
                            title="Suspend"
                            onClick={() =>
                              setStatus.mutate({ id: u.id, status: 'Suspended' })
                            }
                            className="px-2 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-50 rounded-lg"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Activate"
                            onClick={() =>
                              setStatus.mutate({ id: u.id, status: 'Active' })
                            }
                            className="px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          type="button"
                          title="Deactivate"
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Deactivate ${u.name}?`,
                              message:
                                'They will lose access immediately. Their tickets and records are kept and can be reactivated later.',
                              confirmLabel: 'Deactivate',
                              tone: 'danger',
                            });
                            if (ok) remove.mutate(u.id);
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

      {showAddStaff && (
        <AddStaffForm
          roles={roleOptions}
          orgs={
            isSuper
              ? orgs
              : auth.getCurrentOrganization()
                ? [
                    {
                      id: auth.getCurrentOrganization()!.id,
                      company_name: auth.getCurrentOrganization()!.company_name,
                      organization_code:
                        auth.getCurrentOrganization()!.organization_code || '',
                    },
                  ]
                : []
          }
          requireOrg={!isSuper}
          allowNoOrg={isSuper}
          defaultOrgId={orgId}
          lockOrg={!isSuper && !!orgId}
          onCancel={() => setShowAddStaff(false)}
          onSubmit={async (args) => {
            try {
              await addStaff.mutate(args);
            } catch {
              /* onError flashes */
            }
          }}
          submitting={addStaff.loading}
          submitError={addStaff.error?.message ?? null}
        />
      )}

      {editing && (
        <FullEditForm
          user={editing}
          roles={roleOptions}
          orgs={isSuper ? orgs : []}
          isSuper={isSuper}
          onCancel={() => setEditing(null)}
          onSave={(patch) => updateUser.mutate({ id: editing.id, patch })}
          onRoleOnly={(role) => setRole.mutate({ id: editing.id, role })}
        />
      )}

      {/* purge() is exposed for super admins through the profile API and is
          intentionally not surfaced as a one-click action in the UI — the
          deactivate flow above is reversible, purge is not. Kept mounted so
          the mutation's hooks run and can be triggered programmatically if
          needed later. */}
      {false && purge && null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Modals — both use the shared <Modal> primitive.
// ---------------------------------------------------------------------------

function AddStaffForm({
  roles,
  orgs,
  requireOrg,
  allowNoOrg,
  defaultOrgId,
  lockOrg,
  onCancel,
  onSubmit,
  submitting = false,
  submitError = null,
}: {
  roles: UserRole[];
  orgs: { id: string; company_name: string; organization_code: string }[];
  requireOrg: boolean;
  allowNoOrg?: boolean;
  defaultOrgId?: string;
  lockOrg?: boolean;
  onCancel: () => void;
  onSubmit: (args: {
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
    organizationId?: string | null;
    password?: string;
  }) => void | Promise<void>;
  submitting?: boolean;
  submitError?: string | null;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(
    roles.includes('property_manager') ? 'property_manager' : roles[0]
  );
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState(
    () => defaultOrgId || orgs[0]?.id || ''
  );

  // Reset the draft whenever the modal re-opens with a different target org.
  useEffect(() => {
    setEmail('');
    setName('');
    setRole(roles.includes('property_manager') ? 'property_manager' : roles[0]);
    setPhone('');
    setPassword('');
    setOrganizationId(defaultOrgId || orgs[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgs, defaultOrgId]);

  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title="Add staff member"
      icon={<Users className="w-5 h-5 text-blue-600" />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (requireOrg && !organizationId) return;
          if (password && password.length < 8) return;
          void onSubmit({
            email,
            name,
            role,
            phone: phone || undefined,
            organizationId: organizationId || null,
            password: password || undefined,
          });
        }}
        className="space-y-3 text-xs"
      >
        {(requireOrg || allowNoOrg) && (
          <div>
            <label className="block font-semibold mb-1">Organisation</label>
            {lockOrg ? (
              <div className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900/80 border text-xs font-medium">
                {orgs[0]
                  ? `${orgs[0].company_name} (${orgs[0].organization_code})`
                  : 'Your organisation'}
              </div>
            ) : (
              <select
                required={requireOrg}
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
              >
                <option value="">
                  {allowNoOrg ? '— platform (no org) —' : 'Select organisation…'}
                </option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.company_name} ({o.organization_code})
                  </option>
                ))}
              </select>
            )}
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

        <PasswordInput
          label="Temporary password (optional)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 characters — leave blank to auto-generate"
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border text-xs"
          autoComplete="new-password"
        />

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
          {role === 'tenant' && (
            <p className="text-[10px] text-slate-400 mt-1">
              After creating this portal login, open{' '}
              <strong>Tenants Directory</strong> and link them to the occupancy
              record so tickets, lease and documents work.
            </p>
          )}
        </div>

        {submitError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
            {submitError}
          </div>
        )}

        <div className="pt-3 flex justify-end gap-2 border-t">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold"
          >
            {submitting ? 'Adding…' : 'Add staff'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Full edit form for a user record.
 *
 * `orgs`, `isSuper`, and `onRoleOnly` are accepted in the props for backwards
 * compatibility with the parent call site, but are not used inside — the
 * parent's `updateUser` mutation routes role changes through `updateAsAdmin`,
 * which enforces the same server-side permission checks as `setRole`.
 */
function FullEditForm({
  user,
  roles,
  onCancel,
  onSave,
}: {
  user: User;
  roles: UserRole[];
  orgs: { id: string; company_name: string }[];
  isSuper: boolean;
  onCancel: () => void;
  onSave: (
    patch: Partial<
      Pick<
        User,
        'name' | 'email' | 'phone' | 'role' | 'status' | 'organization_id' | 'username'
      >
    >
  ) => void;
  onRoleOnly: (role: UserRole) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState<User['status']>(user.status);

  // Reset the draft if the parent swaps the target user while the modal is
  // open (e.g. from the org-selector side effects).
  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone ?? '');
    setRole(user.role);
    setStatus(user.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title={`Edit ${user.name}`}
      icon={<Edit3 className="w-5 h-5 text-blue-600" />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name,
            email,
            phone: phone || undefined,
            role,
            status,
          });
        }}
        className="space-y-3 text-xs"
      >
        <div>
          <label className="block font-semibold mb-1">Name</label>
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

        <div>
          <label className="block font-semibold mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as User['status'])}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
          >
            <option>Active</option>
            <option>Suspended</option>
            <option>Inactive</option>
            <option>Pending</option>
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
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
