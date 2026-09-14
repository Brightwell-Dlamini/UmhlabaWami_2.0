import React, { useState } from 'react';
import {
  Building2,
  Save,
  CheckCircle2,
  Key,
  Shield,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Download,
  Upload,
  RefreshCw,
  Sliders,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { db, DEFAULT_SUBSCRIPTION_PLANS } from '../../services/db';
import { auth } from '../../services/auth';

export const OrgSettingsView: React.FC = () => {
  const currentOrg = auth.getCurrentOrganization() || db.organizations[0];

  const [companyName, setCompanyName] = useState(currentOrg?.company_name || 'Ezulwini Commercial Properties');
  const [address, setAddress] = useState(currentOrg?.address || 'The Gables Lifestyle Centre, Ezulwini Valley');
  const [email, setEmail] = useState(currentOrg?.email || 'admin@ezulwiniproperties.sz');
  const [phone, setPhone] = useState(currentOrg?.phone || '+268 2416 1000');
  const [taxNumber, setTaxNumber] = useState('TIN-9088214-SZ');
  const [currency, setCurrency] = useState('SZL (E)');

  // Operations policies
  const [escalationRate, setEscalationRate] = useState('8.0');
  const [gracePeriodDays, setGracePeriodDays] = useState('7');
  const [utilityMarkup, setUtilityMarkup] = useState('5.0');
  const [autoInvoice, setAutoInvoice] = useState(true);

  // Plan upgrade modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [backupMsg, setBackupMsg] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentOrg) {
      currentOrg.company_name = companyName;
      currentOrg.address = address;
      currentOrg.email = email;
      currentOrg.phone = phone;
      db.saveToStorage();
      setSaveNotice('Organization settings and operational policies saved successfully!');
      setTimeout(() => setSaveNotice(''), 3500);
    }
  };

  const handleSelectTier = (tier: 'Starter' | 'Professional' | 'Enterprise') => {
    if (currentOrg) {
      currentOrg.subscription_tier = tier;
      const plan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.tier === tier);
      if (plan) {
        currentOrg.property_limit = plan.propertyLimit;
        currentOrg.tenant_limit = plan.tenantLimit;
      }
      db.saveToStorage();
      setShowPlanModal(false);
      setSaveNotice(`Organization subscription tier updated to ${tier}!`);
      setTimeout(() => setSaveNotice(''), 3500);
    }
  };

  const handleExportBackup = () => {
    const jsonStr = db.exportBackupJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `umhlaba_wami_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBackupMsg('Database backup exported to JSON file.');
    setTimeout(() => setBackupMsg(''), 3000);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const success = db.restoreBackupJson(content);
        if (success) {
          setBackupMsg('Database restored successfully from backup file!');
          setTimeout(() => setBackupMsg(''), 3500);
        } else {
          alert('Failed to restore backup: invalid JSON format.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDemo = () => {
    if (
      window.confirm(
        'Are you sure you want to reset the database to demo defaults? All custom additions will be reverted.'
      )
    ) {
      db.resetToInitialSeed();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Organization Profile & Operational Settings
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Configure corporate details, billing information, commercial lease escalation defaults, and data backups
        </p>
      </div>

      {saveNotice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{saveNotice}</span>
        </div>
      )}

      {backupMsg && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
          <span>{backupMsg}</span>
        </div>
      )}

      {/* Subscription Tier Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white uppercase tracking-wider">
              {currentOrg?.subscription_tier || 'Professional'} Plan
            </span>
            <span className="text-xs text-blue-200">
              Code: <strong className="font-mono text-white">{currentOrg?.organization_code || 'GAB-070826'}</strong>
            </span>
          </div>
          <h3 className="text-lg font-bold mt-1.5">{currentOrg?.company_name || 'Ezulwini Commercial Properties'}</h3>
          <p className="text-xs text-blue-100">
            Portfolio Capacity: Up to {currentOrg?.property_limit || 10} Commercial Centers • {currentOrg?.tenant_limit || 500} Active Tenants
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPlanModal(true)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-xl text-xs font-semibold backdrop-blur-xs transition flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Manage Tier</span>
          </button>
          <span className="text-xs font-semibold px-3 py-1.5 bg-emerald-500 text-white rounded-xl shadow-xs">
            Status: {currentOrg?.status || 'Active'}
          </span>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs">
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
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Headquarters Address
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Eswatini Revenue Authority TIN / Tax PIN
                </label>
                <input
                  type="text"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Base Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="SZL (E)">SZL - Swazi Lilangeni (E)</option>
                  <option value="ZAR (R)">ZAR - South African Rand (R)</option>
                  <option value="USD ($)">USD - US Dollar ($)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Operational Defaults */}
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
                  value={escalationRate}
                  onChange={(e) => setEscalationRate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Late Fee Grace Period (Days)
                </label>
                <input
                  type="number"
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(e.target.value)}
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
                  value={utilityMarkup}
                  onChange={(e) => setUtilityMarkup(e.target.value)}
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
                  Automatically generate recurring rent invoices on the 1st of every calendar month
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoInvoice}
                onChange={(e) => setAutoInvoice(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Organization Settings</span>
            </button>
          </div>
        </form>
      </div>

      {/* Data Management & Disaster Recovery */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <span>Database Management & Storage Persistence</span>
        </h2>
        <p className="text-xs text-slate-500 mt-2">
          Export full portfolio records, restore from previous state snapshots, or reset to demo data.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <button
            onClick={handleExportBackup}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center gap-2 text-center transition group"
          >
            <Download className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-xs text-slate-900 dark:text-white">Export Backup (JSON)</span>
            <span className="text-[10px] text-slate-400">Download complete dataset snapshot</span>
          </button>

          <label className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center gap-2 text-center transition cursor-pointer group">
            <Upload className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-xs text-slate-900 dark:text-white">Restore from Backup</span>
            <span className="text-[10px] text-slate-400">Import valid JSON backup file</span>
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>

          <button
            onClick={handleResetDemo}
            className="p-4 rounded-xl border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 flex flex-col items-center justify-center gap-2 text-center transition text-red-600 dark:text-red-400 group"
          >
            <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
            <span className="font-bold text-xs">Reset to Demo Defaults</span>
            <span className="text-[10px] text-red-400/80">Clears current cache & reloads seed</span>
          </button>
        </div>
      </div>

      {/* Subscription Tier Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Select Subscription Plan Tier
              </h2>
              <button
                onClick={() => setShowPlanModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {DEFAULT_SUBSCRIPTION_PLANS.map((plan) => {
                const isCurrent = currentOrg?.subscription_tier === plan.tier;
                return (
                  <div
                    key={plan.tier}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                      isCurrent
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        {plan.tier}
                      </span>
                      <h3 className="font-bold text-slate-900 dark:text-white mt-1">{plan.name}</h3>
                      <div className="mt-2 font-bold text-base text-slate-900 dark:text-white">
                        E {plan.pricePerMonthE.toLocaleString()}
                        <span className="text-[10px] font-normal text-slate-500"> /mo</span>
                      </div>
                      <ul className="mt-3 space-y-1 text-[11px] text-slate-500">
                        {plan.features.map((feat, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={() => handleSelectTier(plan.tier)}
                      disabled={isCurrent}
                      className={`mt-4 w-full py-2 rounded-xl font-bold transition text-center ${
                        isCurrent
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                      }`}
                    >
                      {isCurrent ? 'Current Plan' : 'Select Plan'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
