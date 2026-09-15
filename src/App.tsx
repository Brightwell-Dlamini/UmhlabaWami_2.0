import React, { useCallback, useEffect, useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { ProductHome } from './components/ProductHome';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterOrgModal } from './components/auth/RegisterOrgModal';
import { OperationsApp } from './components/OperationsApp';
import { auth } from './services/auth';
import { CheckCircle2, WifiOff } from 'lucide-react';
import { useOnlineStatus } from './hooks/useOnlineStatus';

function readInitialDarkMode(): boolean {
  try {
    const stored = localStorage.getItem('uw_dark_mode');
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyDarkClass(enabled: boolean) {
  const root = document.documentElement;
  root.classList.toggle('dark', enabled);
  try { localStorage.setItem('uw_dark_mode', enabled ? '1' : '0'); } catch { /* ignore */ }
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.getCurrentUser());
  const [isDarkMode, setIsDarkMode] = useState(readInitialDarkMode);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOrgOpen, setIsRegisterOrgOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => { applyDarkClass(isDarkMode); }, [isDarkMode]);

  useEffect(() => {
    auth.whenReady().then(() => {
      setCurrentUser(auth.getCurrentUser());
      setBooting(false);
    });
    return auth.subscribe((user) => {
      setCurrentUser((prev) => {
        if (!user) return null;
        // Keep same reference when identity fields unchanged — prevents form remounts
        if (
          prev &&
          prev.id === user.id &&
          prev.role === user.role &&
          prev.organization_id === user.organization_id &&
          prev.status === user.status &&
          prev.name === user.name
        ) {
          return prev;
        }
        return user;
      });
      if (user) setIsLoginOpen(false);
    });
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const showToast = (title: string, message: string) => {
    setToast({ title, message });
    setTimeout(() => setToast(null), 4000);
  };

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-sm text-slate-500">Loading workspace…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {!isOnline && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 z-40">
          <WifiOff className="w-4 h-4" /> You are offline. Changes may not sync.
        </div>
      )}

      <Navbar
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenRegisterOrg={() => setIsRegisterOrgOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        viewMode={currentUser ? 'dashboard' : 'home'}
        onSwitchViewMode={() => {}}
      />

      <div className="flex-1 flex flex-col">
        {currentUser ? (
          <OperationsApp currentUser={currentUser} showToast={showToast} />
        ) : (
          <ProductHome
            onSignIn={() => setIsLoginOpen(true)}
            onRegisterOrganisation={() => setIsRegisterOrgOpen(true)}
          />
        )}
      </div>

      {!currentUser && <Footer />}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 flex items-center gap-3 max-w-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-bold">{toast.title}</div>
            <div className="text-[11px] text-slate-300">{toast.message}</div>
          </div>
        </div>
      )}

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onOpenRegisterOrg={() => {
          setIsLoginOpen(false);
          setIsRegisterOrgOpen(true);
        }}
        onLoginSuccess={() => showToast('Signed in', 'Welcome to your workspace.')}
      />

      <RegisterOrgModal
        isOpen={isRegisterOrgOpen}
        onClose={() => setIsRegisterOrgOpen(false)}
        onSuccess={(name) => showToast('Registration submitted', `${name} is pending approval.`)}
      />
    </div>
  );
}
