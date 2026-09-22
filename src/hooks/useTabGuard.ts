import { useEffect } from 'react';
import type { UserRole } from '../types';

/**
 * Central registry of which sidebar tabs each role may access.
 * Kept here (not in OperationsApp) so tests and other UIs can import it
 * without pulling in the whole app shell.
 *
 * The `defaultTab` for each role is the fallback when an attempted tab
 * is not permitted.
 */

const TENANT_TABS = new Set([
  'tenant_overview',
  'tenant_tickets',
  'report_issue',
  'tenant_finance',
  'messages',
  'tenant_documents',
  'tenant_lease',
  'announcements',
  'profile_settings',
]);

const MANAGER_TABS = new Set([
  'manager_overview',
  'centre_pulse',
  'centres',
  'units',
  'properties',
  'manager_tickets',
  'sla_matrix',
  'preventive_maintenance',
  'maintenance_ops',
  'tenants_list',
  'leases',
  'staff_schedule',
  'vendors',
  'finance_overview',
  'announcements',
  'analytics_reports',
  'messages',
  'profile_settings',
]);

const MAINTENANCE_TABS = new Set([
  'maintenance_jobs',
  'staff_schedule',
  'maintenance_completed',
  'messages',
  'profile_settings',
]);

const FINANCE_TABS = new Set([
  'finance_overview',
  'commercial_engine',
  'rent_roll',
  'expenses_ledger',
  'transactions',
  'financial_requests',
  'finance_documents',
  'analytics_reports',
  'profile_settings',
]);

const ADMIN_TABS = new Set([
  'admin_overview',
  'overview',
  'centre_pulse',
  'centres',
  'units',
  'properties',
  'tenants_list',
  'leases',
  'org_users',
  'manager_tickets',
  'sla_matrix',
  'preventive_maintenance',
  'staff_schedule',
  'vendors',
  'finance_overview',
  'commercial_engine',
  'announcements',
  'analytics_reports',
  'messages',
  'org_settings',
  'profile_settings',
]);

const SUPER_TABS = new Set([
  'super_overview',
  'super_approvals',
  'super_organizations',
  'super_users',
  'super_subscriptions',
  'super_listings',
  'analytics_reports',
  'audit_logs',
  'profile_settings',
  'org_users',
]);

const FALLBACK_TABS = new Set(['overview', 'centres', 'units', 'manager_tickets']);

export function tabsForRole(role?: UserRole): Set<string> {
  switch (role) {
    case 'tenant':
      return TENANT_TABS;
    case 'property_manager':
    case 'landlord':
      return MANAGER_TABS;
    case 'maintenance':
      return MAINTENANCE_TABS;
    case 'finance':
      return FINANCE_TABS;
    case 'admin':
      return ADMIN_TABS;
    case 'super_admin':
      return SUPER_TABS;
    default:
      return FALLBACK_TABS;
  }
}

export function defaultTabForRole(role?: UserRole): string {
  switch (role) {
    case 'tenant':
      return 'tenant_overview';
    case 'property_manager':
    case 'landlord':
      return 'manager_overview';
    case 'maintenance':
      return 'maintenance_jobs';
    case 'finance':
      return 'finance_overview';
    case 'admin':
      return 'admin_overview';
    case 'super_admin':
      return 'super_overview';
    default:
      return 'overview';
  }
}

export function isTabAllowed(tab: string, role?: UserRole): boolean {
  return tabsForRole(role).has(tab);
}

/**
 * Guard that fires whenever `tab` or `role` changes. If the tab is not
 * permitted for the role, `onViolation` is called with the safe default.
 * If the tab is permitted, `onViolation` is NOT called.
 *
 * Usage in OperationsApp:
 *   useTabGuard(sidebarActiveTab, currentUser.role, (safe) => setSidebarActiveTab(safe));
 */
export function useTabGuard(
  tab: string,
  role: UserRole | undefined,
  onViolation: (safeTab: string) => void
): void {
  useEffect(() => {
    if (!tab) return;
    if (isTabAllowed(tab, role)) return;
    onViolation(defaultTabForRole(role));
  }, [tab, role, onViolation]);
}
