import React, { useEffect, useRef, useState } from 'react';
import { Bell, User, LogOut, ChevronDown, Moon, Sun, Menu, X, CheckCheck } from 'lucide-react';
import { auth } from '../../services/auth';
import { notifications as notifApi } from '../../services/api/notifications';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useRealtime } from '../../hooks/useRealtime';
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
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return auth.subscribe(() => {
      setCurrentUser(auth.getCurrentUser());
      setCurrentOrg(auth.getCurrentOrganization());
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    if (showNotifs) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifs]);

  const { data: unreadCount = 0, refetch: refetchCount } = useSupabaseQuery(
    ['notifications', 'unread', currentUser?.id ?? ''],
    () => (currentUser ? notifApi.unreadCount() : Promise.resolve(0)),
    { enabled: !!currentUser }
  );

  const { data: notifList = [], refetch: refetchList } = useSupabaseQuery(
    ['notifications', 'list', currentUser?.id ?? ''],
    () => (currentUser ? notifApi.list() : Promise.resolve([] as NotificationItem[])),
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
    } catch { /* ignore */ }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notifApi.markRead(id);
      refetchCount();
      refetchList();
    } catch { /* ignore */ }
  };

  const count = typeof unreadCount === 'number' ? unreadCount : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
        <button
          onClick={currentUser ? goDashboard : () => onSwitchViewMode?.('home')}
          className="flex items-center gap-2.5 min-w-0"
        >
          <img
            src={logoSrc}
            alt="Umhlaba Wami"
            className="h-9 w-auto object-contain shrink-0"
            onError={() => setLogoSrc(LOGO_FALLBACK)}
          />
          <div className="hidden sm:block text-left">
            <div className="font-display font-bold text-sm text-slate-900 dark:text-white leading-tight">
              Umhlaba Wami
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Property management
            </div>
          </div>
        </button>

        <div className="hidden md:flex items-center gap-2">
          {currentUser ? (
            <>
              {currentOrg && (
                <span className="text-[11px] font-mono text-slate-500 px-2 hidden lg:inline">
                  {currentOrg.organization_code}
                </span>
              )}

              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifs((v) => !v);
                    setShowRoleMenu(false);
                  }}
                  className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {count > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </button>

                {showNotifs && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold">Notifications</span>
                      {count > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <CheckCheck className="w-3 h-3" /> Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {notifList.length === 0 ? (
                        <div className="px-4 py-10 text-center text-xs text-slate-400">
                          No notifications yet
                        </div>
                      ) : (
                        notifList.map((n: NotificationItem) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => !n.read && handleMarkRead(n.id)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                              !n.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {!n.read && (
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                              )}
                              <div className={!n.read ? '' : 'pl-3.5'}>
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                  {n.title}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                  {n.message}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1">
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

              <button
                onClick={onToggleDarkMode}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <div className="relative">
                <button
                  onClick={() => {
                    setShowRoleMenu((v) => !v);
                    setShowNotifs(false);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <User className="w-4 h-4" />
                  <span className="max-w-[120px] truncate">{currentUser.name}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showRoleMenu && (
                  <div className="absolute right-0 mt-1 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1 z-50">
                    <p className="px-3 py-1.5 text-[10px] uppercase text-slate-400">
                      {currentUser.role.replace(/_/g, ' ')}
                    </p>
                    {viewMode !== 'dashboard' && (
                      <button
                        onClick={() => {
                          goDashboard();
                          setShowRoleMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Open workspace
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-xs text-red-600 flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={onToggleDarkMode}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={openLogin}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Sign in
              </button>
              <button
                onClick={openRegister}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
              >
                Register organisation
              </button>
            </>
          )}
        </div>

        <div className="flex md:hidden items-center gap-1">
          {currentUser && (
            <button
              type="button"
              onClick={() => setShowNotifs((v) => !v)}
              className="relative p-2 rounded-lg text-slate-500"
            >
              <Bell className="w-4 h-4" />
              {count > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
            </button>
          )}
          <button onClick={onToggleDarkMode} className="p-2 rounded-lg text-slate-500">
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {showNotifs && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 max-h-72 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <span className="text-xs font-bold">Notifications</span>
            {count > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-[10px] text-blue-600 font-semibold">
                Mark all read
              </button>
            )}
          </div>
          {notifList.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">No notifications</div>
          ) : (
            notifList.map((n: NotificationItem) => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.read && handleMarkRead(n.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-900 ${!n.read ? 'bg-blue-50/40' : ''}`}
              >
                <div className="text-xs font-semibold">{n.title}</div>
                <div className="text-[11px] text-slate-500 line-clamp-2">{n.message}</div>
              </button>
            ))
          )}
        </div>
      )}

      {isMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 space-y-2">
          {currentUser ? (
            <>
              <p className="text-xs text-slate-500">
                {currentUser.name} · {currentUser.role.replace(/_/g, ' ')}
              </p>
              <button onClick={() => { goDashboard(); setIsMenuOpen(false); }} className="w-full text-left text-sm font-medium py-2">
                Workspace
              </button>
              <button onClick={handleLogout} className="w-full text-left text-sm text-red-600 py-2">
                Sign out
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { openLogin(); setIsMenuOpen(false); }} className="w-full text-left text-sm py-2">
                Sign in
              </button>
              <button onClick={() => { openRegister(); setIsMenuOpen(false); }} className="w-full text-left text-sm font-semibold text-blue-600 py-2">
                Register organisation
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
};
