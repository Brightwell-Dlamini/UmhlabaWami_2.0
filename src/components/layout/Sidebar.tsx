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
    <div className={`flex-1 overflow-y-auto py-3 px-2.5 space-y-1 ${mobile ? 'pb-8' : ''}`}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-3 sm:py-2.5 rounded-xl text-sm sm:text-xs font-medium transition-all group relative min-h-[44px] sm:min-h-0 ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20 font-semibold'
                : item.highlight
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
            title={isCollapsed ? item.label : undefined}
          >
            <Icon
              className={`w-5 h-5 sm:w-4 sm:h-4 shrink-0 ${
                isActive
                  ? 'text-white'
                  : item.highlight
                  ? 'text-blue-600'
                  : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
              }`}
            />
            {!isCollapsed && <span className="truncate">{item.label}</span>}
            {!isCollapsed && item.badgeCount && (
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                {item.badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  if (mobile) {
    return (
      <nav className="flex flex-col h-full bg-white dark:bg-slate-900" aria-label="Main menu">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          {organizationLogo && role !== 'super_admin' && (
            <img
              src={organizationLogo}
              alt=""
              className="h-9 w-9 rounded-lg object-contain border border-slate-200 dark:border-slate-700 bg-white shrink-0"
            />
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {role === 'super_admin' ? 'Super Admin' : organizationName || 'Umhlaba Wami'}
            </h2>
            {orgCode && role !== 'super_admin' && (
              <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400">Code: {orgCode}</p>
            )}
          </div>
        </div>
        {navList}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
          <span className="font-medium text-slate-600 dark:text-slate-300 capitalize">
            {String(role || 'tenant').replace(/_/g, ' ')}
          </span>
        </div>
      </nav>
    );
  }

  return (
    <aside
      className={`relative flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out shrink-0 z-30 h-full ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        {!isCollapsed && (
          <div className="min-w-0 pr-2 flex items-center gap-2">
            {organizationLogo && role !== 'super_admin' && (
              <img
                src={organizationLogo}
                alt=""
                className="h-8 w-8 rounded-lg object-contain border border-slate-200 dark:border-slate-700 bg-white shrink-0"
              />
            )}
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider truncate">
                {role === 'super_admin' ? 'Super Admin Console' : organizationName || 'Umhlaba Wami'}
              </h2>
              {orgCode && role !== 'super_admin' && (
                <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400 truncate">
                  Code: {orgCode}
                </p>
              )}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition mx-auto"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {navList}

      {!isCollapsed && (
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[11px] text-slate-500">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-600 dark:text-slate-300 capitalize">
              {String(role || 'tenant').replace(/_/g, ' ')}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900 animate-pulse" />
          </div>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">
            {role === 'super_admin' ? 'Platform governance' : 'Commercial property operations'}
          </p>
        </div>
      )}
    </aside>
  );
};
