import React, { useMemo, useState } from 'react';
import { auth } from '../../services/auth';
import { FinanceDashboard } from './FinanceDashboard';
import { InvoicesTab } from './InvoicesTab';
import { QuotesOrdersTab } from './QuotesOrdersTab';
import { ItemsRemindersTab } from './ItemsRemindersTab';

type Tab = 'dashboard' | 'invoices' | 'quotes' | 'items';

/**
 * Maps the sidebar's granular item ids to the coarse tab we render.
 * Sidebar has: rent_roll, invoices, transactions, quotes, orders,
 * commercial_engine, items, reminders, expenses_ledger, financial_requests.
 */
function resolveInitialTab(initialTab?: string): Tab {
  if (!initialTab) return 'dashboard';
  switch (initialTab) {
    case 'rent_roll':
    case 'invoices':
    case 'transactions':
      return 'invoices';
    case 'quotes':
    case 'orders':
    case 'commercial_engine':
      return 'quotes';
    case 'items':
    case 'reminders':
    case 'expenses_ledger':
    case 'financial_requests':
      return 'items';
    default:
      return 'dashboard';
  }
}

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'quotes', label: 'Quotes & Orders' },
  { id: 'items', label: 'Items, Statements & Reminders' },
];

export const FinancePortal: React.FC<{ initialTab?: string }> = ({
  initialTab,
}) => {
  const org = auth.getCurrentOrganization();
  const [tab, setTab] = useState<Tab>(() => resolveInitialTab(initialTab));

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
            <span className="ml-2 font-mono opacity-80">{header.orgCode}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 flex-wrap">
        {TAB_LABELS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
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
      {tab === 'items' && <ItemsRemindersTab />}
    </div>
  );
};
