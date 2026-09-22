import React, { useEffect, useRef, useState } from 'react';
import { Sidebar, getNavItemsForRole } from './layout/Sidebar';
import { TenantDashboard } from './dashboard/TenantDashboard';
import { ManagerDashboard } from './dashboard/ManagerDashboard';
import { MaintenancePortal } from './dashboard/MaintenancePortal';
import { FinancePortal } from './finance/FinancePortal';
import { SuperAdminPortal } from './dashboard/SuperAdminPortal';
import { BroadcastModal } from './dashboard/BroadcastModal';
import { CentresView } from './management/CentresView';
import { UnitsDirectoryView } from './management/UnitsDirectoryView';
import { LeaseManagementView } from './management/LeaseManagementView';
import { TicketsListView } from './dashboard/TicketsListView';
import { TenantsListView } from './dashboard/TenantsListView';
import { StaffScheduleView } from './dashboard/StaffScheduleView';
import { VendorsView } from './dashboard/VendorsView';
import { AnnouncementsView } from './dashboard/AnnouncementsView';
import { MessagesView } from './dashboard/MessagesView';
import { AnalyticsReportsView } from './dashboard/AnalyticsReportsView';
import { TenantDocumentsView } from './dashboard/TenantDocumentsView';
import { TenantFinanceView } from './dashboard/TenantFinanceView';
import { OrgUsersView } from './dashboard/OrgUsersView';
import { OrgSettingsView } from './dashboard/OrgSettingsView';
import { CreateTicketWizard } from './tickets/CreateTicketWizard';
import { TicketDetailModal } from './tickets/TicketDetailModal';
import { CentrePulseView } from './ops/CentrePulseView';
import { SlaMatrixView } from './ops/SlaMatrixView';
import { PreventiveMaintenanceView } from './ops/PreventiveMaintenanceView';
import { ProfileSettingsView } from './profile/ProfileSettingsView';
import { auth } from '../services/auth';
import { emergencyBroadcasts as emergApi } from '../services/api/announcements';
import { tickets as ticketsApi } from '../services/api/tickets';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useRealtime } from '../hooks/useRealtime';
import {
  defaultTabForRole,
  isTabAllowed,
  useTabGuard,
} from '../hooks/useTabGuard';
import type { User } from '../types';
import { Menu, Radio, X } from 'lucide-react';
import { Z } from '../constants/zIndex';

interface Props {
  currentUser: User;
  showToast: (title: string, message: string) => void;
}

const TAB_STORAGE_KEY = 'uw_sidebar_tab';

function readInitialTab(role?: User['role']): string {
  const fallback = defaultTabForRole(role);
  try {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('tab=')) {
      const tab = decodeURIComponent(hash.slice(4));
      if (tab && isTabAllowed(tab, role)) return tab;
    }
    const params = new URLSearchParams(hash);
    const fromParams = params.get('tab');
    if (fromParams && isTabAllowed(fromParams, role)) return fromParams;
    const stored = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (stored && isTabAllowed(stored, role)) return stored;
  } catch {
    /* ignore */
  }
  return fallback;
}

function persistTab(tab: string) {
  try {
    sessionStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    /* ignore */
  }
  try {
    const next = `#tab=${encodeURIComponent(tab)}`;
    if (window.location.hash !== next) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}${next}`
      );
    }
  } catch {
    /* ignore */
  }
}

export function clearPersistedTab() {
  try {
    sessionStorage.removeItem(TAB_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    const path = `${window.location.pathname}${window.location.search}`;
    if (window.location.hash) {
      window.history.replaceState(null, '', path);
    }
  } catch {
    /* ignore */
  }
}

export function OperationsApp({ currentUser, showToast }: Props) {
  const [sidebarActiveTab, setSidebarActiveTab] = useState(() =>
    readInitialTab(currentUser.role)
  );
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    persistTab(sidebarActiveTab);
  }, [sidebarActiveTab]);

  useTabGuard(sidebarActiveTab, currentUser.role, (safe) => {
    setSidebarActiveTab(safe);
  });

  const roleRef = useRef(currentUser.role);
  const userIdRef = useRef(currentUser.id);
  useEffect(() => {
    const roleChanged = roleRef.current !== currentUser.role;
    const userChanged = userIdRef.current !== currentUser.id;
    if (roleChanged || userChanged) {
      roleRef.current = currentUser.role;
      userIdRef.current = currentUser.id;
      const next = defaultTabForRole(currentUser.role);
      setSidebarActiveTab(next);
      persistTab(next);
      return;
    }
  }, [currentUser.role, currentUser.id]);

  useEffect(() => {
    if (!currentUser.organization_id) return;
    const run = () => {
      if (document.visibilityState !== 'visible') return;
      ticketsApi.runEscalation().catch(() => {
        /* non-fatal */
      });
    };
    const boot = setTimeout(run, 15_000);
    const id = setInterval(run, 120_000);
    return () => {
      clearTimeout(boot);
      clearInterval(id);
    };
  }, [currentUser.organization_id]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const { data: activeEmergencies = [] } = useSupabaseQuery(
    ['emergency_broadcasts', 'active', currentUser.organization_id ?? ''],
    () => emergApi.listActive(),
    {
      enabled:
        !!currentUser.organization_id && currentUser.role !== 'super_admin',
      refreshInterval: 180_000,
    }
  );

  useRealtime({
    table: 'emergency_broadcasts',
    filter: currentUser.organization_id
      ? `organization_id=eq.${currentUser.organization_id}`
      : undefined,
    invalidateKeys: ['emergency_broadcasts'],
    enabled: !!currentUser.organization_id,
  });

  const firstEmergency = activeEmergencies[0];
  const role = currentUser.role || 'tenant';
  const org = auth.getCurrentOrganization();
  const currentNavLabel =
    getNavItemsForRole(role).find((i) => i.id === sidebarActiveTab)?.label ??
    'Menu';

  const handleTabChange = (tab: string) => {
    if (tab === 'report_issue') {
      setIsCreateTicketOpen(true);
    } else {
      setSidebarActiveTab(tab);
    }
    setMobileNavOpen(false);
  };

  return (
    <>
      {firstEmergency && (
        <div className={`bg-red-600 text-white px-4 py-2 text-xs font-semibold shadow-md ${Z.banner}`}>
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <Radio className="w-4 h-4 animate-pulse shrink-0" />
            <span className="font-bold uppercase tracking-wider text-[10px] bg-red-800 px-1.5 py-0.5 rounded">
              {firstEmergency.type}
            </span>
            <span className="truncate">
              <strong>{firstEmergency.headline}:</strong>{' '}
              {firstEmergency.instructions}
            </span>
          </div>
        </div>
      )}

      <div className="lg:hidden sticky top-16 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-12 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm min-h-[40px]"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
            Menu
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {String(role).replace(/_/g, ' ')}
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {currentNavLabel}
            </p>
          </div>
        </div>
      </div>

      {mobileNavOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(100vw-3rem,20rem)] max-w-full shadow-2xl flex flex-col bg-white dark:bg-slate-900 animate-in">
            <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Navigation
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <Sidebar
                mobile
                role={role}
                activeTab={sidebarActiveTab}
                onTabChange={handleTabChange}
                organizationName={org?.company_name}
                orgCode={org?.organization_code}
                organizationLogo={org?.logo_url}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 gap-6">
        <div className="hidden lg:block w-64 shrink-0">
          <Sidebar
            role={role}
            activeTab={sidebarActiveTab}
            onTabChange={handleTabChange}
            onOpenCreateTicket={() => setIsCreateTicketOpen(true)}
            organizationName={org?.company_name}
            orgCode={org?.organization_code}
            organizationLogo={org?.logo_url}
          />
        </div>

        <div className="flex-1 min-w-0 overflow-x-hidden">
          {sidebarActiveTab === 'centres' && <CentresView />}
          {(sidebarActiveTab === 'units' ||
            sidebarActiveTab === 'properties') && (
            <UnitsDirectoryView onSelectShop={() => {}} />
          )}

          {sidebarActiveTab === 'tenant_overview' &&
            currentUser.role === 'tenant' && (
              <TenantDashboard
                onOpenCreateTicket={() => setIsCreateTicketOpen(true)}
                onViewTicket={(id) => setSelectedTicketId(id)}
              />
            )}
          {sidebarActiveTab === 'tenant_tickets' && (
            <TicketsListView
              onViewTicket={(id) => setSelectedTicketId(id)}
              onOpenCreateTicket={() => setIsCreateTicketOpen(true)}
            />
          )}
          {(sidebarActiveTab === 'tenant_lease' ||
            sidebarActiveTab === 'leases') && <LeaseManagementView />}
          {sidebarActiveTab === 'tenant_documents' && (
            <TenantDocumentsView />
          )}
          {sidebarActiveTab === 'tenant_finance' && <TenantFinanceView />}

          {(sidebarActiveTab === 'manager_overview' ||
            sidebarActiveTab === 'admin_overview' ||
            sidebarActiveTab === 'overview') &&
            currentUser.role !== 'tenant' &&
            currentUser.role !== 'maintenance' &&
            currentUser.role !== 'finance' &&
            currentUser.role !== 'super_admin' && (
              <ManagerDashboard
                onViewTicket={(id) => setSelectedTicketId(id)}
                onOpenCreateTicket={() => setIsCreateTicketOpen(true)}
                onOpenBroadcastModal={() => setIsBroadcastOpen(true)}
              />
            )}
          {sidebarActiveTab === 'centre_pulse' && <CentrePulseView />}
          {sidebarActiveTab === 'manager_tickets' && (
            <TicketsListView
              onViewTicket={(id) => setSelectedTicketId(id)}
              onOpenCreateTicket={() => setIsCreateTicketOpen(true)}
            />
          )}
          {sidebarActiveTab === 'sla_matrix' && <SlaMatrixView />}
          {sidebarActiveTab === 'preventive_maintenance' && (
            <PreventiveMaintenanceView />
          )}
          {sidebarActiveTab === 'maintenance_ops' && (
            <MaintenancePortal
              onViewTicket={(id) => setSelectedTicketId(id)}
            />
          )}
          {sidebarActiveTab === 'tenants_list' && (
            <TenantsListView
              onOpenCreateTicketForShop={() => setIsCreateTicketOpen(true)}
              onViewLeases={() => setSidebarActiveTab('leases')}
            />
          )}
          {sidebarActiveTab === 'staff_schedule' && <StaffScheduleView />}
          {sidebarActiveTab === 'vendors' && <VendorsView />}
          {sidebarActiveTab === 'announcements' && <AnnouncementsView />}
          {sidebarActiveTab === 'analytics_reports' && <AnalyticsReportsView />}

          {sidebarActiveTab === 'maintenance_jobs' && (
            <MaintenancePortal
              onViewTicket={(id) => setSelectedTicketId(id)}
            />
          )}
          {sidebarActiveTab === 'maintenance_completed' && (
            <TicketsListView
              onViewTicket={(id) => setSelectedTicketId(id)}
              onOpenCreateTicket={
                currentUser.role === 'maintenance'
                  ? undefined
                  : () => setIsCreateTicketOpen(true)
              }
            />
          )}

          {sidebarActiveTab === 'messages' && <MessagesView />}
          {sidebarActiveTab === 'profile_settings' && <ProfileSettingsView />}

          {(sidebarActiveTab === 'org_users' ||
            sidebarActiveTab === 'super_users') && <OrgUsersView />}
          {sidebarActiveTab === 'org_settings' && <OrgSettingsView />}

          {(sidebarActiveTab === 'finance_overview' ||
            sidebarActiveTab === 'commercial_engine' ||
            sidebarActiveTab === 'rent_roll' ||
            sidebarActiveTab === 'expenses_ledger' ||
            sidebarActiveTab === 'transactions' ||
            sidebarActiveTab === 'financial_requests' ||
            sidebarActiveTab === 'finance_documents') && (
            <FinancePortal initialTab={sidebarActiveTab} />
          )}

          {currentUser.role === 'super_admin' &&
            (sidebarActiveTab === 'super_overview' ||
              sidebarActiveTab === 'super_approvals' ||
              sidebarActiveTab === 'super_organizations' ||
              sidebarActiveTab === 'super_subscriptions' ||
              sidebarActiveTab === 'super_listings' ||
              sidebarActiveTab === 'audit_logs') && (
              <SuperAdminPortal initialTab={sidebarActiveTab} />
            )}
        </div>
      </div>

      <CreateTicketWizard
        isOpen={isCreateTicketOpen}
        onClose={() => setIsCreateTicketOpen(false)}
        onSuccess={(ticketNumber) =>
          showToast(
            'Ticket created',
            `Ticket #${ticketNumber} is open with SLA tracking.`
          )
        }
      />
      <TicketDetailModal
        ticketId={selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
        onRefresh={() =>
          showToast('Ticket updated', 'Status and audit trail saved.')
        }
      />
      <BroadcastModal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        onSent={() => showToast('Broadcast sent', 'Centre alert is now active.')}
      />
    </>
  );
}
