import React, { useState } from 'react';
import { FinanceDashboard } from './FinanceDashboard';
import { InvoicesTab } from './InvoicesTab';
import { QuotesOrdersTab } from './QuotesOrdersTab';
import { ItemsRemindersTab } from './ItemsRemindersTab';

type Tab = 'dashboard' | 'invoices' | 'quotes' | 'items';

export const FinancePortal: React.FC<{ initialTab?: string }> = ({ initialTab }) => {
  const [tab, setTab] = useState<Tab>(() => {
    if (initialTab === 'rent_roll' || initialTab === 'invoices') return 'invoices';
    if (initialTab === 'quotes' || initialTab === 'orders') return 'quotes';
    if (initialTab === 'items' || initialTab === 'reminders') return 'items';
    return 'dashboard';
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-2 border-b pb-2 flex-wrap">
        {([
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'invoices', label: 'Invoices' },
          { id: 'quotes', label: 'Quotes & Orders' },
          { id: 'items', label: 'Items & Reminders' },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
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
