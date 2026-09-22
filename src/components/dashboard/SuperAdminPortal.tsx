import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  CheckCircle2,
  History,
  Download,
  Building2,
  Layers,
  Sliders,
  AlertTriangle,
  X,
  Pencil,
  Ban,
  Play,
  Sparkles,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { organizations as orgApi } from '../../services/api/organizations';
import { shops as shopsApi } from '../../services/api/shops';
import { auditLogs as auditApi } from '../../services/api/auditLogs';
import { subscriptionPlans, type TierPlan } from '../../services/subscriptionPlans';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import { downloadCsv } from '../../services/api/_export';
import type { Organization, SubscriptionTier } from '../../types';

interface Props {
  initialTab?: string;
}

type Tab =
  | 'overview'
  | 'approvals'
  | 'organizations'
  | 'listings'
  | 'audit'
  | 'subscriptions';

function tabFromSidebar(initialTab?: string): Tab {
  switch (initialTab) {
    case 'super_organizations':
      return 'organizations';
    case 'super_listings':
      return 'listings';
    case 'audit_logs':
      return 'audit';
    case 'super_subscriptions':
      return 'subscriptions';
    case 'super_approvals':
      return 'approvals';
    case 'super_overview':
    default:
      return 'overview';
  }
}

export const SuperAdminPortal: React.FC<Props> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState<Tab>(() => tabFromSidebar(initialTab));

  useEffect(() => {
    setActiveTab(tabFromSidebar(initialTab));
  }, [initialTab]);

  const [actionNotice, setActionNotice] = useState('');
  const [plans, setPlans] = useState<TierPlan[]>(() => subscriptionPlans.list());
  const [editingPlan, setEditingPlan] = useState<TierPlan | null>(null);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

  const { data: orgs = [] } = useSupabaseQuery(['super_orgs'], () => orgApi.list());
  const { data: shops = [] } = useSupabaseQuery(['super_shops'], () => shopsApi.publicAvailable());
  const { data: logs = [], refetch: refetchLogs } = useSupabaseQuery(
    ['super_audit'],
    () => auditApi.list(undefined, 200),
    { enabled: activeTab === 'audit' || activeTab === 'overview' }
  );

  useRealtime({ table: 'organizations', invalidateKeys: ['super_orgs'] });
  useRealtime({ table: 'audit_logs', invalidateKeys: ['super_audit'], enabled: true });

  const flash = (msg: string, ms = 4000) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(''), ms);
  };

  const approve = useSupabaseMutation({
    mutationFn: (args: { orgId: string; customCode?: string }) =>
      orgApi.approve({
        organizationId: args.orgId,
        approverName: auth.getCurrentUser()?.name ?? 'Super Admin',
        customCode: args.customCode?.trim() || undefined,
      }),
    invalidateKeys: ['super_orgs', 'super_audit'],
    onSuccess: (res) => {
      flash(`Approved — code ${res.organizationCode}.`);
      refetchLogs();
    },
    onError: (e) => flash(`Approval failed: ${e.message}`, 6000),
  });

  const reject = useSupabaseMutation({
    mutationFn: (args: { orgId: string; reason: string }) =>
      orgApi.reject({
        organizationId: args.orgId,
        approverName: auth.getCurrentUser()?.name ?? 'Super Admin',
        reason: args.reason || 'Application not approved.',
      }),
    invalidateKeys: ['super_orgs', 'super_audit'],
    onSuccess: () => {
      flash('Rejected.');
      refetchLogs();
    },
  });

  const updateOrg = useSupabaseMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof orgApi.update>[1];
    }) => orgApi.update(id, patch),
    invalidateKeys: ['super_orgs', 'super_audit'],
    onSuccess: (o) => {
      flash(`Updated ${o.company_name}.`);
      setEditingOrg(null);
      refetchLogs();
    },
    onError: (e) => flash(`Update failed: ${e.message}`, 6000),
  });

  const pending = useMemo(
    () => orgs.filter((o) => o.status === 'Pending Approval'),
    [orgs]
  );
  const activeOrgs = useMemo(
    () => orgs.filter((o) => o.status === 'Active'),
    [orgs]
  );

  const exportBackup = () => {
    downloadCsv(`umhlaba-wami-orgs-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Code', 'Company', 'Owner', 'Email', 'Tier', 'Status'],
      ...orgs.map((o) => [
        o.organization_code,
        o.company_name,
        o.owner_name,
        o.email,
        o.subscription_tier,
        o.status,
      ]),
    ]);
    flash('CSV exported.');
  };

  const savePlan = (plan: TierPlan) => {
    const next = subscriptionPlans.update(plan.tier, {
      name: plan.name,
      monthlyFeeE: plan.monthlyFeeE,
      priceLabel: `E${plan.monthlyFeeE.toLocaleString()} / mo`,
      propertyLimit: plan.propertyLimit,
      tenantLimit: plan.tenantLimit,
      userLimit: plan.userLimit,
      storageLimitGb: plan.storageLimitGb,
      features: plan.features,
      active: plan.active,
    });
    setPlans(next);
    setEditingPlan(null);
    flash(`${plan.tier} tier saved.`);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 text-white shadow-2xl border border-white/10">
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-500/30 text-violet-100 border border-violet-400/30 uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Platform owner
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-2 flex items-center gap-2 tracking-tight">
              <Shield className="w-7 h-7 text-violet-300" /> Super Admin
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-lg">
              Full control over organisations, tiers, users, and the audit trail.
            </p>
          </div>
          <button
            onClick={exportBackup}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl text-xs font-semibold flex items-center gap-2 border border-white/10 transition"
          >
            <Download className="w-4 h-4" /> Export orgs CSV
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {actionNotice}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={<Layers className="w-4 h-4" />} label="Organisations" value={orgs.length} sub={`${activeOrgs.length} active`} tone="violet" />
            <Kpi icon={<AlertTriangle className="w-4 h-4" />} label="Pending approvals" value={pending.length} sub="Awaiting your review" tone="amber" />
            <Kpi icon={<Building2 className="w-4 h-4" />} label="Listed units" value={shops.length} sub="Platform-wide" tone="blue" />
            <Kpi icon={<History className="w-4 h-4" />} label="Audit events" value={logs.length} sub="Recent trail" tone="slate" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-5 shadow-sm">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Needs attention
              </h3>
              {pending.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No pending applications.</p>
              ) : (
                <ul className="space-y-2">
                  {pending.slice(0, 5).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{o.company_name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{o.owner_name} · {o.subscription_tier}</div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 shrink-0">Pending</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-5 shadow-sm">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-violet-500" /> Latest audit
              </h3>
              {logs.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No audit events yet. Approvals and org changes will appear here.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700 max-h-56 overflow-y-auto">
                  {logs.slice(0, 8).map((l) => (
                    <li key={l.id} className="py-2.5 text-xs flex justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 mr-1.5">{l.action}</span>
                        <span className="font-semibold">{l.user_name}</span>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">{l.details}</div>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{new Date(l.timestamp).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <SectionTitle title="Organisation approvals" subtitle="Review and issue organisation codes" />
          {pending.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="w-10 h-10 text-emerald-500" />} title="All caught up" body="No applications waiting for approval." />
          ) : (
            pending.map((org) => (
              <PendingOrgCard
                key={org.id}
                org={org}
                approving={approve.loading}
                rejecting={reject.loading}
                onApprove={(customCode) =>
                  approve.mutate({ orgId: org.id, customCode })
                }
                onReject={(reason) => reject.mutate({ orgId: org.id, reason })}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'organizations' && (
        <div className="space-y-4">
          <SectionTitle title="All organisations" subtitle="Edit tier, limits, status — full platform control" />
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
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
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {orgs.length === 0 ? (
                    <tr><td colSpan={5} className="p-10 text-center text-slate-400">No organisations yet.</td></tr>
                  ) : (
                    orgs.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition">
                        <td className="px-4 py-3 font-mono font-bold text-violet-600 dark:text-violet-400">{o.organization_code}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold">{o.company_name}</div>
                          <div className="text-[10px] text-slate-500">{o.owner_name} · {o.phone}</div>
                        </td>
                        <td className="px-4 py-3">{o.subscription_tier}</td>
                        <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" title="Edit" onClick={() => setEditingOrg(o)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                              <Pencil className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                            {o.status === 'Active' ? (
                              <button type="button" title="Suspend" onClick={() => updateOrg.mutate({ id: o.id, patch: { status: 'Suspended' } })} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30">
                                <Ban className="w-3.5 h-3.5 text-amber-600" />
                              </button>
                            ) : o.status === 'Suspended' || o.status === 'Rejected' ? (
                              <button type="button" title="Activate" onClick={() => updateOrg.mutate({ id: o.id, patch: { status: 'Active' } })} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                                <Play className="w-3.5 h-3.5 text-emerald-600" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'listings' && (
        <div className="space-y-4">
          <SectionTitle title="Platform units" subtitle="Read-only overview across orgs" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shops.length === 0 ? (
              <div className="col-span-full"><EmptyState icon={<Building2 className="w-10 h-10 text-slate-300" />} title="No units listed" body="Units appear here when organisations publish inventory." /></div>
            ) : (
              shops.map((s) => (
                <div key={s.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                  <div className="text-xs font-bold">Unit {s.shop_number}</div>
                  <div className="text-[11px] text-slate-500">{s.property_type} · {s.size_sqm} m²</div>
                  <div className="text-xs font-bold text-violet-600 mt-1">E{s.rental_amount.toLocaleString()}/mo</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <SectionTitle title="Subscription tiers" subtitle="Edit pricing and limits — changes apply to new registrations" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const count = orgs.filter((o) => o.subscription_tier === plan.tier).length;
              return (
                <div key={plan.tier} className="relative p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="text-xs font-bold text-violet-600 uppercase tracking-wider">{plan.tier}</div>
                    <button type="button" onClick={() => setEditingPlan({ ...plan })} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" title="Edit tier">
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>
                  <div className="text-2xl font-bold tracking-tight">
                    E {plan.monthlyFeeE.toLocaleString()}
                    <span className="text-[10px] font-normal text-slate-500">/mo</span>
                  </div>
                  <ul className="text-[11px] text-slate-500 space-y-1">
                    <li>• Up to {plan.propertyLimit} properties</li>
                    <li>• {plan.tenantLimit} active tenants</li>
                    <li>• {plan.userLimit} staff logins</li>
                    <li>• {plan.storageLimitGb} GB storage</li>
                  </ul>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
                    <span className="font-bold">{count}</span>{' '}
                    <span className="text-slate-500">organisation{count === 1 ? '' : 's'} on this tier</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => { setPlans(subscriptionPlans.reset()); flash('Tiers reset to defaults.'); }} className="text-[11px] text-slate-500 hover:text-slate-800 underline">
            Reset all tiers to defaults
          </button>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-4">
          <SectionTitle title="System audit trail" subtitle="Approvals, rejections, and organisation changes" />
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
            <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[28rem] overflow-y-auto">
              {logs.length === 0 ? (
                <EmptyState icon={<History className="w-10 h-10 text-slate-300" />} title="No logs yet" body="Events are written when you approve, reject, or edit organisations." />
              ) : (
                logs.map((l) => (
                  <div key={l.id} className="py-3 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300">{l.action}</span>
                        <span className="font-semibold">{l.user_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{l.details}</div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{new Date(l.timestamp).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {editingPlan && (
        <PlanEditModal plan={editingPlan} onCancel={() => setEditingPlan(null)} onSave={savePlan} />
      )}
      {editingOrg && (
        <OrgEditModal org={editingOrg} onCancel={() => setEditingOrg(null)} onSave={(patch) => updateOrg.mutate({ id: editingOrg.id, patch })} loading={updateOrg.loading} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Per-card state — the code draft belongs to the card, not the page.
 * Fixes the bug where typing into one pending card's input leaked into
 * another when the shared page state was used.
 */
function PendingOrgCard({
  org,
  approving,
  rejecting,
  onApprove,
  onReject,
}: {
  org: Organization;
  approving: boolean;
  rejecting: boolean;
  onApprove: (customCode?: string) => void;
  onReject: (reason: string) => void;
}) {
  const [codeDraft, setCodeDraft] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-amber-200/80 dark:border-amber-800/50 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base">{org.company_name}</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase">Pending</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{org.owner_name} · {org.email} · {org.phone}</p>
        </div>
        <div className="text-right text-xs">
          <div className="text-slate-500">Tier</div>
          <strong className="text-violet-600 dark:text-violet-400">{org.subscription_tier}</strong>
        </div>
      </div>

      {!showReject ? (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto">
            <label className="block text-[10px] text-slate-500 mb-0.5">Custom code (auto if blank)</label>
            <input
              value={codeDraft}
              onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
              placeholder="e.g. GAB-140926-0001"
              className="w-full sm:w-56 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs bg-white dark:bg-slate-800"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowReject(true)}
              disabled={rejecting || approving}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-60"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => onApprove(codeDraft || undefined)}
              disabled={approving || rejecting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              {approving ? 'Approving…' : 'Approve & issue code'}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/50 space-y-3">
          <label className="block text-[10px] font-bold text-red-800 dark:text-red-300 uppercase tracking-wider">
            Reason for rejection
          </label>
          <textarea
            rows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Tell the applicant why this was not approved…"
            className="w-full px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-xs bg-white dark:bg-slate-900"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowReject(false); setRejectReason(''); }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onReject(rejectReason.trim() || 'Application not approved.')}
              disabled={rejecting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
            >
              {rejecting ? 'Rejecting…' : 'Confirm rejection'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
      <div className="flex justify-center mb-3">{icon}</div>
      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</div>
      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{body}</p>
    </div>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: number; sub: string; tone: 'violet' | 'amber' | 'blue' | 'slate' }) {
  const tones = {
    violet: 'from-violet-500/15 to-indigo-500/5 border-violet-200/50 dark:border-violet-800/40',
    amber: 'from-amber-500/15 to-orange-500/5 border-amber-200/50 dark:border-amber-800/40',
    blue: 'from-blue-500/15 to-cyan-500/5 border-blue-200/50 dark:border-blue-800/40',
    slate: 'from-slate-500/10 to-slate-500/5 border-slate-200 dark:border-slate-700',
  };
  return (
    <div className={`p-4 rounded-2xl border bg-gradient-to-br ${tones[tone]} bg-white dark:bg-slate-800/80 shadow-sm`}>
      <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider">{icon} {label}</div>
      <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'Active'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
      : status === 'Pending Approval'
        ? 'bg-amber-100 text-amber-800'
        : status === 'Suspended'
          ? 'bg-orange-100 text-orange-800'
          : 'bg-slate-100 text-slate-600';
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}

function PlanEditModal({ plan, onCancel, onSave }: { plan: TierPlan; onCancel: () => void; onSave: (p: TierPlan) => void }) {
  const [form, setForm] = useState({ ...plan });
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2"><Sliders className="w-4 h-4 text-violet-600" /> Edit {plan.tier}</h3>
          <button type="button" onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3 text-xs">
          <Field label="Display name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
          <Field label="Monthly fee (E)"><input type="number" value={form.monthlyFeeE} onChange={(e) => setForm({ ...form, monthlyFeeE: Number(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Property limit"><input type="number" value={form.propertyLimit} onChange={(e) => setForm({ ...form, propertyLimit: Number(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
            <Field label="Tenant limit"><input type="number" value={form.tenantLimit} onChange={(e) => setForm({ ...form, tenantLimit: Number(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
            <Field label="Staff logins"><input type="number" value={form.userLimit} onChange={(e) => setForm({ ...form, userLimit: Number(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
            <Field label="Storage (GB)"><input type="number" value={form.storageLimitGb} onChange={(e) => setForm({ ...form, storageLimitGb: Number(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span className="font-semibold">Active (shown at registration)</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border text-xs">Cancel</button>
          <button type="button" onClick={() => onSave(form)} className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold">Save tier</button>
        </div>
      </div>
    </div>
  );
}

function OrgEditModal({ org, onCancel, onSave, loading }: { org: Organization; onCancel: () => void; onSave: (patch: Parameters<typeof orgApi.update>[1]) => void; loading?: boolean }) {
  const [form, setForm] = useState({
    company_name: org.company_name,
    owner_name: org.owner_name,
    email: org.email,
    phone: org.phone || '',
    subscription_tier: org.subscription_tier as SubscriptionTier,
    status: org.status,
    property_limit: org.property_limit,
    tenant_limit: org.tenant_limit,
    user_limit: org.user_limit,
    storage_limit: org.storage_limit,
    monthly_fee_estimate: org.monthly_fee_estimate ?? 0,
  });
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Edit organisation</h3>
          <button type="button" onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3 text-xs">
          <Field label="Company name"><input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner"><input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
          </div>
          <Field label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tier">
              <select value={form.subscription_tier} onChange={(e) => setForm({ ...form, subscription_tier: e.target.value as SubscriptionTier })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900">
                <option value="Starter">Starter</option>
                <option value="Professional">Professional</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Organization['status'] })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900">
                <option value="Active">Active</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Suspended">Suspended</option>
                <option value="Rejected">Rejected</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Property limit"><input type="number" value={form.property_limit} onChange={(e) => setForm({ ...form, property_limit: Number(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
            <Field label="Tenant limit"><input type="number" value={form.tenant_limit} onChange={(e) => setForm({ ...form, tenant_limit: Number(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
            <Field label="User limit"><input type="number" value={form.user_limit} onChange={(e) => setForm({ ...form, user_limit: Number(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
            <Field label="Storage (GB)"><input type="number" value={form.storage_limit} onChange={(e) => setForm({ ...form, storage_limit: Number(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900" /></Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border text-xs">Cancel</button>
          <button type="button" disabled={loading} onClick={() => onSave(form)} className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold disabled:opacity-60">{loading ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-semibold mb-1 text-slate-600 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}
