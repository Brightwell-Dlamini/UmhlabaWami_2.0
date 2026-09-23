// src/components/CommandPalette.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Command as CommandIcon,
  Building2,
  Users,
  FileText,
  Ticket as TicketIcon,
  CornerDownLeft,
  History,
  ArrowUpDown,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { auth } from '../services/auth';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fuzzyFilter } from '../hooks/useFuzzySearch';
import { tenants as tenantsApi } from '../services/api/tenants';
import { shops as shopsApi } from '../services/api/shops';
import { shoppingCenters as centersApi } from '../services/api/shoppingCenters';
import { invoices as invoiceApi } from '../services/api/invoices';
import { tickets as ticketsApi } from '../services/api/tickets';
import { Z } from '../constants/zIndex';

interface Props {
  onNavigateTab?: (tab: string) => void;
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

const MAX_RESULTS = 20;

export const CommandPalette: React.FC<Props> = ({
  onNavigateTab,
  onOpenTicket,
}) => {
  const { open, closePalette, togglePalette, recents, pushRecent } =
    useCommandPalette();
  const orgId = auth.getCurrentOrganization()?.id ?? '';
  const user = auth.getCurrentUser();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

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

  const allIndex = useMemo<Map<string, Result>>(() => {
    const role = user?.role ?? 'tenant';
    const allowedNav = NAV_ITEMS.filter(
      (n) => n.roles.includes('*') || n.roles.includes(role)
    );

    const map = new Map<string, Result>();

    for (const n of allowedNav) {
      map.set(`nav:${n.tab}`, {
        id: `nav:${n.tab}`,
        kind: 'nav',
        label: n.label,
        sub: 'Go to',
        tab: n.tab,
        icon: <CommandIcon className="w-3.5 h-3.5" strokeWidth={1.75} />,
      });
    }

    for (const t of tenants) {
      map.set(`tenant:${t.id}`, {
        id: `tenant:${t.id}`,
        kind: 'tenant',
        label: t.business_name,
        sub: `${t.contact_person} · ${t.phone}`,
        tab: 'tenants_list',
        icon: <Users className="w-3.5 h-3.5" strokeWidth={1.75} />,
      });
    }

    for (const s of shops) {
      map.set(`shop:${s.id}`, {
        id: `shop:${s.id}`,
        kind: 'shop',
        label: `Unit ${s.shop_number}`,
        sub: `${s.property_type} · ${s.size_sqm} m²`,
        tab: 'units',
        icon: <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} />,
      });
    }

    for (const c of centers) {
      map.set(`center:${c.id}`, {
        id: `center:${c.id}`,
        kind: 'center',
        label: c.name,
        sub: c.location,
        tab: 'centres',
        icon: <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} />,
      });
    }

    if (user?.role !== 'maintenance') {
      for (const inv of invoices) {
        map.set(`invoice:${inv.id}`, {
          id: `invoice:${inv.id}`,
          kind: 'invoice',
          label: inv.invoice_number,
          sub: `${inv.tenant_name} · E${inv.total.toLocaleString()}`,
          tab: 'invoices',
          icon: <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />,
        });
      }
    }

    for (const t of tickets) {
      map.set(`ticket:${t.id}`, {
        id: `ticket:${t.id}`,
        kind: 'ticket',
        label: `${t.ticket_number} — ${t.title}`,
        sub: `${t.status} · ${t.priority}`,
        ticketId: t.id,
        icon: <TicketIcon className="w-3.5 h-3.5" strokeWidth={1.75} />,
      });
    }

    return map;
  }, [user?.role, tenants, shops, centers, invoices, tickets]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim();

    if (!q) {
      const recentResults: Result[] = [];
      for (const id of recents) {
        const found = allIndex.get(id);
        if (!found) continue;
        recentResults.push({
          ...found,
          id: `recent:${found.id}`,
          sub: found.sub ?? 'Recent',
        });
        if (recentResults.length >= 5) break;
      }

      const navResults = Array.from(allIndex.values()).filter(
        (r) => r.kind === 'nav'
      );

      return [...recentResults, ...navResults].slice(0, MAX_RESULTS);
    }

    const pool = Array.from(allIndex.values());
    return fuzzyFilter(pool, q, (r) => `${r.label} ${r.sub ?? ''}`, MAX_RESULTS);
  }, [query, allIndex, recents]);

  useEffect(() => {
    if (active >= results.length) setActive(0);
  }, [results.length, active]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${active}"]`
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (r: Result) => {
    const canonicalId = r.id.startsWith('recent:') ? r.id.slice(7) : r.id;
    pushRecent(canonicalId);

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
      className={`fixed inset-0 ${Z.modal} flex items-start justify-center pt-[14vh] px-4`}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="fixed inset-0 bg-ink-0/60 backdrop-blur-sm"
        onClick={closePalette}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-[560px] bg-[var(--uw-surface)] rounded-xl shadow-[var(--uw-shadow-panel)] border border-[var(--uw-border)] overflow-hidden animate-modal-in-desktop">
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-3.5 h-11 border-b border-[var(--uw-border)]">
          <Search
            className="w-3.5 h-3.5 text-[var(--uw-text-subtle)] shrink-0"
            strokeWidth={1.75}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search or jump to…"
            className="flex-1 bg-transparent text-[13px] focus:outline-none text-[var(--uw-text)] placeholder:text-[var(--uw-text-subtle)]"
          />
          <kbd className="kbd shrink-0">ESC</kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[400px] overflow-y-auto scrollbar-thin py-1.5"
        >
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="text-[12px] text-[var(--uw-text-subtle)]">
                No results for
              </div>
              <div className="text-[13px] font-medium text-[var(--uw-text)] mt-0.5">
                "{query}"
              </div>
            </div>
          ) : (
            results.map((r, i) => {
              const isActive = i === active;
              const isRecent = r.id.startsWith('recent:');
              return (
                <button
                  key={r.id}
                  data-idx={i}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={`w-full text-left mx-1.5 px-2.5 py-2 rounded-md flex items-center gap-2.5 transition-colors duration-fast ${
                    isActive
                      ? 'bg-[var(--uw-surface-raised)]'
                      : ''
                  }`}
                  style={{ width: 'calc(100% - 12px)' }}
                >
                  <span
                    className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center ${
                      isActive
                        ? 'border-accent-500/30 bg-accent-500/10 text-accent-500'
                        : 'border-[var(--uw-border)] bg-[var(--uw-surface-raised)] text-[var(--uw-text-muted)]'
                    }`}
                  >
                    {isRecent ? (
                      <History className="w-3 h-3" strokeWidth={1.75} />
                    ) : (
                      r.icon
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-[var(--uw-text)] truncate leading-tight">
                      {r.label}
                    </span>
                    {r.sub && (
                      <span className="block text-[11px] text-[var(--uw-text-muted)] truncate leading-tight mt-0.5">
                        {isRecent ? 'Recent · ' : ''}
                        {r.sub}
                      </span>
                    )}
                  </span>
                  {isActive && (
                    <CornerDownLeft
                      className="w-3 h-3 text-[var(--uw-text-subtle)] shrink-0"
                      strokeWidth={1.75}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3.5 h-9 border-t border-[var(--uw-border)] bg-[var(--uw-surface-raised)]">
          <div className="flex items-center gap-3 text-[10px] text-[var(--uw-text-subtle)]">
            <span className="flex items-center gap-1">
              <kbd className="kbd">↑</kbd>
              <kbd className="kbd">↓</kbd>
              <span className="ml-1">navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd">↵</kbd>
              <span className="ml-1">select</span>
            </span>
          </div>
          <span className="text-[10px] text-[var(--uw-text-subtle)] flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3" strokeWidth={1.75} />
            Umhlaba Wami
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(palette, document.body);
};
