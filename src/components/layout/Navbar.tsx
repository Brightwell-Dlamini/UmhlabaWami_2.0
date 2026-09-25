import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  User,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Search,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { auth } from '../../services/auth';
import { notifications as notifApi } from '../../services/api/notifications';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useRealtime } from '../../hooks/useRealtime';
import { useCommandPalette } from '../../hooks/useCommandPalette';
import type { NotificationItem } from '../../types';

const LOGO_SRC = '/Umhlaba Wami logo p.png';
const LOGO_FALLBACK = '/Umhlaba Wami logo.jpg';

interface NavbarProps {
  onOpenLogin?: () => void;
  onOpenRegisterOrg?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  viewMode?: 'home' | 'dashboard';
  onSwitchViewMode?: (mode: 'home' | 'dashboard') => void;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenLogin,
  onOpenRegisterOrg,
  isDarkMode = false,
  onToggleDarkMode,
  viewMode = 'home',
  onSwitchViewMode,
  onLoginClick,
  onRegisterClick,
}) => {
  const [currentUser, setCurrentUser] = useState(auth.getCurrentUser());
  const [currentOrg, setCurrentOrg] = useState(auth.getCurrentOrganization());
  const [showNotifs, setShowNotifs] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

  const { open: openPalette } = useCommandPalette();

  useEffect(() => {
    return auth.subscribe(() => {
      setCurrentUser(auth.getCurrentUser());
      setCurrentOrg(auth.getCurrentOrganization());
    });
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    void notifApi
      .ensureWelcome()
      .then(() => refetchCount())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: unreadCount = 0, refetch: refetchCount } = useSupabaseQuery(
    ['notifications', 'unread', currentUser?.id ?? ''],
    () => (currentUser ? notifApi.unreadCount() : Promise.resolve(0)),
    { enabled: !!currentUser }
  );

  const { data: notifList = [], refetch: refetchList } = useSupabaseQuery(
    ['notifications', 'list', currentUser?.id ?? ''],
    () =>
      currentUser
        ? notifApi.list()
        : Promise.resolve([] as NotificationItem[]),
    { enabled: !!currentUser }
  );

  useRealtime({
    table: 'notifications',
    filter: currentUser ? `user_id=eq.${currentUser.id}` : undefined,
    invalidateKeys: ['notifications'],
    enabled: !!currentUser,
  });

  const openLogin = () => onOpenLogin?.() ?? onLoginClick?.();
  const openRegister = () => onOpenRegisterOrg?.() ?? onRegisterClick?.();
  const goDashboard = () => onSwitchViewMode?.('dashboard');

  const handleLogout = async () => {
    await auth.logout();
    setShowRoleMenu(false);
    setIsMenuOpen(false);
    setShowNotifs(false);
    onSwitchViewMode?.('home');
  };

  const handleMarkAllRead = async () => {
    try {
      await notifApi.markAllRead();
      refetchCount();
      refetchList();
    } catch {}
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notifApi.markRead(id);
      refetchCount();
      refetchList();
    } catch {}
  };

  const count = typeof unreadCount === 'number' ? unreadCount : 0;
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';
  const userInitial = (currentUser?.name || '?').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--uw-border)] bg-[var(--uw-surface)]/95 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-5 h-12 flex items-center justify-between gap-3">
        <button
          onClick={currentUser ? goDashboard : () => onSwitchViewMode?.('home')}
          className="flex items-center gap-2.5 min-w-0 shrink-0"
          type="button"
        >
          {!logoError ? (
            <img src={LOGO_SRC} alt="Umhlaba Wami" className="h-7 w-auto object-contain" onError={() => setLogoError(true)} />
          ) : (
            <img src={LOGO_FALLBACK} alt="Umhlaba Wami" className="h-7 w-auto object-contain" />
          )}
          {currentOrg?.name && (
            <span className="hidden sm:inline text-xs font-semibold text-[var(--uw-text)] truncate max-w-[160px]">
              {currentOrg.name}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {currentUser && (
            <button
              type="button"
              onClick={() => openPalette()}
              className="hidden md:flex items-center gap-2 px-2.5 h-7 rounded-md border border-[var(--uw-border)] text-[11px] text-[var(--uw-text-muted)] hover:text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)]"
            >
              <Search className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Search</span>
              <kbd className="kbd">{shortcutLabel}</kbd>
            </button>
          )}

          {currentUser && (
            <div className="relative hidden md:block" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setShowNotifs((v) => {
                    const next = !v;
                    if (next) {
                      void refetchCount();
                      void refetchList();
                    }
                    return next;
                  });
                  setShowRoleMenu(false);
                }}
                className="relative w-7 h-7 rounded-md text-[var(--uw-text-muted)] hover:text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] transition-colors duration-fast flex items-center justify-center"
                title="Notifications"
              >
                <Bell className="w-3.5 h-3.5" strokeWidth={1.75} />
                {count > 0 && (
                  <span className="absolute top-1 right-1 min-w-[12px] h-[12px] px-1 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center ring-2 ring-[var(--uw-surface)]">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-1.5 w-80 max-h-96 overflow-y-auto rounded-xl border border-[var(--uw-border)] bg-[var(--uw-surface)] shadow-lg z-50">
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--uw-border)]">
                    <span className="text-xs font-semibold text-[var(--uw-text)]">Notifications</span>
                    {count > 0 && (
                      <button type="button" onClick={() => void handleMarkAllRead()} className="text-[11px] font-semibold text-[var(--uw-accent)] hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div>
                    {notifList.length === 0 ? (
                      <div className="px-3 py-8 text-center text-xs text-[var(--uw-text-muted)]">No notifications yet</div>
                    ) : (
                      notifList.map((n: NotificationItem) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => !n.read && handleMarkRead(n.id)}
                          className={`w-full text-left px-3 py-2.5 hover:bg-[var(--uw-surface-raised)] transition-colors duration-fast border-b border-[var(--uw-border)] last:border-0 ${!n.read ? 'bg-[var(--uw-accent)]/10' : ''}`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--uw-accent)] shrink-0" />}
                            <div className={!n.read ? 'min-w-0' : 'pl-3.5 min-w-0'}>
                              <div className="text-xs font-medium text-[var(--uw-text)] leading-snug">{n.title}</div>
                              {n.message && (
                                <div className="text-[11px] text-[var(--uw-text-muted)] mt-0.5 line-clamp-2 leading-snug">{n.message}</div>
                              )}
                              <div className="text-[10px] text-[var(--uw-text-subtle)] mt-1">
                                {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleDarkMode}
            className="hidden md:flex w-7 h-7 rounded-md text-[var(--uw-text-muted)] hover:text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] items-center justify-center"
            title="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" strokeWidth={1.75} /> : <Moon className="w-3.5 h-3.5" strokeWidth={1.75} />}
          </button>

          {currentUser ? (
            <div className="relative hidden md:block" ref={userRef}>
              <button
                type="button"
                onClick={() => {
                  setShowRoleMenu((v) => !v);
                  setShowNotifs(false);
                }}
                className="flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-md hover:bg-[var(--uw-surface-raised)]"
              >
                <span className="w-6 h-6 rounded-full bg-[var(--uw-accent)]/15 text-[var(--uw-accent)] text-[11px] font-bold flex items-center justify-center">
                  {userInitial}
                </span>
                <span className="text-xs font-medium text-[var(--uw-text)] max-w-[100px] truncate">{currentUser.name}</span>
                <ChevronDown className="w-3 h-3 text-[var(--uw-text-muted)]" />
              </button>
              {showRoleMenu && (
                <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-[var(--uw-border)] bg-[var(--uw-surface)] shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-[var(--uw-border)]">
                    <div className="text-xs font-semibold text-[var(--uw-text)]">{currentUser.name}</div>
                    <div className="text-[10px] text-[var(--uw-text-muted)] capitalize">{currentUser.role?.replace('_', ' ')}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <button
                type="button"
                onClick={openLogin}
                className="px-3 h-7 rounded-md text-xs font-semibold text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)]"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={openRegister}
                className="px-3 h-7 rounded-md text-xs font-bold uw-btn-primary"
              >
                Register org
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            className="md:hidden w-7 h-7 rounded-md text-[var(--uw-text)] flex items-center justify-center"
          >
            {isMenuOpen ? <X className="w-4 h-4" strokeWidth={1.75} /> : <Menu className="w-4 h-4" strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden border-t border-[var(--uw-border)] bg-[var(--uw-surface)] px-4 py-3 space-y-2">
          {currentUser ? (
            <>
              <div className="text-xs font-semibold">{currentUser.name}</div>
              <button type="button" onClick={() => void handleLogout()} className="flex items-center gap-2 text-xs text-red-600 w-full py-2">
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={openLogin} className="text-xs font-semibold w-full py-2 text-left">
                Sign in
              </button>
              <button type="button" onClick={openRegister} className="text-xs font-bold w-full py-2 text-left uw-btn-primary rounded-md px-3">
                Register organisation
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
};
