import React, { useCallback, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { ProductHome } from './components/ProductHome';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterOrgModal } from './components/auth/RegisterOrgModal';
import { OperationsApp } from './components/OperationsApp';
import { auth } from './services/auth';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useToast } from './components/ui/ToastProvider';
import { Z } from './constants/zIndex';
import { WifiOff } from 'lucide-react';

function readInitialDarkMode(): boolean {
  try {
    const stored = localStorage.getItem('uw_dark_mode');
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
}

function applyDarkClass(enabled: boolean) {
  const root = document.documentElement;
  root.classList.toggle('dark', enabled);
  try {
    localStorage.setItem('uw_dark_mode', enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [booting, setBooting] = React.useState(true);
  const [currentUser, setCurrentUser] = React.useState(auth.getCurrentUser());
  const [isDarkMode, setIsDarkMode] = React.useState(readInitialDarkMode);
  const [isLoginOpen, setIsLoginOpen] = React.useState(false);
  const [isRegisterOrgOpen, setIsRegisterOrgOpen] = React.useState(false);
  const isOnline = useOnlineStatus();
  const toast = useToast();

  useEffect(() => {
    applyDarkClass(isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    auth.whenReady().then(() => {
      setCurrentUser(auth.getCurrentUser());
      setBooting(false);
    });
    return auth.subscribe((user) => {
      setCurrentUser((prev) => {
        if (!user) return null;
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

  const showToast = useCallback(
    (title: string, message: string) => {
      toast.success(title, message);
    },
    [toast]
  );

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--uw-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-md border-2 border-accent-500/30 border-t-accent-500 animate-spin" />
          <div className="text-xs text-[var(--uw-text-muted)]">
            Loading workspace…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--uw-bg)] text-[var(--uw-text)] flex flex-col transition-colors">
      {!isOnline && (
        <div
          className={`bg-warning-500 text-ink-100 px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 ${Z.banner}`}
        >
          <WifiOff className="w-3.5 h-3.5" strokeWidth={2} />
          You are offline. Changes may not sync.
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

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onOpenRegisterOrg={() => {
          setIsLoginOpen(false);
          setIsRegisterOrgOpen(true);
        }}
        onLoginSuccess={() =>
          showToast('Signed in', 'Welcome to your workspace.')
        }
      />

      <RegisterOrgModal
        isOpen={isRegisterOrgOpen}
        onClose={() => setIsRegisterOrgOpen(false)}
        onSuccess={(name) =>
          showToast('Registration submitted', `${name} is pending approval.`)
        }
      />
    </div>
  );
}
