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
  const [staffManagers, setStaffManagers] = useState(2);
  const [staffMaintenance, setStaffMaintenance] = useState(3);
  const [staffFinance, setStaffFinance] = useState(1);
  const [staffGeneral, setStaffGeneral] = useState(4);

  // Step 2
  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState('Shopping Centre / Mall');
  const [location, setLocation] = useState('Ezulwini Valley');
  const [unitCount, setUnitCount] = useState(25);
  const [tenantCount, setTenantCount] = useState(20);
  const [estimatedMonthlyRental, setEstimatedMonthlyRental] = useState(350000);

  // Step 3
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
    setPropertyName('');
    setEstimatedMonthlyRental(350000);
  };

  const handleClose = () => {
    const wasSubmitted = !!submitted;
    resetForm();
    onClose();
    if (wasSubmitted) {
      // Parent already showed a success toast on submit; nothing else to do.
    }
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === 1) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    if (step < 3) setStep(step + 1);
    else void handleSubmit();
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const org = await organizations.register({
        companyName,
        ownerName,
        email,
        password,
        phone,
        address,
        tier,
        estimatedMonthlyRent: estimatedMonthlyRental,
        propertyCount: unitCount,
        tenantCount,
        staffBreakdown: {
          managers: staffManagers,
          maintenance: staffMaintenance,
          finance: staffFinance,
          general: staffGeneral,
        },
      });
      const reference = (org?.id ?? '').slice(0, 8).toUpperCase() || 'PENDING';
      setSubmitted({ orgName: companyName, reference });
      onSuccess(companyName);
      toast.success(
        'Application submitted',
        `${companyName} is pending approval.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReference = async () => {
    if (!submitted) return;
    try {
      await navigator.clipboard.writeText(submitted.reference);
      toast.success('Reference copied');
    } catch {
      /* ignore */
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      size="lg"
      title="Register Organisation"
      subtitle={
        submitted
          ? 'Application submitted'
          : `Step ${step} of 3: ${
              step === 1
                ? 'Company & Owner'
                : step === 2
                  ? 'Property Portfolio'
                  : 'Subscription'
            }`
      }
      icon={<Building2 className="w-5 h-5 text-blue-600" />}
      // Once submitted, don't allow Escape/backdrop dismiss — user must use "Back to sign in".
      dismissOnBackdrop={!submitted}
      dismissOnEscape={!submitted}
      showCloseButton={!submitted}
    >
      {/* Progress bar */}
      {!submitted && (
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-1 transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      )}

      {submitted ? (
        <div className="space-y-5 py-2">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-xl text-slate-900 dark:text-white">
              Application submitted
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto">
              <strong>{submitted.orgName}</strong> is now <em>Pending Approval</em>.
              A platform administrator will review your application and issue
              your organisation code.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Application reference
                </div>
                <div className="font-mono text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {submitted.reference}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyReference}
                className="shrink-0 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Copy reference"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
            <div className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> What happens next
            </div>
            <ol className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 list-decimal list-inside">
              <li>An admin reviews your application (usually within 1 business day).</li>
              <li>You'll receive your organisation code once approved.</li>
              <li>
                Sign in with that code and the password you chose during
                registration.
              </li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                const go = onGoToSignIn;
                handleClose();
                go?.();
              }}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-4 h-4" /> Back to sign in
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleNext} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs text-red-700 dark:text-red-300 rounded-xl">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Company Name *
                  </label>
                  <input
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Ezulwini Commercial Holdings"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Owner / MD Name *
                  </label>
                  <input
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Lindiwe Dlamini"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Official Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.sz"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Phone *
                  </label>
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+268 …"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Head Office Address *
                </label>
                <input
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Suite 402, Ezulwini Commercial Plaza"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Choose a password *
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Confirm password *
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" /> Estimated
                  staff breakdown
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Managers', value: staffManagers, set: setStaffManagers },
                    { label: 'Maintenance', value: staffMaintenance, set: setStaffMaintenance },
                    { label: 'Finance', value: staffFinance, set: setStaffFinance },
                    { label: 'General', value: staffGeneral, set: setStaffGeneral },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      <span className="text-[10px] text-slate-500">
                        {s.label}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={s.value}
                        onChange={(e) => s.set(Number(e.target.value) || 0)}
                        className="w-full bg-transparent text-xs font-bold mt-1 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Primary Property *
                  </label>
                  <input
                    required
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    placeholder="e.g. The Gables Shopping Centre"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Property Category
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <option>Shopping Centre / Mall</option>
                    <option>Commercial Office Park</option>
                    <option>Industrial Logistics Park</option>
                    <option>Mixed-use Retail &amp; Office</option>
                    <option>Strip Mall</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Location</label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <option>Ezulwini Valley</option>
                    <option>Mbabane Central</option>
                    <option>Manzini City</option>
                    <option>Matsapha Industrial</option>
                    <option>Nhlangano</option>
                    <option>Piggs Peak</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Total Units</label>
                  <input
                    type="number"
                    min={1}
                    value={unitCount}
                    onChange={(e) => setUnitCount(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Active Tenants</label>
                  <input
                    type="number"
                    min={0}
                    value={tenantCount}
                    onChange={(e) => setTenantCount(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Estimated Monthly Rent Roll (E) *
                </label>
                <input
                  type="number"
                  min={0}
                  value={estimatedMonthlyRental}
                  onChange={(e) => setEstimatedMonthlyRental(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {plans.map((plan) => (
                  <div
                    key={plan.tier}
                    onClick={() => setTier(plan.tier)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                      tier === plan.tier
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{plan.name}</div>
                    <div className="text-lg font-extrabold text-blue-600 mt-1">
                      E{plan.monthlyFeeE.toLocaleString()}
                      <span className="text-[10px] text-slate-500 font-normal">/mo</span>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-[10px] text-slate-500">
                      {plan.features.slice(0, 3).map((f) => (
                        <li key={f}>• {f}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  Dynamic fee preview
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <div className="text-[10px] text-slate-500">Base Fee</div>
                    <div className="font-bold">E{feePreview.baseFee.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Rent Roll (2%)</div>
                    <div className="font-bold">E{feePreview.rentRollFee.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Monthly Est.</div>
                    <div className="font-extrabold text-blue-600">
                      E{feePreview.total.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-md flex items-center gap-1.5"
              >
                <span>
                  {loading ? 'Submitting…' : step === 3 ? 'Submit' : 'Continue'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
