// src/components/CommandPalette.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Command as CommandIcon,
  Building2,
  Users,
  FileText,
  Ticket as TicketIcon,
  ArrowRight,
  CornerDownLeft,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { auth } from '../services/auth';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { tenants as tenantsApi } from '../services/api/tenants';
import { shops as shopsApi } from '../services/api/shops';
import { shoppingCenters as centersApi } from '../services/api/shoppingCenters';
import { invoices as invoiceApi } from '../services/api/invoices';
import { tickets as ticketsApi } from '../services/api/tickets';
import { Z } from '../constants/zIndex';

interface Props {
  /** Called when the user picks a nav target — the parent switches tab. */
  onNavigateTab?: (tab: string) => void;
  /** Called when the user picks a ticket — the parent opens the detail modal. */
  onOpenTicket?: (id: string) => void;
}

type Kind = 'nav' | 'tenant' | 'shop' | 'center' | 'invoice' | 'ticket';

interface Result {
  id: string;
  kind: Kind;
  label: string;
  sub?: string;
  tab?: string;
  ticketId?: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: { tab: string; label: string; roles: string[] }[] = [
  { tab: 'tenant_overview', label: 'Dashboard', roles: ['tenant'] },
  { tab: 'tenant_tickets', label: 'My Tickets', roles: ['tenant'] },
  { tab: 'tenant_finance', label: 'My Finances', roles: ['tenant'] },
  { tab: 'tenant_documents', label: 'Documents', roles: ['tenant'] },
  { tab: 'tenant_lease', label: 'My Lease', roles: ['tenant'] },
  { tab: 'manager_overview', label: 'Dashboard', roles: ['property_manager', 'landlord'] },
  { tab: 'centre_pulse', label: 'Centre Pulse', roles: ['property_manager', 'admin', 'landlord'] },
  { tab: 'centres', label: 'Centres & Properties', roles: ['property_manager', 'admin', 'landlord'] },
  { tab: 'units', label: 'Units & Rent Roll', roles: ['property_manager', 'admin', 'landlord'] },
  { tab: 'manager_tickets', label: 'All Tickets', roles: ['property_manager', 'admin', 'landlord'] },
  { tab: 'tenants_list', label: 'Tenants Directory', roles: ['property_manager', 'admin', 'landlord'] },
  { tab: 'leases', label: 'Leases', roles: ['property_manager', 'admin', 'landlord'] },
  { tab: 'vendors', label: 'Vendors', roles: ['property_manager', 'admin', 'landlord'] },
  { tab: 'analytics_reports', label: 'Analytics & Reports', roles: ['property_manager', 'admin', 'finance'] },
  { tab: 'finance_overview', label: 'Finance Dashboard', roles: ['finance', 'admin', 'property_manager'] },
  { tab: 'commercial_engine', label: 'Commercial Engine', roles: ['finance', 'admin'] },
  { tab: 'rent_roll', label: 'Rent Roll', roles: ['finance', 'admin'] },
  { tab: 'expenses_ledger', label: 'Expenses Ledger', roles: ['finance', 'admin'] },
  { tab: 'financial_requests', label: 'Petty Cash & Requests', roles: ['finance', 'admin'] },
  { tab: 'org_users', label: 'Staff & Roles', roles: ['admin'] },
  { tab: 'org_settings', label: 'Org Settings', roles: ['admin'] },
  { tab: 'super_approvals', label: 'Org Approvals', roles: ['super_admin'] },
  { tab: 'super_organizations', label: 'All Organisations', roles: ['super_admin'] },
  { tab: 'super_users', label: 'User Directory', roles: ['super_admin'] },
  { tab: 'super_subscriptions', label: 'Subscription Tiers', roles: ['super_admin'] },
  { tab: 'audit_logs', label: 'Audit Trail', roles: ['super_admin'] },
  { tab: 'profile_settings', label: 'My Profile', roles: ['*'] },
];

export const CommandPalette: React.FC<Props> = ({ onNavigateTab, onOpenTicket }) => {
  const { open, closePalette, togglePalette } = useCommandPalette();
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const user = auth.getCurrentUser();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePalette();
      }
      if (e.key === 'Escape' && open) {
        closePalette();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, togglePalette, closePalette]);

  // Autofocus on open
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset query when closed
  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  // Data (only fetched when the palette is open and the user has an org)
  const enabled = open && !!orgId;
  const { data: tenants = [] } = useSupabaseQuery(
    ['tenants', orgId],
    () => tenantsApi.list(),
    { enabled }
  );
  const { data: shops = [] } = useSupabaseQuery(
    ['shops', orgId],
    () => shopsApi.list(),
    { enabled }
  );
  const { data: centers = [] } = useSupabaseQuery(
    ['centers', orgId],
    () => centersApi.list(),
    { enabled }
  );
  const { data: invoices = [] } = useSupabaseQuery(
    ['invoices', orgId],
    () => invoiceApi.list(),
    { enabled: enabled && user?.role !== 'maintenance' }
  );
  const { data: tickets = [] } = useSupabaseQuery(
    ['tickets', 'lite', orgId],
    () => ticketsApi.listLite(),
    { enabled }
  );

  const results = useMemo<Result[]>(() => {
    const role = user?.role ?? 'tenant';
    const allowedNav = NAV_ITEMS.filter(
      (n) => n.roles.includes('*') || n.roles.includes(role)
    );

    const q = query.trim().toLowerCase();

    // Empty query → show nav only.
    if (!q) {
      return allowedNav.map((n) => ({
        id: `nav:${n.tab}`,
        kind: 'nav',
        label: n.label,
        sub: 'Go to',
        tab: n.tab,
        icon: <CommandIcon className="w-4 h-4 text-slate-500" />,
      }));
    }

    const out: Result[] = [];

    // Nav matches
    for (const n of allowedNav) {
      if (n.label.toLowerCase().includes(q)) {
        out.push({
          id: `nav:${n.tab}`,
          kind: 'nav',
          label: n.label,
          sub: 'Go to',
          tab: n.tab,
          icon: <CommandIcon className="w-4 h-4 text-slate-500" />,
        });
      }
    }

    // Tenants
    for (const t of tenants) {
      if (out.length > 40) break;
      if (
        t.business_name.toLowerCase().includes(q) ||
        t.contact_person.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q)
      ) {
        out.push({
          id: `tenant:${t.id}`,
          kind: 'tenant',
          label: t.business_name,
          sub: `${t.contact_person} · ${t.phone}`,
          tab: 'tenants_list',
          icon: <Users className="w-4 h-4 text-emerald-600" />,
        });
      }
    }

    // Units
    for (const s of shops) {
      if (out.length > 60) break;
      if (s.shop_number.toLowerCase().includes(q)) {
        out.push({
          id: `shop:${s.id}`,
          kind: 'shop',
          label: `Unit ${s.shop_number}`,
          sub: `${s.property_type} · ${s.size_sqm} m²`,
          tab: 'units',
          icon: <Building2 className="w-4 h-4 text-blue-600" />,
        });
      }
    }

    // Centres
    for (const c of centers) {
      if (out.length > 70) break;
      if (c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q)) {
        out.push({
          id: `center:${c.id}`,
          kind: 'center',
          label: c.name,
          sub: c.location,
          tab: 'centres',
          icon: <Building2 className="w-4 h-4 text-indigo-600" />,
        });
      }
    }

    // Invoices
    if (user?.role !== 'maintenance') {
      for (const inv of invoices) {
        if (out.length > 90) break;
        if (
          inv.invoice_number.toLowerCase().includes(q) ||
          inv.tenant_name.toLowerCase().includes(q)
        ) {
          out.push({
            id: `invoice:${inv.id}`,
            kind: 'invoice',
            label: inv.invoice_number,
            sub: `${inv.tenant_name} · E${inv.total.toLocaleString()}`,
            tab: 'invoices',
            icon: <FileText className="w-4 h-4 text-amber-600" />,
          });
        }
      }
    }

    // Tickets
    for (const t of tickets) {
      if (out.length > 110) break;
      if (
        t.ticket_number.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q)
      ) {
        out.push({
          id: `ticket:${t.id}`,
          kind: 'ticket',
          label: `${t.ticket_number} — ${t.title}`,
          sub: `${t.status} · ${t.priority}`,
          ticketId: t.id,
          icon: <TicketIcon className="w-4 h-4 text-red-600" />,
        });
      }
    }

    return out.slice(0, 20);
  }, [query, user?.role, tenants, shops, centers, invoices, tickets]);

  // Keep active index in range.
  useEffect(() => {
    if (active >= results.length) setActive(0);
  }, [results.length, active]);

  // Scroll the active item into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (r: Result) => {
    if (r.kind === 'ticket' && r.ticketId) {
      onOpenTicket?.(r.ticketId);
    } else if (r.tab) {
      onNavigateTab?.(r.tab);
    }
    closePalette();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  };

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const palette = (
    <div
      className={`fixed inset-0 ${Z.modal} flex items-start justify-center pt-24 px-4`}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={closePalette}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search tenants, units, invoices, tickets, or type a page name…"
            className="flex-1 bg-transparent text-sm focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          <kbd className="hidden sm:inline text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
        >
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              No matches for "{query}"
            </div>
          ) : (
            results.map((r, i) => {
              const isActive = i === active;
              return (
                <button
                  key={r.id}
                  data-idx={i}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="shrink-0">{r.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {r.label}
                    </span>
                    {r.sub && (
                      <span className="block text-[11px] text-slate-500 truncate">
                        {r.sub}
                      </span>
                    )}
                  </span>
                  {isActive && (
                    <CornerDownLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono">
                ↵
              </kbd>
              select
            </span>
          </div>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
            Umhlaba Wami Command
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(palette, document.body);
};
