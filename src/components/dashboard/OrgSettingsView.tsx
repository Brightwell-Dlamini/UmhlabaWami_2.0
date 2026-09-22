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
} from 'lucide-react';import { Modal } from '../ui/Modal';
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
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  bankSwift: string;
}

interface OrgWithFinancials extends Organization {
  escalation_rate_pct?: number;
  grace_period_days?: number;
  utility_markup_pct?: number;
  auto_invoice_enabled?: boolean;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_branch_code?: string;
  bank_swift?: string;
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
    bankName: org?.bank_name ?? '',
    bankAccountName: org?.bank_account_name ?? '',
    bankAccountNumber: org?.bank_account_number ?? '',
    bankBranchCode: org?.bank_branch_code ?? '',
    bankSwift: org?.bank_swift ?? '',
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
        bank_name: form.bankName || undefined,
        bank_account_name: form.bankAccountName || undefined,
        bank_account_number: form.bankAccountNumber || undefined,
        bank_branch_code: form.bankBranchCode || undefined,
        bank_swift: form.bankSwift || undefined,
      } as Parameters<typeof orgApi.update>[1]);
      flash('Organization settings saved.');
      try {
        const updated = await orgApi.get(orgId);
        auth.setCurrentOrganization(updated);
      } catch {
        /* non-fatal */
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
      <div className="p-6 text-slate-500 text-sm">No organisation context.</div>
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
          Corporate details, banking for invoices, lease rules, and logo
        </p>
      </div>

      {saveNotice && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            saveNotice.tone === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border border-red-300 text-red-800 dark:text-red-200'
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
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 text-blue-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
          <span>{exportNotice}</span>
        </div>
      )}

      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 uppercase tracking-wider">
              {currentTier} Plan
            </span>
            <span className="text-xs text-blue-200">
              Code:{' '}
              <strong className="font-mono text-white">
                {activeOrg.organization_code || '—'}
              </strong>
            </span>
          </div>
          <h3 className="text-lg font-bold mt-1.5">{activeOrg.company_name}</h3>
          <p className="text-xs text-blue-100">
            Up to {currentPlan?.propertyLimit ?? '—'} centres • {currentPlan?.tenantLimit ?? '—'} tenants
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPlanModal(true)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-xl text-xs font-semibold"
            type="button"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 inline mr-1" />
            Manage Tier
          </button>
          <span className="text-xs font-semibold px-3 py-1.5 bg-emerald-500 text-white rounded-xl">
            {activeOrg.status}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <form onSubmit={handleSave} className="space-y-6 max-w-3xl text-xs">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2 border-b pb-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Corporate & Billing Identity
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Company name *</label>
                <input
                  type="text"
                  required
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
                />
              </div>

              <div className="sm:col-span-2">
                <ImageSourceField
                  label="Organisation logo"
                  hint="Shown on dashboard and top bar. Upload, URL, or camera."
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
                      throw new Error('Upload failed — check org-logos bucket is public.');
                    return publicUrl;
                  }}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Address</label>
                <input
                  type="text"
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Phone *</label>
                <input
                  type="text"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold border-b pb-2 mb-4">Banking details (shown on invoices)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Bank name</label>
                <input
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="e.g. Standard Bank Eswatini"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Account name</label>
                <input
                  value={form.bankAccountName}
                  onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Account number</label>
                <input
                  value={form.bankAccountNumber}
                  onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Branch code</label>
                <input
                  value={form.bankBranchCode}
                  onChange={(e) => setForm({ ...form, bankBranchCode: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">SWIFT (optional)</label>
                <input
                  value={form.bankSwift}
                  onChange={(e) => setForm({ ...form, bankSwift: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <h2 className="text-sm font-bold flex items-center gap-2 border-b pb-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              Commercial leasing rules
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block font-semibold mb-1">Annual escalation (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={50}
                  value={form.escalationRate}
                  onChange={(e) => setForm({ ...form, escalationRate: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Grace period (days)</label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={form.gracePeriodDays}
                  onChange={(e) => setForm({ ...form, gracePeriodDays: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Utility markup (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={50}
                  value={form.utilityMarkup}
                  onChange={(e) => setForm({ ...form, utilityMarkup: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border"
                />
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs">Automated rent invoices</div>
                <div className="text-[11px] text-slate-500">Generate on the 1st of each month</div>
              </div>
              <input
                type="checkbox"
                checked={form.autoInvoice}
                onChange={(e) => setForm({ ...form, autoInvoice: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={handleExportBackup}
              className="px-3 py-2 text-xs font-semibold border rounded-xl flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export settings
            </button>
            <button
              type="submit"
              disabled={updateOrg.loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {updateOrg.loading ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </form>
      </div>

           <Modal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        size="sm"
        title="Change subscription tier"
      >
        <div className="space-y-2">
          {plans.map((p) => (
            <button
              key={p.tier}
              type="button"
              onClick={() => void handleSelectTier(p.tier)}
              className={`w-full text-left p-3 rounded-xl border text-xs ${
                p.tier === currentTier ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40' : ''
              }`}
            >
              <div className="font-bold">{p.tier}</div>
              <div className="text-slate-500">
                E{p.monthlyFeeE}/mo · {p.propertyLimit} centres
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
