import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  User,
  LogOut,
  ChevronDown,
  Moon,
  Sun,
  Menu,
  X,
  CheckCheck,
  Search,
  Command as CommandIcon,
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
  viewMode,
  onSwitchViewMode,
  onLoginClick,
  onRegisterClick,
}) => {
  const [currentUser, setCurrentUser] = useState(auth.getCurrentUser());
  const [currentOrg, setCurrentOrg] = useState(auth.getCurrentOrganization());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [logoSrc, setLogoSrc] = useState(LOGO_SRC);
  const [isMac, setIsMac] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const { openPalette } = useCommandPalette();

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
    }
  }, []);

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
      .catch(() => {
        /* non-fatal */
      });
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
    { enabled: !!currentUser && showNotifs }
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
    } catch {
      /* ignore */
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notifApi.markRead(id);
      refetchCount();
      refetchList();
    } catch {
      /* ignore */
    }
  };

  const count = typeof unreadCount === 'number' ? unreadCount : 0;
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';
  const userInitial = (currentUser?.name || '?').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--uw-border)] bg-[var(--uw-surface)]/95 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-5 h-12 flex items-center justify-between gap-3">
        {/* Left: logo + org name */}
        <button
          onClick={currentUser ? goDashboard : () => onSwitchViewMode?.('home')}
          className="flex items-center gap-2.5 min-w-0 shrink-0"
        >
          {currentOrg?.logo_url ? (
            <img
              src={currentOrg.logo_url}
              alt={currentOrg.company_name || 'Organisation'}
              className="h-6 w-6 rounded-md object-contain shrink-0 border border-[var(--uw-border)] bg-white"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <img
              src={logoSrc}
              alt="Umhlaba Wami"
              className="h-6 w-auto object-contain shrink-0"
              onError={() => setLogoSrc(LOGO_FALLBACK)}
            />
          )}
          <div className="hidden sm:block text-left">
            <div className="font-semibold text-[13px] text-[var(--uw-text)] leading-tight truncate">
              {currentOrg?.company_name || 'Umhlaba Wami'}
            </div>
          </div>
        </button>

        {/* Centre: command palette */}
        {currentUser && (
          <button
            type="button"
            onClick={openPalette}
            className="hidden md:flex items-center gap-2 text-xs text-[var(--uw-text-subtle)] hover:text-[var(--uw-text-muted)] px-3 h-7 rounded-md border border-[var(--uw-border)] bg-[var(--uw-surface-raised)] hover:border-[var(--uw-border-soft)] transition-colors duration-fast w-full max-w-md mx-auto"
            title={`Search or jump to… (${shortcutLabel})`}
            aria-label={`Open command palette (${shortcutLabel})`}
          >
            <Search className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span className="flex-1 text-left truncate">
              Search or jump to…
            </span>
            <kbd className="kbd shrink-0">{shortcutLabel}</kbd>
          </button>
        )}

        {/* Right: user + notifs + theme */}
        <div className="hidden md:flex items-center gap-1 shrink-0">
          {currentUser ? (
            <>
              {currentOrg && (
                <span className="text-[10px] font-mono text-[var(--uw-text-subtle)] px-2 hidden lg:inline">
                  {currentOrg.organization_code}
                </span>
              )}

              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifs((v) => !v);
                    setShowRoleMenu(false);
                  }}
                  className="relative w-7 h-7 rounded-md text-[var(--uw-text-muted)] hover:text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] transition-colors duration-fast flex items-center justify-center"
                  title="Notifications"
                >
                  <Bell className="w-3.5 h-3.5" strokeWidth={1.75} />
                  {count > 0 && (
                    <span className="absolute top-1 right-1 min-w-[12px] h-[12px] px-1 rounded-full bg-danger-500 text-white text-[8px] font-bold flex items-center justify-center ring-2 ring-[var(--uw-surface)]">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </button>

                {showNotifs && (
                  <div className="absolute right-0 mt-1.5 w-80 sm:w-96 rounded-lg border border-[var(--uw-border)] bg-[var(--uw-surface)] shadow-lg z-50 overflow-hidden animate-menu-in">
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--uw-border)]">
                      <span className="text-xs font-semibold text-[var(--uw-text)]">
                        Notifications
                      </span>
                      {count > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-[10px] font-medium text-accent-500 hover:text-accent-400 flex items-center gap-1"
                        >
                          <CheckCheck className="w-3 h-3" strokeWidth={2} /> Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto scrollbar-thin">
                      {notifList.length === 0 ? (
                        <div className="px-4 py-10 text-center text-xs text-[var(--uw-text-subtle)]">
                          No notifications yet
                        </div>
                      ) : (
                        notifList.map((n: NotificationItem) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => !n.read && handleMarkRead(n.id)}
                            className={`w-full text-left px-3 py-2.5 hover:bg-[var(--uw-surface-raised)] transition-colors duration-fast border-b border-[var(--uw-border)] last:border-0 ${
                              !n.read ? 'bg-accent-500/6' : ''
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {!n.read && (
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0" />
                              )}
                              <div className={!n.read ? 'min-w-0' : 'pl-3.5 min-w-0'}>
                                <div className="text-xs font-medium text-[var(--uw-text)] leading-snug">
                                  {n.title}
                                </div>
                                {n.message && (
                                  <div className="text-[11px] text-[var(--uw-text-muted)] mt-0.5 line-clamp-2 leading-snug">
                                    {n.message}
                                  </div>
                                )}
                                <div className="text-[10px] text-[var(--uw-text-subtle)] mt-1">
                                  {n.created_at
                                    ? new Date(n.created_at).toLocaleString()
                                    : ''}
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

              {/* Theme toggle */}
              <button
                onClick={onToggleDarkMode}
                className="w-7 h-7 rounded-md text-[var(--uw-text-muted)] hover:text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] transition-colors duration-fast flex items-center justify-center"
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? (
                  <Sun className="w-3.5 h-3.5" strokeWidth={1.75} />
                ) : (
                  <Moon className="w-3.5 h-3.5" strokeWidth={1.75} />
                )}
              </button>

              {/* User menu */}
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => {
                    setShowRoleMenu((v) => !v);
                    setShowNotifs(false);
                  }}
                  className="flex items-center gap-2 pl-1 pr-2 h-7 rounded-md text-xs font-medium text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] transition-colors duration-fast"
                >
                  <span className="w-6 h-6 rounded-md bg-accent-500/15 border border-accent-500/25 text-accent-500 flex items-center justify-center text-[11px] font-semibold shrink-0">
                    {userInitial}
                  </span>
                  <span className="max-w-[100px] truncate hidden lg:inline">
                    {currentUser.name}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[var(--uw-text-subtle)]" strokeWidth={2} />
                </button>
                {showRoleMenu && (
                  <div className="absolute right-0 mt-1.5 w-52 rounded-lg border border-[var(--uw-border)] bg-[var(--uw-surface)] shadow-lg py-1 z-50 animate-menu-in">
                    <div className="px-3 py-2 border-b border-[var(--uw-border)]">
                      <div className="text-xs font-semibold text-[var(--uw-text)] truncate">
                        {currentUser.name}
                      </div>
                      <div className="text-[10px] text-[var(--uw-text-subtle)] capitalize">
                        {currentUser.role.replace(/_/g, ' ')}
                      </div>
                    </div>
                    {viewMode !== 'dashboard' && (
                      <button
                        onClick={() => {
                          goDashboard();
                          setShowRoleMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] transition-colors duration-fast"
                      >
                        Open workspace
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-1.5 text-xs text-danger-500 hover:bg-danger-500/8 flex items-center gap-2 transition-colors duration-fast"
                    >
                      <LogOut className="w-3 h-3" strokeWidth={1.75} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={onToggleDarkMode}
                className="w-7 h-7 rounded-md text-[var(--uw-text-muted)] hover:text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] transition-colors duration-fast flex items-center justify-center"
              >
                {isDarkMode ? (
                  <Sun className="w-3.5 h-3.5" strokeWidth={1.75} />
                ) : (
                  <Moon className="w-3.5 h-3.5" strokeWidth={1.75} />
                )}
              </button>
              <button
                onClick={openLogin}
                className="px-3 h-7 rounded-md text-xs font-medium text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] transition-colors duration-fast"
              >
                Sign in
              </button>
              <button
                onClick={openRegister}
                className="px-3 h-7 rounded-md text-xs font-semibold bg-accent-500 text-white hover:bg-accent-600 transition-colors duration-fast"
              >
                Register
              </button>
            </>
          )}
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-1">
          {currentUser && (
            <>
              <button
                type="button"
                onClick={openPalette}
                className="w-7 h-7 rounded-md text-[var(--uw-text-muted)] flex items-center justify-center"
                aria-label="Open command palette"
              >
                <Search className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => setShowNotifs((v) => !v)}
                className="relative w-7 h-7 rounded-md text-[var(--uw-text-muted)] flex items-center justify-center"
              >
                <Bell className="w-3.5 h-3.5" strokeWidth={1.75} />
                {count > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-danger-500" />
                )}
              </button>
            </>
          )}
          <button
            onClick={onToggleDarkMode}
            className="w-7 h-7 rounded-md text-[var(--uw-text-muted)] flex items-center justify-center"
          >
            {isDarkMode ? (
              <Sun className="w-3.5 h-3.5" strokeWidth={1.75} />
            ) : (
              <Moon className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
          </button>
          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className="w-7 h-7 rounded-md text-[var(--uw-text)] flex items-center justify-center"
          >
            {isMenuOpen ? (
              <X className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Menu className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile notifications sheet */}
      {showNotifs && (
        <div className="md:hidden border-t border-[var(--uw-border)] bg-[var(--uw-surface)] max-h-72 overflow-y-auto scrollbar-thin">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--uw-border)]">
            <span className="text-xs font-semibold">Notifications</span>
            {count > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[10px] text-accent-500 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifList.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--uw-text-subtle)]">
              No notifications
            </div>
          ) : (
            notifList.map((n: NotificationItem) => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.read && handleMarkRead(n.id)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--uw-border)] last:border-0 ${
                  !n.read ? 'bg-accent-500/6' : ''
                }`}
              >
                <div className="text-xs font-medium">{n.title}</div>
                {n.message && (
                  <div className="text-[11px] text-[var(--uw-text-muted)] line-clamp-2 mt-0.5">
                    {n.message}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {isMenuOpen && (
        <div className="md:hidden border-t border-[var(--uw-border)] bg-[var(--uw-surface)] px-4 py-3 space-y-1">
          {currentUser ? (
            <>
              <div className="flex items-center gap-2.5 pb-2 mb-1 border-b border-[var(--uw-border)]">
                <span className="w-7 h-7 rounded-md bg-accent-500/15 border border-accent-500/25 text-accent-500 flex items-center justify-center text-xs font-semibold">
                  {userInitial}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{currentUser.name}</div>
                  <div className="text-[10px] text-[var(--uw-text-subtle)] capitalize">
                    {currentUser.role.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  goDashboard();
                  setIsMenuOpen(false);
                }}
                className="w-full text-left text-xs font-medium py-2 text-[var(--uw-text)]"
              >
                Workspace
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left text-xs text-danger-500 py-2"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  openLogin();
                  setIsMenuOpen(false);
                }}
                className="w-full text-left text-xs font-medium py-2 text-[var(--uw-text)]"
              >
                Sign in
              </button>
              <button
                onClick={() => {
                  openRegister();
                  setIsMenuOpen(false);
                }}
                className="w-full text-left text-xs font-semibold text-accent-500 py-2"
              >
                Register organisation
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
};
