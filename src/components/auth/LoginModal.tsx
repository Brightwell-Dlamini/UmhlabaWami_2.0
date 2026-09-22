import React, { useMemo, useState } from 'react';
import {
  Lock,
  Building,
  User,
  KeyRound,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  Mail,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { Modal } from '../ui/Modal';
import { FindOrgModal } from './FindOrgModal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRegisterOrg: () => void;
  onLoginSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Password strength — compact scorer for the register/change flows.
// Not used to gate submission in login; shown only when typing a new one.
// ---------------------------------------------------------------------------

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

interface StrengthResult {
  level: StrengthLevel;
  label: string;
  tone: string;
}

function scorePassword(pw: string): StrengthResult {
  if (!pw) return { level: 0, label: '', tone: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const level = Math.min(4, score) as StrengthLevel;

  const map: Record<StrengthLevel, StrengthResult> = {
    0: { level: 0, label: '', tone: '' },
    1: {
      level: 1,
      label: 'Weak',
      tone: 'bg-red-500',
    },
    2: {
      level: 2,
      label: 'Fair',
      tone: 'bg-amber-500',
    },
    3: {
      level: 3,
      label: 'Strong',
      tone: 'bg-emerald-500',
    },
    4: {
      level: 4,
      label: 'Excellent',
      tone: 'bg-emerald-600',
    },
  };

  return map[level];
}

// ---------------------------------------------------------------------------
// Caps Lock detection
// ---------------------------------------------------------------------------

function useCapsLock(): boolean {
  const [active, setActive] = useState(false);
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setActive(e.getModifierState('CapsLock'));
    }
  };
  return active;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onOpenRegisterOrg,
  onLoginSuccess,
}) => {
  const [orgCode, setOrgCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCaptchaChecked, setIsCaptchaChecked] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFindOrg, setShowFindOrg] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);

  const handleCapsCheck = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLock(e.getModifierState('CapsLock'));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isCaptchaChecked) {
      setErrorMsg('Please confirm you are not a robot.');
      return;
    }

    setLoading(true);
    const res = await auth.login(orgCode, username, password);
    setLoading(false);

    if (res.success) {
      onLoginSuccess();
      onClose();
    } else {
      setErrorMsg(res.error || 'Login failed');
    }
  };

  // Reset caps-lock badge when the modal closes so the next open is clean.
  React.useEffect(() => {
    if (!isOpen) {
      setCapsLock(false);
    }
  }, [isOpen]);

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        size="sm"
        title="Sign in"
        subtitle="Organisation workspace access"
        icon={<Lock className="w-5 h-5 text-blue-600" />}
      >
        <form onSubmit={handleLogin} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Organisation code
              </label>
              <button
                type="button"
                onClick={() => setShowFindOrg(true)}
                className="text-[11px] font-semibold text-blue-600 hover:underline"
              >
                Find my code
              </button>
            </div>
            <div className="flex items-center px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-600">
              <Building className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                required
                value={orgCode}
                onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                placeholder="e.g. ACME or SUPER"
                className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none font-mono uppercase"
                autoComplete="organization"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Username or Email
            </label>
            <div className="flex items-center px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-600">
              <User className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your.username"
                className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-[11px] font-semibold text-blue-600 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="flex items-center px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-600">
              <KeyRound className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleCapsCheck}
                onKeyUp={handleCapsCheck}
                onBlur={() => setCapsLock(false)}
                placeholder="••••••••"
                className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none"
                autoComplete="current-password"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="ml-1 p-1 rounded-lg text-slate-400 hover:text-slate-600"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {capsLock && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Caps Lock is on
              </div>
            )}

            {password && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full transition-all ${strength.tone}`}
                      style={{ width: `${(strength.level / 4) * 100}%` }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-bold w-14 text-right ${
                      strength.level === 1
                        ? 'text-red-600'
                        : strength.level === 2
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                    }`}
                  >
                    {strength.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isCaptchaChecked}
                onChange={(e) => setIsCaptchaChecked(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span>I am not a robot (reCAPTCHA)</span>
            </label>
            <ShieldCheck className="w-4 h-4 text-slate-400" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-[11px] text-slate-500">
            New organisation?{' '}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRegisterOrg();
              }}
              className="text-blue-600 font-semibold hover:underline"
            >
              Register here
            </button>
          </p>
        </form>
      </Modal>

      <FindOrgModal
        isOpen={showFindOrg}
        onClose={() => setShowFindOrg(false)}
        onUseCode={(code) => {
          setOrgCode(code);
          setShowFindOrg(false);
        }}
      />

      <ForgotPasswordModal
        isOpen={showForgot}
        onClose={() => setShowForgot(false)}
        defaultOrgCode={orgCode}
        defaultIdentifier={username}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Forgot password — unchanged logic; kept intact
// ---------------------------------------------------------------------------

function ForgotPasswordModal({
  isOpen,
  onClose,
  defaultOrgCode,
  defaultIdentifier,
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultOrgCode: string;
  defaultIdentifier: string;
}) {
  const [orgCode, setOrgCode] = useState(defaultOrgCode);
  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { kind: 'idle' }
    | { kind: 'accepted'; message: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  React.useEffect(() => {
    if (isOpen) {
      setOrgCode((prev) => prev || defaultOrgCode);
      setIdentifier((prev) => prev || defaultIdentifier);
      setResult({ kind: 'idle' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult({ kind: 'idle' });
    try {
      const res = await auth.requestPasswordReset(orgCode, identifier);
      if (res.accepted) {
        setResult({ kind: 'accepted', message: res.message });
      } else {
        setResult({ kind: 'error', message: res.message });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      title="Reset your password"
      subtitle="We'll email you a secure reset link"
      icon={<Mail className="w-5 h-5 text-blue-600" />}
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div>
          <label className="block font-semibold mb-1">Organisation code</label>
          <input
            required
            value={orgCode}
            onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
            placeholder="e.g. ACME or SUPER"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono uppercase"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Username or email</label>
          <input
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="your.username or you@company.sz"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
        </div>

        {result.kind === 'accepted' && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
            {result.message}
          </div>
        )}
        {result.kind === 'error' && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200">
            {result.message}
          </div>
        )}

        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
          >
            Close
          </button>
          {result.kind !== 'accepted' && (
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
