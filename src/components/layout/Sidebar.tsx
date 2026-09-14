import React, { useMemo, useState } from 'react';
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
  ChevronDown,
  Activity,
  Shield,
  CalendarClock,
  Search,
  Database,
} from 'lucide-react';
import { UserRole } from '../../types';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badgeCount?: string | number;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

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

function sectionsForRole(role: UserRole): NavSection[] {
  switch (role) {
    case 'tenant':
      return [
        {
          id: 'home',
          label: 'My space',
          defaultOpen: true,
          items: [
            { id: 'tenant_overview', label: 'My Dashboard', icon: LayoutDashboard },
            { id: 'tenant_tickets', label: 'My Tickets', icon: Ticket },
            { id: 'report_issue', label: 'Report Issue', icon: PlusCircle },
            { id: 'messages', label: 'Messages', icon: MessageSquare },
            { id: 'tenant_documents', label: 'Documents', icon: FileText },
            { id: 'tenant_lease', label: 'My Lease', icon: FileBadge },
            { id: 'profile_settings', label: 'My Profile', icon: User },
          ],
        },
      ];
    case 'property_manager':
      return [
        {
          id: 'ops',
          label: 'Operations',
          defaultOpen: true,
          items: [
            { id: 'manager_overview', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'centre_pulse', label: 'Centre Pulse', icon: Activity },
            { id: 'properties', label: 'Centres & Units', icon: Building },
            { id: 'tenants_list', label: 'Tenants', icon: Users },
            { id: 'manager_tickets', label: 'Tickets', icon: Ticket },
            { id: 'sla_matrix', label: 'SLA Matrix', icon: Shield },
            { id: 'preventive_maintenance', label: 'Preventive Maintenance', icon: CalendarClock },
          ],
        },
        {
          id: 'people',
          label: 'People & comms',
          defaultOpen: false,
          items: [
            { id: 'staff_schedule', label: 'Staff Schedule', icon: Calendar },
            { id: 'vendors', label: 'Vendors', icon: Truck },
            { id: 'announcements', label: 'Announcements', icon: Megaphone },
            { id: 'messages', label: 'Messages', icon: MessageSquare },
          ],
        },
        {
          id: 'insights',
          label: 'Insights',
          defaultOpen: false,
          items: [
            { id: 'analytics_reports', label: 'Reports', icon: BarChart3 },
            { id: 'profile_settings', label: 'My Profile', icon: User },
          ],
        },
      ];
    case 'maintenance':
      return [
        {
          id: 'jobs',
          label: 'My work',
          defaultOpen: true,
          items: [
            { id: 'maintenance_jobs', label: 'My Jobs', icon: Wrench },
            { id: 'maintenance_completed', label: 'Completed', icon: CheckCircle2 },
            { id: 'profile_settings', label: 'My Profile', icon: User },
          ],
        },
      ];
    case 'finance':
      return [
        {
          id: 'finance',
          label: 'Finance',
          defaultOpen: true,
          items: [
            { id: 'finance_overview', label: 'Finance Dashboard', icon: DollarSign },
            { id: 'rent_roll', label: 'Rent Roll', icon: Receipt },
            { id: 'transactions', label: 'Transactions', icon: ArrowDownUp },
            { id: 'financial_requests', label: 'Petty Cash & Requests', icon: CreditCard },
            { id: 'finance_documents', label: 'Documents', icon: FileText },
            { id: 'analytics_reports', label: 'Financial Reports', icon: BarChart3 },
            { id: 'profile_settings', label: 'My Profile', icon: User },
          ],
        },
      ];
    case 'admin':
      return [
        {
          id: 'ops',
          label: 'Operations',
          defaultOpen: true,
          items: [
            { id: 'admin_overview', label: 'Org Dashboard', icon: LayoutDashboard },
            { id: 'centre_pulse', label: 'Centre Pulse', icon: Activity },
            { id: 'properties', label: 'Centres & Units', icon: Building },
            { id: 'tenants_list', label: 'Tenants Directory', icon: Users },
            { id: 'manager_tickets', label: 'All Tickets', icon: Ticket },
            { id: 'sla_matrix', label: 'SLA Matrix', icon: Shield },
            { id: 'preventive_maintenance', label: 'Preventive Maintenance', icon: CalendarClock },
          ],
        },
        {
          id: 'people',
          label: 'People',
          defaultOpen: false,
          items: [
            { id: 'org_users', label: 'Staff & Roles', icon: Users },
            { id: 'staff_schedule', label: 'Staff Rostering', icon: Calendar },
            { id: 'announcements', label: 'Announcements', icon: Megaphone },
          ],
        },
        {
          id: 'money',
          label: 'Finance',
          defaultOpen: false,
          items: [
            { id: 'finance_overview', label: 'Finances', icon: DollarSign },
            { id: 'commercial_engine', label: 'Commercial Engine', icon: FileText },
            { id: 'analytics_reports', label: 'Export Reports', icon: BarChart3 },
          ],
        },
        {
          id: 'settings',
          label: 'Settings',
          defaultOpen: false,
          items: [
            { id: 'org_settings', label: 'Org Settings', icon: Settings },
            { id: 'profile_settings', label: 'My Profile', icon: User },
          ],
        },
      ];
    case 'super_admin':
      return [
        {
          id: 'platform',
          label: 'Platform',
          defaultOpen: true,
          items: [
            { id: 'super_overview', label: 'Platform Dashboard', icon: LayoutDashboard },
            { id: 'super_approvals', label: 'Org Approvals', icon: ShieldCheck },
            { id: 'super_organizations', label: 'All Organisations', icon: Layers },
            { id: 'super_users', label: 'User Directory', icon: Users },
            { id: 'super_subscriptions', label: 'Subscription Tiers', icon: Sliders },
          ],
        },
        {
          id: 'ops',
          label: 'Operations',
          defaultOpen: false,
          items: [
            { id: 'centre_pulse', label: 'Centre Pulse', icon: Activity },
            { id: 'properties', label: 'Centres & Units', icon: Building },
            { id: 'tenants_list', label: 'Tenants Directory', icon: Users },
            { id: 'manager_tickets', label: 'All Tickets', icon: Ticket },
            { id: 'sla_matrix', label: 'SLA Matrix', icon: Shield },
            { id: 'preventive_maintenance', label: 'Preventive Maintenance', icon: CalendarClock },
            { id: 'staff_schedule', label: 'Staff Rostering', icon: Calendar },
            { id: 'vendors', label: 'Vendors', icon: Truck },
          ],
        },
        {
          id: 'money',
          label: 'Finance',
          defaultOpen: false,
          items: [
            { id: 'finance_overview', label: 'Finances', icon: DollarSign },
            { id: 'commercial_engine', label: 'Commercial Engine', icon: FileText },
            { id: 'announcements', label: 'Announcements', icon: Megaphone },
            { id: 'messages', label: 'Messages', icon: MessageSquare },
            { id: 'analytics_reports', label: 'Global Analytics', icon: BarChart3 },
          ],
        },
        {
          id: 'system',
          label: 'System',
          defaultOpen: false,
          items: [
            { id: 'audit_logs', label: 'System Audit Trail', icon: History },
            { id: 'db_backup', label: 'Database Backup', icon: Database },
            { id: 'org_settings', label: 'Org Settings', icon: Settings },
            { id: 'profile_settings', label: 'My Profile', icon: User },
          ],
        },
      ];
    default:
      return [
        {
          id: 'main',
          label: 'Menu',
          defaultOpen: true,
          items: [
            { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'properties', label: 'Centres & Units', icon: Building },
            { id: 'manager_tickets', label: 'Tickets', icon: Ticket },
          ],
        },
      ];
  }
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
  const sections = useMemo(() => sectionsForRole(role), [role]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    sections.forEach((s) => {
      init[s.id] = s.defaultOpen ?? true;
    });
    return init;
  });

  const [query, setQuery] = useState('');

  React.useEffect(() => {
    for (const s of sections) {
      if (s.items.some((i) => i.id === activeTab)) {
        setOpenSections((prev) => ({ ...prev, [s.id]: true }));
        break;
      }
    }
  }, [activeTab, sections]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (i) =>
            i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [sections, query]);

  const isSearching = query.trim().length > 0;

  return (
    <aside
      className={`relative flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out shrink-0 z-30 h-full max-h-[calc(100vh-4rem)] sticky top-16 ${
        collapsed ? 'w-[4.5rem]' : 'w-64'
      }`}
    >
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className={collapsed ? 'hidden' : 'min-w-0'}>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {role === 'super_admin' ? 'Super Admin' : organizationName || 'Umhlaba Wami'}
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

        {!collapsed && (
          <div className="relative mt-2.5">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter menu\u2026"
              className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
        {filtered.map((section) => {
          const isOpen = isSearching || openSections[section.id];
          return (
            <div key={section.id} className="mb-0.5">
              {!collapsed && sections.length > 1 && (
                <button
                  type="button"
                  onClick={() => !isSearching && toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span>{section.label}</span>
                  {!isSearching && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                    />
                  )}
                </button>
              )}

              {(collapsed || isOpen) && (
                <div className={`space-y-0.5 ${!collapsed && sections.length > 1 ? 'mt-0.5' : ''}`}>
                  {section.items.map((item) => {
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
                        {!collapsed && (
                          <>
                            <span className="truncate flex-1 text-left">{item.label}</span>
                            {item.badgeCount != null && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                  active
                                    ? 'bg-white/20 text-white'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                }`}
                              >
                                {item.badgeCount}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-[11px] text-slate-400">No matches</div>
        )}
      </nav>

      {!collapsed && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 capitalize shrink-0">
          Role: {String(role || 'tenant').replace(/_/g, ' ')}
        </div>
      )}
    </aside>
  );
};
