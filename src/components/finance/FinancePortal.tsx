// src/components/finance/FinancePortal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { auth } from '../../services/auth';
import { FinanceDashboard } from './FinanceDashboard';
import { InvoicesTab } from './InvoicesTab';
import { QuotesOrdersTab } from './QuotesOrdersTab';
import { ItemsRemindersTab } from './ItemsRemindersTab';
import type { ItemsSubTab } from './ItemsRemindersTab';
import { CommercialEngineView } from './CommercialEngineView';

type Tab = 'dashboard' | 'invoices' | 'quotes' | 'items' | 'engine';

interface PortalRoute {
  tab: Tab;
  /** Only meaningful for tab === 'items' */
  itemsSubTab?: ItemsSubTab;
}

/**
 * Maps the sidebar's granular item ids to the coarse tab + optional
 * sub-tab we render.
 *
 *   rent_roll             → invoices
 *   invoices              → invoices
 *   transactions          → items / expenses
 *   expenses_ledger       → items / expenses
 *   financial_requests    → items / requisitions
 *   finance_documents     → invoices
 *   commercial_engine     → engine
 *   quotes / orders       → quotes
 *   items / reminders     → items
 */
function resolveRoute(initialTab?: string): PortalRoute {
  if (!initialTab) return { tab: 'dashboard' };
  switch (initialTab) {
    case 'rent_roll':
    case 'invoices':
    case 'finance_documents':
      return { tab: 'invoices' };
    case 'quotes':
    case 'orders':
      return { tab: 'quotes' };
    case 'transactions':
    case 'expenses_ledger':
      return { tab: 'items', itemsSubTab: 'expenses' };
    case 'financial_requests':
      return { tab: 'items', itemsSubTab: 'requisitions' };
    case 'items':
      return { tab: 'items', itemsSubTab: 'items' };
    case 'reminders':
      return { tab: 'items', itemsSubTab: 'reminders' };
    case 'commercial_engine':
      return { tab: 'engine' };
    default:
      return { tab: 'dashboard' };
  }
}

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'quotes', label: 'Quotes & Orders' },
  { id: 'engine', label: 'Commercial Engine' },
  { id: 'items', label: 'Items, Statements & Reminders' },
];

export const FinancePortal: React.FC<{ initialTab?: string }> = ({
  initialTab,
}) => {
  const org = auth.getCurrentOrganization();

  const initialRoute = useMemo(() => resolveRoute(initialTab), [initialTab]);
  const [tab, setTab] = useState<Tab>(initialRoute.tab);
  const [itemsSubTab, setItemsSubTab] = useState<ItemsSubTab | undefined>(
    initialRoute.itemsSubTab
  );

  // If the parent pushes a new initialTab, follow it.
  useEffect(() => {
    const route = resolveRoute(initialTab);
    setTab(route.tab);
    setItemsSubTab(route.itemsSubTab);
  }, [initialTab]);

  const header = useMemo(
    () => ({
      companyName: org?.company_name ?? '—',
      orgCode: org?.organization_code ?? '—',
    }),
    [org?.company_name, org?.organization_code]
  );

  if (!org) {
    return (
      <div className="p-6 text-slate-500 text-sm">
        No organisation context.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-900 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold px-2 py-0.5 rounded bg-white/20 text-emerald-100 inline-block">
            Commercial finance desk
          </div>
          <h1 className="text-2xl font-bold mt-1">{header.companyName}</h1>
          <p className="text-xs text-emerald-100">
            Invoicing, collections, expenses, and reconciliation
            <span className="ml-2 font-mono opacity-80">
              {header.orgCode}
            </span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 flex-wrap">
        {TAB_LABELS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              // Reset sub-tab hint when leaving the items tab.
              if (t.id !== 'items') setItemsSubTab(undefined);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === t.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <FinanceDashboard />}
      {tab === 'invoices' && <InvoicesTab />}
      {tab === 'quotes' && <QuotesOrdersTab />}
      {tab === 'engine' && <CommercialEngineView />}
      {tab === 'items' && <ItemsRemindersTab initialSubTab={itemsSubTab} />}
    </div>
  );
};
