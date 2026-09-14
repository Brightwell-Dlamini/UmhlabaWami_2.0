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
} from 'lucide-react';
import { UserRole } from '../../types';

interface SidebarProps {
  role?: UserRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenCreateTicket?: () => void;
  organizationName?: string;
  orgCode?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role = 'tenant',
  activeTab,
  onTabChange,
  organizationName,
  orgCode,
  collapsed = false,
  onToggleCollapse,
}) => {
  const getNavItems = () => {
    switch (role) {
      case 'tenant':
        return [
          { id: 'tenant_overview', label: 'My Dashboard', icon: LayoutDashboard },
          { id: 'tenant_tickets', label: 'My Tickets', icon: Ticket },
          { id: 'report_issue', label: 'Report Issue', icon: PlusCircle },
          { id: 'messages', label: 'Messages', icon: MessageSquare },
          { id: 'tenant_documents', label: 'Documents', icon: FileText },
          { id: 'tenant_lease', label: 'My Lease', icon: FileBadge },
          { id: 'profile_settings', label: 'My Profile', icon: User },
        ];
      case 'property_manager':
        return [
          { id: 'manager_overview', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'centre_pulse', label: 'Centre Pulse', icon: Activity },
          { id: 'properties', label: 'Centres & Units', icon: Building },
          { id: 'tenants_list', label: 'Tenants', icon: Users },
          { id: 'manager_tickets', label: 'Tickets', icon: Ticket },
          { id: 'sla_matrix', label: 'SLA Matrix', icon: Shield },
          { id: 'preventive_maintenance', label: 'Preventive Maintenance', icon: CalendarClock },
          { id: 'staff_schedule', label: 'Staff Schedule', icon: Calendar },
          { id: 'vendors', label: 'Vendors', icon: Truck },
          { id: 'announcements', label: 'Announcements', icon: Megaphone },
          { id: 'messages', label: 'Messages', icon: MessageSquare },
          { id: 'analytics_reports', label: 'Reports', icon: BarChart3 },
          { id: 'profile_settings', label: 'My Profile', icon: User },
        ];
      case 'maintenance':
        return [
          { id: 'maintenance_jobs', label: 'My Jobs', icon: Wrench },
          { id: 'maintenance_ops', label: 'Operations', icon: CheckCircle2 },
          { id: 'maintenance_completed', label: 'Completed', icon: CheckCircle2 },
          { id: 'profile_settings', label: 'My Profile', icon: User },
        ];
      case 'finance':
        return [
          { id: 'finance_overview', label: 'Finance Dashboard', icon: DollarSign },
          { id: 'rent_roll', label: 'Rent Roll', icon: Receipt },
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
          { id: 'properties', label: 'Centres & Units', icon: Building },
          { id: 'tenants_list', label: 'Tenants Directory', icon: Users },
          { id: 'org_users', label: 'Staff & Roles', icon: Users },
          { id: 'manager_tickets', label: 'All Tickets', icon: Ticket },
          { id: 'sla_matrix', label: 'SLA Matrix', icon: Shield },
          { id: 'preventive_maintenance', label: 'Preventive Maintenance', icon: CalendarClock },
          { id: 'staff_schedule', label: 'Staff Rostering', icon: Calendar },
          { id: 'finance_overview', label: 'Finances', icon: DollarSign },
          { id: 'commercial_engine', label: 'Commercial Engine', icon: FileText },
          { id: 'announcements', label: 'Announcements', icon: Megaphone },
          { id: 'analytics_reports', label: 'Export Reports', icon: BarChart3 },
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
          { id: 'centre_pulse', label: 'Centre Pulse', icon: Activity },
          { id: 'properties', label: 'Centres & Units', icon: Building },
          { id: 'tenants_list', label: 'Tenants Directory', icon: Users },
          { id: 'manager_tickets', label: 'All Tickets', icon: Ticket },
          { id: 'sla_matrix', label: 'SLA Matrix', icon: Shield },
          { id: 'preventive_maintenance', label: 'Preventive Maintenance', icon: CalendarClock },
          { id: 'staff_schedule', label: 'Staff Rostering', icon: Calendar },
          { id: 'vendors', label: 'Vendors', icon: Truck },
          { id: 'finance_overview', label: 'Finances', icon: DollarSign },
          { id: 'commercial_engine', label: 'Commercial Engine', icon: FileText },
          { id: 'announcements', label: 'Announcements', icon: Megaphone },
          { id: 'messages', label: 'Messages', icon: MessageSquare },
          { id: 'analytics_reports', label: 'Global Analytics', icon: BarChart3 },
          { id: 'audit_logs', label: 'System Audit Trail', icon: History },
          { id: 'db_backup', label: 'Database Backup', icon: Settings },
          { id: 'org_settings', label: 'Org Settings', icon: Settings },
          { id: 'profile_settings', label: 'My Profile', icon: User },
        ];
      default:
        return [
          { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'properties', label: 'Centres & Units', icon: Building },
          { id: 'manager_tickets', label: 'Tickets', icon: Ticket },
        ];
    }
  };

  const navItems = getNavItems() || [];

  return (
    <aside
      className={`relative flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out shrink-0 z-30 ${
        collapsed ? 'w-18' : 'w-64'
      }`}
    >
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start justify-between gap-2">
          <div className={collapsed ? 'hidden' : 'min-w-0'}>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {role === 'super_admin' ? 'Super Admin Console' : organizationName || 'Umhlaba Wami'}
            </div>
            {orgCode && role !== 'super_admin' && (
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">{orgCode}</div>
            )}
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={item.label}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 capitalize">
          Role: {String(role || 'tenant').replace(/_/g, ' ')}
        </div>
      )}
    </aside>
  );
};
