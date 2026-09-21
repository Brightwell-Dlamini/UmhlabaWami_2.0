// src/components/dashboard/OrgSettingsView.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Save,
  CheckCircle2,
  Shield,
  Sparkles,
  Download,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { organizations as orgApi } from '../../services/api/organizations';
import { subscriptionPlans } from '../../services/subscriptionPlans';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useSupabaseMutation } from '../../hooks/useSupabaseMutation';
import { useRealtime } from '../../hooks/useRealtime';
import type { Organization, SubscriptionTier } from '../../types';
import { ImageSourceField } from '../ui/ImageSourceField';
import { uploadFile } from '../../services/storage';

interface SettingsFormState {
  companyName: string;
  address: string;
  email: string;
  phone: string;
  taxNumber: string;
  currency: string;
  escalationRate: string;
  gracePeriodDays: string;
  utilityMarkup: string;
  autoInvoice: boolean;
}

interface OrgWithFinancials extends Organization {
  escalation_rate_pct?: number;
  grace_period_days?: number;
  utility_markup_pct?: number;
  auto_invoice_enabled?: boolean;
}

function initialFormFromOrg(org: OrgWithFinancials | null): SettingsFormState {
  return {
    companyName: org?.company_name ?? '',
    address: org?.address ?? '',
    email: org?.email ?? '',
    phone: org?.phone ?? '',
    taxNumber: '',
    currency: 'SZL (E)',
    escalationRate: String(org?.escalation_rate_pct ?? 8.0),
    gracePeriodDays: String(org?.grace_period_days ?? 7),
    utilityMarkup: String(org?.utility_markup_pct ?? 5.0),
    autoInvoice: org?.auto_invoice_enabled ?? true,
  };
}

function numOrNull(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function OrgSettingsView() {
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const cachedOrg = auth.getCurrentOrganization();

  const { data: org } = useSupabaseQuery(
    ['organization', orgId],
    () => orgApi.get(orgId),
    { enabled: !!orgId }
  );

  useRealtime({
    table: 'organizations',
    filter: orgId ? `id=eq.${orgId}` : undefined,
    invalidateKeys: ['organization', 'orgs'],
    enabled: !!orgId,
  });

  const activeOrg: OrgWithFinancials | null =
    (org as OrgWithFinancials | undefined) ??
    (cachedOrg as OrgWithFinancials | null);

  const [form, setForm] = useState<SettingsFormState>(() =>
    initialFormFromOrg(activeOrg)
  );
  const [saveNotice, setSaveNotice] = useState<{
    text: string;
    tone: 'ok' | 'error';
  } | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState(activeOrg?.logo_url ?? '');

  useEffect(() => {
    if (activeOrg) {
      setForm(initialFormFromOrg(activeOrg));
      setLogoUrl(activeOrg.logo_url ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrg?.id, activeOrg?.company_name, activeOrg?.logo_url]);

  const updateOrg = useSupabaseMutation({
    mutationFn: (patch: Parameters<typeof orgApi.update>[1]) =>
      orgApi.update(orgId, patch),
    invalidateKeys: ['organization', 'orgs'],
  });

  const plans = useMemo(() => subscriptionPlans.list(), []);

  const flash = (text: string, tone: 'ok' | 'error' = 'ok', ms = 3500) => {
    setSaveNotice({ text, tone });
    setTimeout(() => setSaveNotice(null), ms);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    // Client-side range checks mirror the SQL constraints.
    const esc = numOrNull(form.escalationRate);
    if (esc === null || esc < 0 || esc > 50) {
      flash('Escalation rate must be between 0 and 50.', 'error');
      return;
    }
    const grace = numOrNull(form.gracePeriodDays);
    if (grace === null || grace < 0 || grace > 90) {
      flash('Grace period must be between 0 and 90 days.', 'error');
      return;
    }
    const markup = numOrNull(form.utilityMarkup);
    if (markup === null || markup < 0 || markup > 50) {
      flash('Utility markup must be between 0 and 50.', 'error');
      return;
    }

    try {
      await updateOrg.mutate({
        company_name: form.companyName,
        address: form.address,
        email: form.email,
        phone: form.phone,
        logo_url: logoUrl || undefined,
        escalation_rate_pct: esc,
        grace_period_days: Math.round(grace),
        utility_markup_pct: markup,
        auto_invoice_enabled: form.autoInvoice,
      } as Parameters<typeof orgApi.update>[1]);
      flash('Organization settings saved.');
      try {
        const updated = await orgApi.get(orgId);
        auth.setCurrentOrganization(updated);
      } catch {
        /* non-fatal — logo still saved server-side */
      }
    } catch (err) {
      flash(
        err instanceof Error ? err.message : 'Failed to save settings.',
        'error',
        5000
      );
    }
  };

  const handleSelectTier = async (tier: SubscriptionTier) => {
    if (!orgId) return;
    try {
      await updateOrg.mutate({ subscription_tier: tier });
      setShowPlanModal(false);
      flash(`Subscription tier updated to ${tier}.`);
    } catch (err) {
      flash(
        err instanceof Error ? err.message : 'Failed to update tier.',
        'error',
        5000
      );
    }
  };

  const handleExportBackup = () => {
    if (!activeOrg) return;
    const payload = {
      exported_at: new Date().toISOString(),
      version: '2.1.0',
      organization: activeOrg,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `umhlaba_wami_org_${
      activeOrg.organization_code || activeOrg.id
    }_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportNotice('Organisation settings exported.');
    setTimeout(() => setExportNotice(null), 3000);
  };

  if (!orgId) {
    return (
      <div className="p-6 text-slate-500 text-sm">
        No organisation context.
      </div>
    );
  }
  if (!activeOrg) {
    return (
      <div className="p-6 text-slate-500 text-sm">Loading organisation…</div>
    );
  }

  const currentTier = activeOrg.subscription_tier;
  const currentPlan = plans.find((p) => p.tier === currentTier);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Organization Profile & Operational Settings
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Configure corporate details, billing information, commercial lease
          escalation defaults, and settings export
        </p>
      </div>

      {saveNotice && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            saveNotice.tone === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {saveNotice.tone === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{saveNotice.text}</span>
        </div>
      )}

      {exportNotice && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Subscription Tier Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white uppercase tracking-wider">
              {currentTier} Plan
            </span>
            <span className="text-xs text-blue-200">
              Code:{' '}
              <strong className="font-mono text-white">
                {activeOrg.organization_code || '—'}
              </strong>
            </span>
          </div>
          <h3 className="text-lg font-bold mt-1.5">
            {activeOrg.company_name}
          </h3>
          <p className="text-xs text-blue-100">
            Portfolio Capacity: Up to {currentPlan?.propertyLimit ?? '—'}{' '}
            Commercial Centers • {currentPlan?.tenantLimit ?? '—'} Active
            Tenants
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPlanModal(true)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-xl text-xs font-semibold backdrop-blur-sm transition flex items-center gap-1.5"
            type="button"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Manage Tier</span>
          </button>
          <span className="text-xs font-semibold px-3 py-1.5 bg-emerald-500 text-white rounded-xl shadow-sm">
            Status: {activeOrg.status}
          </span>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <form onSubmit={handleSave} className="space-y-6 max-w-3xl text-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Corporate & Billing Identity</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Company / Portfolio Entity Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <ImageSourceField
                  label="Organisation logo"
                  hint="Shown on your org dashboard and in the top bar. Upload, paste a URL, or use the camera."
                  value={logoUrl}
                  onChange={setLogoUrl}
                  onUploadFile={async (file) => {
                    const { publicUrl } = await uploadFile({
                      bucket: 'org-logos',
                      organizationId: orgId,
                      entityId: orgId,
                      file,
                    });
                    if (!publicUrl)
                      throw new Error(
                        'Upload did not return a public URL. Check the org-logos bucket is public.'
                      );
                    return publicUrl;
                  }}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Headquarters Address
                </label>
                <input
                  type="text"
                  required
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Billing & Admin Email *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hotline / Telephony *
                </label>
                <input
                  type="text"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Eswatini Revenue Authority TIN / Tax PIN
                </label>
                <input
                  type="text"
                  value={form.taxNumber}
                  onChange={(e) =>
                    setForm({ ...form, taxNumber: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Base Currency
                </label>
                <select
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="SZL (E)">SZL - Swazi Lilangeni (E)</option>
                  <option value="ZAR (R)">ZAR - South African Rand (R)</option>
                  <option value="USD ($)">USD - US Dollar ($)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>Commercial Leasing & Financial Rules</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Annual Escalation Rate (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={50}
                  value={form.escalationRate}
                  onChange={(e) =>
                    setForm({ ...form, escalationRate: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Late Fee Grace Period (Days)
                </label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={form.gracePeriodDays}
                  onChange={(e) =>
                    setForm({ ...form, gracePeriodDays: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Utility Recovery Surcharge (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={50}
                  value={form.utilityMarkup}
                  onChange={(e) =>
                    setForm({ ...form, utilityMarkup: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900 dark:text-white text-xs">
                  Automated Rent Invoice Generation
                </div>
                <div className="text-[11px] text-slate-500">
                  When enabled, a scheduled job generates recurring rent
                  invoices on the 1st of every month
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.autoInvoice}
                onChange={(e) =>
                  setForm({ ...form, autoInvoice: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={updateOrg.loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>
                {updateOrg.loading
                  ? 'Saving…'
                  : 'Save Organization Settings'}
              </span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <span>Data Export</span>
        </h2>
        <p className="text-xs text-slate-500 mt-2">
          Download a JSON snapshot of your organisation profile.
        </p>
        <button
          type="button"
          onClick={handleExportBackup}
          className="mt-3 px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-900"
        >
          <Download className="w-3.5 h-3.5" /> Export organisation settings
        </button>
      </div>

      {showPlanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base">Choose subscription tier</h3>
            <div className="space-y-2">
              {plans.map((p) => (
                <button
                  key={p.tier}
                  type="button"
                  onClick={() => void handleSelectTier(p.tier)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-xs ${
                    p.tier === currentTier
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="font-bold">{p.tier}</div>
                  <div className="text-slate-500">
                    Up to {p.propertyLimit} centres · {p.tenantLimit} tenants
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowPlanModal(false)}
              className="w-full px-4 py-2 rounded-xl border text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
