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
  const [submitted, setSubmitted] = useState<{
    orgName: string;
    reference: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+268 ');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2
  const [staffManagers, setStaffManagers] = useState(2);
  const [staffMaintenance, setStaffMaintenance] = useState(3);
  const [staffFinance, setStaffFinance] = useState(1);
  const [staffGeneral, setStaffGeneral] = useState(4);

  // Step 3 - Primary Property
  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState('Shopping Centre / Mall');
  const [location, setLocation] = useState('Ezulwini Valley');
  const [unitCount, setUnitCount] = useState(25);
  const [tenantCount, setTenantCount] = useState(20);
  const [estimatedMonthlyRental, setEstimatedMonthlyRental] = useState(350000);
  const [tier, setTier] = useState<SubscriptionTier>('Professional');

  const plans = useMemo(() => subscriptionPlans.list(), []);
  const feePreview = useMemo(
    () => subscriptionPlans.estimateMonthlyFee(tier, estimatedMonthlyRental),
    [tier, estimatedMonthlyRental]
  );

  const resetForm = () => {
    setStep(1);
    setSubmitted(null);
    setError(null);
    setCompanyName('');
    setOwnerName('');
    setEmail('');
    setPhone('+268 ');
    setAddress('');
    setPassword('');
    setConfirmPassword('');
    setStaffManagers(2);
    setStaffMaintenance(3);
    setStaffFinance(1);
    setStaffGeneral(4);
    setPropertyName('');
    setPropertyType('Shopping Centre / Mall');
    setLocation('Ezulwini Valley');
    setUnitCount(25);
    setTenantCount(20);
    setEstimatedMonthlyRental(350000);
    setTier('Professional');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateStep1 = () => {
    if (!companyName.trim()) return 'Company name is required';
    if (!ownerName.trim()) return 'Owner name is required';
    if (!email.trim() || !email.includes('@')) return 'Valid email is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const validateStep3 = () => {
    if (!propertyName.trim()) return 'Primary property name is required';
    if (estimatedMonthlyRental <= 0) return 'Estimated monthly rental is required';
    return null;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setError(err);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (step < 3) {
      handleNext();
      return;
    }
    const err = validateStep3();
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    try {
      const result = await organizations.register({
        companyName: companyName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        address: address.trim(),
        password,
        tier,
        estimatedMonthlyRent: estimatedMonthlyRental,
        propertyCount: Math.max(1, unitCount || 1),
        tenantCount: tenantCount || 0,
        staffBreakdown: {
          managers: staffManagers,
          maintenance: staffMaintenance,
          finance: staffFinance,
          general: staffGeneral,
          property_name: propertyName.trim(),
          property_type: propertyType,
          location: location.trim(),
        },
      });
      setSubmitted({
        orgName: companyName.trim(),
        reference: (result as { reference?: string; organization_code?: string }).reference || (result as { organization_code?: string }).organization_code || 'PENDING',
      });
      onSuccess(companyName.trim());
      toast.success('Application submitted successfully');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Registration failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (submitted) {
    return (
      <Modal open={true} onClose={handleClose} title="Application received" size="md">
        <div className="space-y-4 text-center py-4">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h3 className="text-lg font-bold">{submitted.orgName}</h3>
          <p className="text-sm text-slate-500">
            Your organisation application has been submitted. We will review and activate your account shortly.
          </p>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
            <div className="text-slate-400">Reference</div>
            <div className="font-mono font-bold flex items-center justify-center gap-2">
              {submitted.reference}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(submitted.reference);
                  toast.success('Copied');
                }}
                className="p-1 hover:bg-slate-200 rounded"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              handleClose();
              onGoToSignIn?.();
            }}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-2 mx-auto"
          >
            <LogIn className="w-4 h-4" /> Back to sign in
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={isOpen} onClose={handleClose} title="Register organisation" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step indicators */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : step > s
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s}
              </div>
              {s < 3 && <div className="flex-1 h-0.5 bg-slate-200" />}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Company name *</label>
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                placeholder="Ezulwini Properties"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Owner full name *</label>
              <input
                required
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
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Password *</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full"
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Confirm password *</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Estimate your staff headcount (used for plan sizing).</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Managers</label>
                <input type="number" min={0} value={staffManagers} onChange={(e) => setStaffManagers(Number(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Maintenance</label>
                <input type="number" min={0} value={staffMaintenance} onChange={(e) => setStaffMaintenance(Number(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Finance</label>
                <input type="number" min={0} value={staffFinance} onChange={(e) => setStaffFinance(Number(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">General staff</label>
                <input type="number" min={0} value={staffGeneral} onChange={(e) => setStaffGeneral(Number(e.target.value) || 0)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Tell us about your primary property so we can size the plan.</p>
            <div>
              <label className="block text-xs font-semibold mb-1">Primary property name *</label>
              <input required value={propertyName} onChange={(e) => setPropertyName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" placeholder="Ezulwini Mall" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Type</label>
                <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <option>Shopping Centre / Mall</option>
                  <option>Office Park</option>
                  <option>Industrial</option>
                  <option>Mixed Use</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs" />
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
                    <div className="font-bold">{p.tier}</div>
                    <div className="text-slate-500">{p.description}</div>
                  </button>
                ))}
              </div>
              <div className="text-slate-500 mt-2 text-xs flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5" /> Estimated fee: E{feePreview.toLocaleString()} /mo
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2 border-t">
          <button type="button" onClick={() => (step > 1 ? setStep(step - 1) : handleClose())} className="px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> {step > 1 ? 'Back' : 'Cancel'}
          </button>
          <button type="submit" disabled={loading} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1">
            {step < 3 ? (<><span>Next</span> <ArrowRight className="w-3.5 h-3.5" /></>) : loading ? 'Submitting…' : 'Submit application'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
