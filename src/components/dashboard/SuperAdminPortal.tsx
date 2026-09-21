import React, { useMemo, useState } from 'react';
import {
  Shield,
  CheckCircle2,
  History,
  Download,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { organizations as orgApi } from '../../services/api/organizations';
import { shops as shopsApi } from '../../services/api/shops';
import { auditLogs as auditApi } from '../../services/api/auditLogs';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import { downloadCsv } from '../../services/api/_export';

interface Props {
  initialTab?: string;
}

type Tab = 'approvals' | 'organizations' | 'listings' | 'audit' | 'subscriptions';

export const SuperAdminPortal: React.FC<Props> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState<Tab>(
    initialTab === 'super_organizations' ? 'organizations'
    : initialTab === 'super_listings' ? 'listings'
    : initialTab === 'audit_logs' ? 'audit'
    : initialTab === 'super_subscriptions' ? 'subscriptions'
    : 'approvals'
  );

  const [actionNotice, setActionNotice] = useState('');
  const [customCode, setCustomCode] = useState('');

  const { data: orgs = [] } = useSupabaseQuery(['super_orgs'], () => orgApi.list());
  const { data: shops = [] } = useSupabaseQuery(['super_shops'], () =>
    shopsApi.publicAvailable()
  );
  const { data: logs = [] } = useSupabaseQuery(
    ['super_audit'],
    () => auditApi.list(undefined as never, 200),
    { enabled: activeTab === 'audit' }
  );

  useRealtime({ table: 'organizations', invalidateKeys: ['super_orgs'] });
  useRealtime({
    table: 'audit_logs',
    invalidateKeys: ['super_audit'],
    enabled: activeTab === 'audit',
  });

  const approve = useSupabaseMutation({
    mutationFn: ({ orgId }: { orgId: string }) =>
      orgApi.approve({
        organizationId: orgId,
        approverName: auth.getCurrentUser()?.name ?? 'Super Admin',
        customCode: customCode.trim() || undefined,
      }),
    invalidateKeys: ['super_orgs'],
    onSuccess: (res) => {
      setActionNotice(`Approved — code ${res.organizationCode}.`);
      setTimeout(() => setActionNotice(''), 5000);
      setCustomCode('');
    },
    onError: (e) => {
      setActionNotice(`Approval failed: ${e.message}`);
      setTimeout(() => setActionNotice(''), 6000);
    },
  });

  const reject = useSupabaseMutation({
    mutationFn: ({ orgId }: { orgId: string }) =>
      orgApi.reject({
        organizationId: orgId,
        approverName: auth.getCurrentUser()?.name ?? 'Super Admin',
        reason: 'Application not approved.',
      }),
    invalidateKeys: ['super_orgs'],
    onSuccess: () => {
      setActionNotice('Rejected.');
      setTimeout(() => setActionNotice(''), 3000);
    },
  });

  const pending = useMemo(
    () => orgs.filter((o) => o.status === 'Pending Approval'),
    [orgs]
  );

  const exportBackup = () => {
    downloadCsv(
      `umhlaba-wami-orgs-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Code', 'Company', 'Owner', 'Email', 'Tier', 'Status'],
        ...orgs.map((o) => [
          o.organization_code,
          o.company_name,
          o.owner_name,
          o.email,
          o.subscription_tier,
          o.status,
        ]),
      ]
    );
    setActionNotice('Exported.');
    setTimeout(() => setActionNotice(''), 2500);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="p-6 rounded-2xl bg-gradient-to-r from-red-800 to-slate-950 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold px-2 py-0.5 rounded bg-red-500/30 text-red-200 inline-block">
            Super admin console
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Shield className="w-6 h-6" /> Platform governance
          </h1>
          <p className="text-xs text-slate-300">
            Review applications, manage organisations, audit
          </p>
        </div>
        <button
          onClick={exportBackup}
          className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {actionNotice}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { id: 'approvals', label: `Approvals (${pending.length})` },
          { id: 'organizations', label: `Organisations (${orgs.length})` },
          { id: 'subscriptions', label: 'Subscription Tiers' },
          { id: 'listings', label: `Units (${shops.length})` },
          { id: 'audit', label: 'Audit' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as Tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${
              activeTab === t.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {pending.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              All caught up.
            </div>
          ) : (
            pending.map((org) => (
              <div
                key={org.id}
                className="p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-amber-300 dark:border-amber-700 space-y-4"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        {org.company_name}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                        Pending
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {org.owner_name} · {org.email} · {org.phone}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-slate-500">Tier</div>
                    <strong className="text-blue-600">{org.subscription_tier}</strong>
                    {org.monthly_fee_estimate && (
                      <div className="font-bold mt-1">
                        E{org.monthly_fee_estimate.toLocaleString()}/mo
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <Stat label="Property limit" value={org.property_limit} />
                  <Stat label="Tenant capacity" value={org.tenant_limit} />
                  <Stat label="Staff logins" value={org.user_limit} />
                  <Stat label="Storage (GB)" value={org.storage_limit} />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">
                        Custom code (auto if blank)
                      </label>
                      <input
                        value={customCode}
                        onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                        placeholder="e.g. GAB-140926-0001"
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
                    <button
                      onClick={() => reject.mutate({ orgId: org.id })}
                      disabled={reject.loading}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => approve.mutate({ orgId: org.id })}
                      disabled={approve.loading}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {approve.loading ? 'Approving…' : 'Approve & issue code'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'organizations' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-mono font-bold text-blue-600">
                    {o.organization_code}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold">{o.company_name}</div>
                    <div className="text-[10px] text-slate-500">
                      {o.owner_name} · {o.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3">{o.subscription_tier}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        o.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'listings' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-bold mb-3">
            Platform units (read-only overview)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shops.length === 0 ? (
              <div className="col-span-full p-8 text-center text-xs text-slate-400">
                No public listings.
              </div>
            ) : (
              shops.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"
                >
                  <div className="text-xs font-bold">Unit {s.shop_number}</div>
                  <div className="text-[11px] text-slate-500">
                    {s.property_type} · {s.size_sqm} m²
                  </div>
                  <div className="text-xs font-bold text-blue-600 mt-1">
                    E{s.rental_amount.toLocaleString()}/mo
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-sm font-bold mb-2">Subscription tiers</h2>
          <p className="text-xs text-slate-500 mb-4">
            Tier definitions and current usage across the platform
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['Starter', 'Professional', 'Enterprise'] as const).map((tier) => {
              const count = orgs.filter((o) => o.subscription_tier === tier).length;
              const price =
                tier === 'Starter' ? 1450 : tier === 'Professional' ? 3850 : 8900;
              const limits =
                tier === 'Starter'
                  ? { props: 3, tenants: 100, users: 10, gb: 10 }
                  : tier === 'Professional'
                  ? { props: 10, tenants: 500, users: 50, gb: 50 }
                  : { props: 999, tenants: 9999, users: 999, gb: 500 };
              return (
                <div
                  key={tier}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    {tier}
                  </div>
                  <div className="text-2xl font-bold">
                    E {price.toLocaleString()}
                    <span className="text-[10px] font-normal text-slate-500">
                      /mo
                    </span>
                  </div>
                  <ul className="text-[11px] text-slate-500 space-y-1">
                    <li>• Up to {limits.props} properties</li>
                    <li>• {limits.tenants} active tenants</li>
                    <li>• {limits.users} staff logins</li>
                    <li>• {limits.gb} GB storage</li>
                  </ul>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {count}
                    </span>{' '}
                    <span className="text-slate-500">
                      organisation{count === 1 ? '' : 's'} on this tier
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-bold flex items-center gap-1.5 mb-3">
            <History className="w-4 h-4 text-blue-600" /> System audit trail
          </h2>
          <div className="divide-y max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No logs.
              </div>
            ) : (
              logs.map((l) => (
                <div
                  key={l.id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                        {l.action}
                      </span>
                      <span className="font-semibold">{l.user_name}</span>
                      <span className="text-[11px] text-slate-500 truncate">
                        {l.details}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(l.timestamp).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60">
      <span className="text-[10px] text-slate-500">{label}</span>
      <div className="font-bold">{value}</div>
    </div>
  );
}
