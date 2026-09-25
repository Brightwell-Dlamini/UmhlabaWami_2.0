// src/components/auth/RegisterOrgModal.tsx
import React, { useMemo, useState } from 'react';
import {
  Building2,
  ShieldAlert,
  Users,
  ArrowRight,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Copy,
  LogIn,
} from 'lucide-react';
import { organizations } from '../../services/api/organizations';
import { subscriptionPlans } from '../../services/subscriptionPlans';
import type { SubscriptionTier } from '../../types';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/ToastProvider';
import { PasswordInput } from '../ui/PasswordInput';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orgName: string) => void;
  /** Called when the user clicks "Back to sign in" from the success screen. */
  onGoToSignIn?: () => void;
}

export const RegisterOrgModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  onGoToSignIn,
}) => {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);
  const [orgCode, setOrgCode] = useState('');

  // Step 1 — organisation
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Step 2 — admin account
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 3 — scale & plan
  const [staffManagers, setStaffManagers] = useState(1);
  const [staffMaintenance, setStaffMaintenance] = useState(0);
  const [staffFinance, setStaffFinance] = useState(0);
  const [staffGeneral, setStaffGeneral] = useState(0);
  const [unitCount, setUnitCount] = useState(10);
  const [tenantCount, setTenantCount] = useState(5);
  const [estimatedMonthlyRental, setEstimatedMonthlyRental] = useState(350000);
  const [tier, setTier] = useState<SubscriptionTier>('Starter');

  const plans = useMemo(() => subscriptionPlans.list(), []);
  const fee = useMemo(
    () => subscriptionPlans.estimateMonthlyFee(tier, estimatedMonthlyRental),
    [tier, estimatedMonthlyRental]
  );

  const handleClose = () => {
    setStep(1);
    setErrorMsg('');
    setDone(false);
    setLoading(false);
    setOrgCode('');
    setCompanyName('');
    setOwnerName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setStaffManagers(1);
    setStaffMaintenance(0);
    setStaffFinance(0);
    setStaffGeneral(0);
    setUnitCount(10);
    setTenantCount(5);
    setEstimatedMonthlyRental(350000);
    setTier('Starter');
    onClose();
  };

  const validateStep = (): string | null => {
    if (step === 1) {
      if (!companyName.trim()) return 'Company name is required';
      if (!ownerName.trim()) return 'Owner name is required';
      if (!email.trim() || !email.includes('@')) return 'Valid email is required';
      if (!phone.trim()) return 'Phone is required';
      if (!address.trim()) return 'Address is required';
    }
    if (step === 2) {
      if (!username.trim() || username.length < 3) return 'Username must be at least 3 characters';
      if (password.length < 8) return 'Password must be at least 8 characters';
      if (password !== confirmPassword) return 'Passwords do not match';
    }
    if (step === 3) {
      if (estimatedMonthlyRental <= 0) return 'Estimated monthly rental is required';
    }
    return null;
  };

  const handleNext = () => {
    setErrorMsg('');
    const err = validateStep();
    if (err) {
      setErrorMsg(err);
      return;
    }
    if (step < 3) setStep(step + 1);
    else void handleSubmit();
  };

  const handleSubmit = async () => {
    setErrorMsg('');
    const err = validateStep();
    if (err) {
      setErrorMsg(err);
      return;
    }
    setLoading(true);
    try {
      const res = await organizations.register({
        company_name: companyName.trim(),
        owner_name: ownerName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        username: username.trim(),
        password,
        staff_managers: staffManagers,
        staff_maintenance: staffMaintenance,
        staff_finance: staffFinance,
        staff_general: staffGeneral,
        unit_count: unitCount,
        tenant_count: tenantCount,
        estimated_monthly_rental: estimatedMonthlyRental,
        subscription_tier: tier,
      });
      if (!res.success) {
        setErrorMsg(res.error || 'Registration failed');
        setLoading(false);
        return;
      }
      setOrgCode(res.organization_code || '');
      setDone(true);
      onSuccess(companyName.trim());
      toast.success('Application submitted', 'Awaiting platform approval.');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      size="md"
      title={done ? 'Application received' : 'Register organisation'}
      subtitle={done ? undefined : `Step ${step} of 3`}
      icon={<Building2 className="w-5 h-5 text-blue-600" />}
    >
      {done ? (
        <div className="space-y-4 text-center py-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Your organisation application has been submitted. You will be notified once it is reviewed.
          </p>
          {orgCode && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs">
              <div className="text-slate-500 mb-1">Organisation code</div>
              <div className="font-mono font-bold text-sm flex items-center justify-center gap-2">
                {orgCode}
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(orgCode);
                    toast.success('Copied', 'Organisation code copied.');
                  }}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => {
                handleClose();
                onGoToSignIn?.();
              }}
              className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" /> Back to sign in
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2 rounded-xl border text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold mb-1">Company name *</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Owner name *</label>
                <input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Phone *</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Address *</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold mb-1">Admin username *</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Password *</label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Confirm password *</label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Managers</label>
                  <input type="number" min={0} value={staffManagers} onChange={(e) => setStaffManagers(Number(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Maintenance staff</label>
                  <input type="number" min={0} value={staffMaintenance} onChange={(e) => setStaffMaintenance(Number(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Finance staff</label>
                  <input type="number" min={0} value={staffFinance} onChange={(e) => setStaffFinance(Number(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">General staff</label>
                  <input type="number" min={0} value={staffGeneral} onChange={(e) => setStaffGeneral(Number(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Units</label>
                  <input type="number" min={0} value={unitCount} onChange={(e) => setUnitCount(Number(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Active Tenants</label>
                  <input type="number" min={0} value={tenantCount} onChange={(e) => setTenantCount(Number(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Estimated Monthly Rent Roll (E) *</label>
                <input type="number" min={0} step="0.01" inputMode="decimal" required value={estimatedMonthlyRental} onChange={(e) => setEstimatedMonthlyRental(Number(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Subscription tier</label>
                <div className="grid gap-2 mt-1">
                  {plans.map((p) => (
                    <button key={p.tier} type="button" onClick={() => setTier(p.tier)} className={`p-3 rounded-xl border text-left text-xs ${
                      tier === p.tier ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700'
                    }`}>
                      <div className="font-bold">{p.name}</div>
                      <div className="text-slate-500">{p.blurb || p.priceLabel}</div>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Estimated platform fee:{' '}
                <strong>E{Number(fee.total).toLocaleString()}/mo</strong>
              </p>
            </div>
          )}

          <div className="pt-3 flex justify-between gap-2 border-t">
            <button type="button" onClick={() => (step > 1 ? setStep(step - 1) : handleClose())} className="px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> {step > 1 ? 'Back' : 'Cancel'}
            </button>
            <button type="button" onClick={handleNext} disabled={loading} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-60">
              {step < 3 ? (<><span>Next</span> <ArrowRight className="w-3.5 h-3.5" /></>) : loading ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
