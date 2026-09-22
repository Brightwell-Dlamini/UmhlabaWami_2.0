import React from 'react';
import {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  MessageSquare,
  FileText,
  FileBadge,
  User,
  Building,
  Building2,
  Wrench,
  Users,
  Calendar,
  Truck,
  Megaphone,
  BarChart3,
  DollarSign,
  Receipt,
  ArrowDownUp,
  CreditCard,
  Settings,
  ShieldCheck,
  CheckCircle2,
  Layers,
  History,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Activity,
  Shield,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import { UserRole } from '../../types';

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  highlight?: boolean;
  badgeCount?: string;
};

/** Shared menu definition — desktop sidebar and mobile drawer. */
export function getNavItemsForRole(role: UserRole = 'tenant'): NavItem[] {
  switch (role) {
    case 'tenant':
      return [
        { id: 'tenant_overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'tenant_tickets', label: 'My Tickets', icon: Ticket },
        { id: 'report_issue', label: 'Report Issue', icon: PlusCircle, highlight: true },
        { id: 'tenant_finance', label: 'My Finances', icon: DollarSign },
        { id: 'messages', label: 'Messages', icon: MessageSquare },
        { id: 'tenant_documents', label: 'Documents', icon: FileText },
        { id: 'tenant_lease', label: 'My Lease', icon: FileBadge },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
        { id: 'profile_settings', label: 'My Profile', icon: User },
      ];
    case 'property_manager':
    case 'landlord':
      return [
        { id: 'manager_overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'centre_pulse', label: 'Centre Pulse', icon: Activity },
        { id: 'centres', label: 'Centres & Properties', icon: Building2 },
        { id: 'units', label: 'Units & Rent Roll', icon: Building },
        { id: 'manager_tickets', label: 'Tickets & SLAs', icon: Ticket },
        { id: 'sla_matrix', label: 'SLA Matrix', icon: Shield },
        { id: 'preventive_maintenance', label: 'Preventive Maintenance', icon: CalendarClock },
        { id: 'maintenance_ops', label: 'Maintenance Ops', icon: Wrench },
        { id: 'tenants_list', label: 'Tenants', icon: Users },
        { id: 'leases', label: 'Leases & SLAs', icon: FileBadge },
        { id: 'staff_schedule', label: 'Roster & Shifts', icon: Calendar },
        { id: 'vendors', label: 'Vendors', icon: Truck },
        { id: 'finance_overview', label: 'Finances', icon: DollarSign },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
        { id: 'analytics_reports', label: 'Analytics & Reports', icon: BarChart3 },
        { id: 'messages', label: 'Messages', icon: MessageSquare },
        { id: 'profile_settings', label: 'My Profile', icon: User },
      ];
    case 'maintenance':
      return [
        { id: 'maintenance_jobs', label: 'My Jobs', icon: Wrench },
        { id: 'staff_schedule', label: 'My Schedule', icon: Calendar },
        { id: 'maintenance_completed', label: 'Completed Jobs', icon: CheckCircle2 },
        { id: 'messages', label: 'Operations Chat', icon: MessageSquare },
        { id: 'profile_settings', label: 'My Profile', icon: User },
      ];
    case 'finance':
      return [
        { id: 'finance_overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'commercial_engine', label: 'Commercial Engine', icon: FileText },
        { id: 'rent_roll', label: 'Rent Roll', icon: DollarSign },
        { id: 'expenses_ledger', label: 'Expenses Ledger', icon: Receipt },
        { id: 'transactions', label: 'Transactions', icon: ArrowDownUp },
        { id: 'financial_requests', label: 'Petty Cash & Requests', icon: CreditCard },
        { id: 'finance_documents', label: 'Documents', icon: FileText },
        { id: 'analytics_reports', label: 'Financial Reports', icon: BarChart3 },
        { id: 'profile_settings', label: 'My Profile', icon: User },
      ];
    case 'admin':
      return [
        { id: 'admin_overview', label: 'Org Dashboard', icon: LayoutDashboard },
        { id: 'centre_pulse', label: 'Centre Pulse', icon: Activity },
        { id: 'centres', label: 'Centres & Properties', icon: Building2 },
        { id: 'units', label: 'Units & Rent Roll', icon: Building },
        { id: 'tenants_list', label: 'Tenants Directory', icon: Users },
        { id: 'leases', label: 'Leases & SLAs', icon: FileBadge },
        { id: 'org_users', label: 'Staff & Roles', icon: Users },
        { id: 'manager_tickets', label: 'All Tickets', icon: Ticket },
        { id: 'sla_matrix', label: 'SLA Matrix', icon: Shield },
        { id: 'preventive_maintenance', label: 'Preventive Maintenance', icon: CalendarClock },
        { id: 'staff_schedule', label: 'Staff Rostering', icon: Calendar },
        { id: 'vendors', label: 'Vendors', icon: Truck },
        { id: 'finance_overview', label: 'Finances', icon: DollarSign },
        { id: 'commercial_engine', label: 'Commercial Engine', icon: FileText },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
        { id: 'analytics_reports', label: 'Export Reports', icon: BarChart3 },
        { id: 'messages', label: 'Messages', icon: MessageSquare },
        { id: 'org_settings', label: 'Org Settings', icon: Settings },
        { id: 'profile_settings', label: 'My Profile', icon: User },
      ];
    case 'super_admin':
      return [
        { id: 'super_overview', label: 'Platform Dashboard', icon: LayoutDashboard },
        { id: 'super_approvals', label: 'Org Approvals', icon: ShieldCheck, badgeCount: 'Pending' },
        { id: 'super_organizations', label: 'All Organisations', icon: Layers },
        { id: 'super_users', label: 'User Directory', icon: Users },
        { id: 'super_subscriptions', label: 'Subscription Tiers', icon: Sliders },
        { id: 'analytics_reports', label: 'Global Analytics', icon: BarChart3 },
        { id: 'audit_logs', label: 'System Audit Trail', icon: History },
        { id: 'profile_settings', label: 'My Profile', icon: User },
      ];
    default:
      return [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'centres', label: 'Centres & Properties', icon: Building2 },
        { id: 'units', label: 'Units & Rent Roll', icon: Building },
        { id: 'manager_tickets', label: 'Tickets', icon: Ticket },
      ];
  }
}

interface SidebarProps {
  role?: UserRole;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  organizationName?: string;
  orgCode?: string;
  organizationLogo?: string | null;
  onOpenCreateTicket?: () => void;
  /** Full-width list for mobile slide-over (no collapse control). */
  mobile?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role = 'tenant',
  activeTab,
  onTabChange,
  collapsed = false,
  onToggleCollapse,
  organizationName,
  orgCode,
  organizationLogo,
  mobile = false,
}) => {
  const navItems = getNavItemsForRole(role);
  const isCollapsed = mobile ? false : collapsed;

  const navList = (
    <nav
      className={`flex-1 overflow-y-auto scrollbar-thin py-2 px-2 space-y-0.5 ${
        mobile ? 'pb-8' : ''
      }`}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-2.5 px-2.5 rounded-md text-[13px] font-medium transition-all duration-fast group relative min-h-[32px]
              ${
                isActive
                  ? 'bg-accent-500/10 text-accent-500 dark:bg-accent-500/15 dark:text-accent-400'
                  : item.highlight
                    ? 'text-accent-500 hover:bg-accent-500/8 dark:text-accent-400 dark:hover:bg-accent-500/10'
                    : 'text-[var(--uw-text-muted)] hover:text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)]'
              }
              ${mobile ? 'min-h-[40px] py-2' : ''}
            `}
            title={isCollapsed ? item.label : undefined}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-accent-500"
              />
            )}
            <Icon
              className={`w-4 h-4 shrink-0 transition-colors ${
                isActive
                  ? 'text-accent-500 dark:text-accent-400'
                  : item.highlight
                    ? 'text-accent-500 dark:text-accent-400'
                    : 'text-[var(--uw-text-subtle)] group-hover:text-[var(--uw-text-muted)]'
              }`}
              strokeWidth={1.75}
            />
            {!isCollapsed && (
              <span className="truncate flex-1 text-left">{item.label}</span>
            )}
            {!isCollapsed && item.badgeCount && (
              <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-warning-500/15 text-warning-400 border border-warning-500/25">
                {item.badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  if (mobile) {
    return (
      <div className="flex flex-col h-full bg-[var(--uw-surface)]">
        <div className="px-3 py-3 border-b border-[var(--uw-border)] flex items-center gap-2.5">
          {organizationLogo && role !== 'super_admin' ? (
            <img
              src={organizationLogo}
              alt=""
              className="h-8 w-8 rounded-md object-contain border border-[var(--uw-border)] bg-white shrink-0"
            />
          ) : (
            <div className="h-8 w-8 rounded-md bg-accent-500/12 border border-accent-500/25 flex items-center justify-center text-accent-500 shrink-0">
              <Shield className="w-4 h-4" strokeWidth={1.75} />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[var(--uw-text)] truncate">
              {role === 'super_admin'
                ? 'Super Admin'
                : organizationName || 'Umhlaba Wami'}
            </div>
            {orgCode && role !== 'super_admin' && (
              <div className="text-[10px] font-mono text-[var(--uw-text-subtle)]">
                {orgCode}
              </div>
            )}
          </div>
        </div>
        {navList}
        <div className="px-3 py-2.5 border-t border-[var(--uw-border)]">
          <div className="text-[10px] font-medium text-[var(--uw-text-subtle)] uppercase tracking-wider">
            {String(role || 'tenant').replace(/_/g, ' ')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside
      className={`relative flex flex-col bg-[var(--uw-surface)] border-r border-[var(--uw-border)] transition-[width] duration-normal ease-standard shrink-0 z-30 h-full
        ${isCollapsed ? 'w-[56px]' : 'w-[220px]'}
      `}
    >
      <div className="px-3 py-3 border-b border-[var(--uw-border)] flex items-center justify-between min-h-[52px]">
        {!isCollapsed && (
          <div className="min-w-0 flex items-center gap-2.5">
            {organizationLogo && role !== 'super_admin' ? (
              <img
                src={organizationLogo}
                alt=""
                className="h-7 w-7 rounded-md object-contain border border-[var(--uw-border)] bg-white shrink-0"
              />
            ) : (
              <div className="h-7 w-7 rounded-md bg-accent-500/12 border border-accent-500/25 flex items-center justify-center text-accent-500 shrink-0">
                <Shield className="w-3.5 h-3.5" strokeWidth={1.75} />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[var(--uw-text)] leading-tight truncate">
                {role === 'super_admin'
                  ? 'Super Admin'
                  : organizationName || 'Umhlaba Wami'}
              </div>
              {orgCode && role !== 'super_admin' && (
                <div className="text-[10px] font-mono text-[var(--uw-text-subtle)] leading-tight truncate">
                  {orgCode}
                </div>
              )}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-md text-[var(--uw-text-subtle)] hover:text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] transition-colors duration-fast shrink-0
            ${isCollapsed ? 'mx-auto' : ''}
          `}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
          )}
        </button>
      </div>

      {navList}

      {!isCollapsed && (
        <div className="px-3 py-2.5 border-t border-[var(--uw-border)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-[var(--uw-text-subtle)] uppercase tracking-wider">
              {String(role || 'tenant').replace(/_/g, ' ')}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-success-500 shadow-[0_0_0_3px_rgba(62,207,142,0.15)]" />
          </div>
        </div>
      )}
    </aside>
  );
};
