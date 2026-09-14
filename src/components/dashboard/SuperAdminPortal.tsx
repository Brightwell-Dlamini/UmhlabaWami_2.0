import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield, Layers, CheckCircle2, XCircle, History, Download, Store, Sliders, Database,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { organizations as orgApi } from '../../services/api/organizations';
import { auditLogs as auditApi } from '../../services/api/auditLogs';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import { downloadCsv } from '../../services/api/_export';
import type { Organization, SubscriptionTier } from '../../types';

interface Props {
  initialTab?: string;
}

type Tab = 'approvals' | 'organizations' | 'audit' | 'subscriptions' | 'backup';

export const SuperAdminPortal: React.FC<Props> = ({ initialTab }) => {
  const mapTab = (t?: string): Tab => {
    if (t === 'super_organizations') return 'organizations';
    if (t === 'audit_logs') return 'audit';
    if (t === 'super_subscriptions') return 'subscriptions';
    if (t === 'db_backup') return 'backup';
    if (t === 'super_approvals') return 'approvals';
    return 'approvals';
  };

  const [activeTab, setActiveTab] = useState<Tab>(mapTab(initialTab));
  useEffect(() => {
    setActiveTab(mapTab(initialTab));
  }, [initialTab]);

  const [actionNotice, setActionNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const { data: orgs = [] } = useSupabaseQuery(['super_orgs'], () => orgApi.list());
  const { data: logs = [] } = useSupabaseQuery(
    ['super_audit'],
    () => auditApi.list(undefined as never, 200),
    { enabled: activeTab === 'audit' }
  );

  useRealtime({ table: 'organizations', invalidateKeys: ['super_orgs'] });
  useRealtime({ table: 'audit_logs', invalidateKeys: ['super_audit'], enabled: activeTab === 'audit' });

  const pending = useMemo(
    () => orgs.filter((o) => o.status === 'Pending Approval'),
    [orgs]
  );

  const approve = useSupabaseMutation({
    mutationFn: ({ orgId }: { orgId: string }) =>
      orgApi.approve({
        organizationId: orgId,
        approverName: auth.getCurrentUser()?.name ?? 'Super Admin',
        customCode: customCode.trim() || undefined,
        adminEmail: adminEmail.trim() || undefined,
      }),
    invalidateKeys: ['super_orgs'],
    onSuccess: (res) => {
      setActionError('');
      setActionNotice(
        `Approved — code ${res.organizationCode}${res.inviteSent ? ' · invite email sent' : ''}.`
      );
      setTimeout(() => setActionNotice(''), 6000);
      setCustomCode('');
      setAdminEmail('');
    },
    onError: (err: Error) => {
      setActionNotice('');
      setActionError(err?.message || 'Approval failed');
      setTimeout(() => setActionError(''), 8000);
    },
  });

  const reject = useSupabaseMutation({
    mutationFn: ({ orgId }: { orgId: string }) =>
      orgApi.reject({
        organizationId: orgId,
        approverName: auth.getCurrentUser()?.name ?? 'Super Admin',
        reason: 'Rejected by super admin',
      }),
    invalidateKeys: ['super_orgs'],
    onSuccess: () => {
      setActionNotice('Organisation rejected.');
      setTimeout(() => setActionNotice(''), 4000);
    },
  });

  const setStatus = useSupabaseMutation({
    mutationFn: ({ id, status }: { id: string; status: Organization['status'] }) =>
      orgApi.setStatus(id, status),
    invalidateKeys: ['super_orgs'],
    onSuccess: () => {
      setActionNotice('Organisation status updated.');
      setTimeout(() => setActionNotice(''), 3000);
    },
  });

  const setTier = useSupabaseMutation({
    mutationFn: ({ id, tier }: { id: string; tier: SubscriptionTier }) =>
      orgApi.setTier(id, tier),
    invalidateKeys: ['super_orgs'],
    onSuccess: () => {
      setActionNotice('Subscription tier updated (limits applied).');
      setTimeout(() => setActionNotice(''), 3000);
    },
  });

  const exportOrgs = () => {
    const rows: (string | number)[][] = [
      ['Code', 'Company', 'Owner', 'Email', 'Phone', 'Tier', 'Status', 'Created'],
      ...orgs.map((o) => [
        o.organization_code,
        o.company_name,
        o.owner_name,
        o.email,
        o.phone,
        o.subscription_tier,
        o.status,
        o.created_at,
      ]),
    ];
    downloadCsv('umhlaba-wami-organizations.csv', rows);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'approvals', label: `Approvals (${pending.length})`, icon: Shield },
    { id: 'organizations', label: 'Organisations', icon: Layers },
    { id: 'subscriptions', label: 'Tiers', icon: Sliders },
    { id: 'audit', label: 'Audit', icon: History },
    { id: 'backup', label: 'Backup', icon: Database },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" /> Super Admin Console
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Full platform control — organisations, users, tiers, audit and recovery tools
          </p>
        </div>
        <button type="button" onClick={exportOrgs} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold">
          <Download className="w-3.5 h-3.5" /> Export orgs CSV
        </button>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">{actionNotice}</div>
      )}
      {actionError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">{actionError}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total orgs" value={orgs.length} />
        <Stat label="Pending" value={pending.length} />
        <Stat label="Active" value={orgs.filter((o) => o.status === 'Active').length} />
        <Stat label="Suspended" value={orgs.filter((o) => o.status === 'Suspended').length} />
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              activeTab === t.id ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {pending.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400 border rounded-2xl bg-white dark:bg-slate-800">No organisations awaiting approval.</div>
          ) : pending.map((org) => (
            <div key={org.id} className="bg-white dark:bg-slate-800 rounded-2xl border p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-base">{org.company_name}</div>
                  <div className="text-xs text-slate-500">{org.owner_name} · {org.email} · {org.phone}</div>
                  <div className="text-[11px] text-slate-400 mt-1">{org.address} · Tier requested: {org.subscription_tier}</div>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-amber-100 text-amber-800">{org.status}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Custom org code (optional)</label>
                  <input value={customCode} onChange={(e) => setCustomCode(e.target.value.toUpperCase())} placeholder="e.g. GAB-140926-0001" className="w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs bg-white dark:bg-slate-800" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Admin email (auto = org email)</label>
                  <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@company.sz" className="w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-800" />
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button type="button" onClick={() => reject.mutate({ orgId: org.id })} className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1"><XCircle className="w-4 h-4" /> Reject</button>
                <button type="button" onClick={() => approve.mutate({ orgId: org.id })} disabled={approve.loading} className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {approve.loading ? 'Approving…' : 'Approve & issue code'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'organizations' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-mono font-bold text-blue-600">{o.organization_code}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold">{o.company_name}</div>
                    <div className="text-[10px] text-slate-500">{o.owner_name} · {o.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select value={o.subscription_tier} onChange={(e) => setTier.mutate({ id: o.id, tier: e.target.value as SubscriptionTier })} className="px-2 py-1 rounded-lg border bg-transparent text-[11px]">
                      <option value="Starter">Starter</option>
                      <option value="Professional">Professional</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select value={o.status} onChange={(e) => setStatus.mutate({ id: o.id, status: e.target.value as Organization['status'] })} className="px-2 py-1 rounded-lg border bg-transparent text-[11px]">
                      <option value="Pending Approval">Pending Approval</option>
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {o.status === 'Active' ? (
                      <button type="button" onClick={() => setStatus.mutate({ id: o.id, status: 'Suspended' })} className="text-[10px] font-semibold text-amber-700 hover:underline">Suspend</button>
                    ) : o.status === 'Suspended' ? (
                      <button type="button" onClick={() => setStatus.mutate({ id: o.id, status: 'Active' })} className="text-[10px] font-semibold text-emerald-700 hover:underline">Reactivate</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div className="grid md:grid-cols-3 gap-4">
          {([
            { tier: 'Starter' as SubscriptionTier, price: 'E999', limits: '2 centres · 50 tenants · 10 users' },
            { tier: 'Professional' as SubscriptionTier, price: 'E2,999', limits: '10 centres · 250 tenants · 40 users' },
            { tier: 'Enterprise' as SubscriptionTier, price: 'Custom', limits: 'Unlimited centres · priority support' },
          ] as const).map((card) => {
            const count = orgs.filter((o) => o.subscription_tier === card.tier).length;
            return (
              <div key={card.tier} className="rounded-2xl border bg-white dark:bg-slate-800 p-5 space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">{card.tier}</div>
                <div className="text-2xl font-bold">{card.price}</div>
                <p className="text-xs text-slate-500">{card.limits}</p>
                <p className="text-sm font-semibold pt-2">{count} organisation(s)</p>
              </div>
            );
          })}
          <p className="md:col-span-3 text-xs text-slate-500">Edit limits via Subscription Tiers config. Change an organisation's tier from the Organisations tab — limits update automatically.</p>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-5">
          <h2 className="text-sm font-bold flex items-center gap-1.5 mb-3"><History className="w-4 h-4 text-blue-600" /> System audit trail</h2>
          <div className="divide-y max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No logs.</div>
            ) : logs.map((l) => (
              <div key={l.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700">{l.action}</span>
                    <span className="font-semibold">{l.user_name}</span>
                    <span className="text-[11px] text-slate-500 truncate">{l.details}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{new Date(l.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border p-6 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2"><Database className="w-4 h-4 text-blue-600" /> Database backup</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Logical backups are managed in the Supabase project (Dashboard → Database → Backups) or via the Supabase CLI.
            Export organisation CSVs from this console for operational recovery copies.
          </p>
          <button type="button" onClick={exportOrgs} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Download organisations CSV</button>
        </div>
      )}
    </div>
  );
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
      <span className="text-[10px] text-slate-500">{label}</span>
      <div className="font-bold text-lg tabular-nums">{value}</div>
    </div>
  );
}
