// src/components/finance/calculators.test.ts
import { describe, it, expect } from 'vitest';
import {
  daysBetween,
  calculateInvoiceTotals,
  calculateAgingBuckets,
  selectOverdueInvoices,
  suggestedReminderType,
  calculateTransactionTotals,
  selectRecentTransactions,
} from './calculators';
import type { Invoice, FinanceTransaction } from '../../types';

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    organization_id: 'org-1',
    invoice_number: 'INV-202509-0001',
    type: 'Rent',
    tenant_id: 'ten-1',
    tenant_name: 'Test Tenant',
    issue_date: '2025-09-01',
    due_date: '2025-09-08',
    status: 'Sent',
    currency: 'SZL',
    subtotal: 1000,
    tax_amount: 150,
    total: 1150,
    amount_paid: 0,
    lines: [],
    created_at: '2025-09-01T00:00:00Z',
    ...overrides,
  };
}

function makeTx(overrides: Partial<FinanceTransaction> = {}): FinanceTransaction {
  return {
    id: 'tx-1',
    organization_id: 'org-1',
    property_id: 'prop-1',
    type: 'Rent Collection',
    amount: 1000,
    direction: 'income',
    description: 'Payment',
    reference: 'REF-1',
    date: '2025-09-15',
    status: 'Paid',
    reconciled: true,
    ...overrides,
  };
}

describe('daysBetween', () => {
  it('returns 0 for same-day', () => {
    expect(daysBetween('2025-09-01', '2025-09-01')).toBe(0);
  });

  it('returns positive when to > from', () => {
    expect(daysBetween('2025-09-01', '2025-09-11')).toBe(10);
  });

  it('returns negative when to < from', () => {
    expect(daysBetween('2025-09-11', '2025-09-01')).toBe(-10);
  });

  it('ignores time-of-day', () => {
    expect(daysBetween('2025-09-01T23:59:00Z', '2025-09-02T00:01:00Z')).toBe(1);
  });

  it('crosses a month boundary', () => {
    expect(daysBetween('2025-09-28', '2025-10-03')).toBe(5);
  });
});

describe('calculateInvoiceTotals', () => {
  it('returns zeros for no invoices', () => {
    const t = calculateInvoiceTotals([]);
    expect(t).toEqual({
      totalInvoiced: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      invoiceCount: 0,
      unpaidCount: 0,
      collectionRate: 0,
    });
  });

  it('excludes Paid and Cancelled from unpaid count', () => {
    const t = calculateInvoiceTotals([
      makeInvoice({ status: 'Paid', amount_paid: 1150 }),
      makeInvoice({ id: 'inv-2', status: 'Cancelled' }),
      makeInvoice({ id: 'inv-3', status: 'Sent' }),
      makeInvoice({ id: 'inv-4', status: 'Overdue' }),
    ]);
    expect(t.unpaidCount).toBe(2);
  });

  it('computes a rounded collection rate', () => {
    const t = calculateInvoiceTotals([
      makeInvoice({ total: 1000, amount_paid: 333 }),
      makeInvoice({ id: 'inv-2', total: 1000, amount_paid: 0 }),
    ]);
    expect(t.collectionRate).toBe(17); // 333/2000 = 16.65 → 17
  });

  it('never reports negative outstanding', () => {
    const t = calculateInvoiceTotals([
      makeInvoice({ total: 100, amount_paid: 200 }),
    ]);
    expect(t.totalOutstanding).toBe(0);
  });
});

describe('calculateAgingBuckets', () => {
  const today = new Date('2025-09-30T00:00:00Z');

  it('buckets current (not yet due)', () => {
    const b = calculateAgingBuckets(
      [makeInvoice({ due_date: '2025-10-05', total: 500, amount_paid: 0 })],
      today
    );
    expect(b.current).toBe(500);
    expect(b.d30).toBe(0);
  });

  it('buckets 1–30 / 31–60 / 61–90 / 91+', () => {
    const b = calculateAgingBuckets(
      [
        makeInvoice({ id: 'a', due_date: '2025-09-29', total: 100, amount_paid: 0 }), // 1 day
        makeInvoice({ id: 'b', due_date: '2025-08-31', total: 200, amount_paid: 0 }), // 30 days
        makeInvoice({ id: 'c', due_date: '2025-08-01', total: 300, amount_paid: 0 }), // 60 days
        makeInvoice({ id: 'd', due_date: '2025-07-01', total: 400, amount_paid: 0 }), // 91 days
      ],
      today
    );
    expect(b.d30).toBe(300); // a + b
    expect(b.d60).toBe(300);
    expect(b.d90).toBe(0);
    expect(b.older).toBe(400);
  });

  it('excludes Paid and Cancelled', () => {
    const b = calculateAgingBuckets(
      [
        makeInvoice({ due_date: '2025-09-01', total: 100, amount_paid: 0, status: 'Paid' }),
        makeInvoice({ id: 'x', due_date: '2025-09-01', total: 100, amount_paid: 0, status: 'Cancelled' }),
      ],
      today
    );
    expect(b.d30 + b.d60 + b.d90 + b.older + b.current).toBe(0);
  });

  it('skips invoices with zero outstanding', () => {
    const b = calculateAgingBuckets(
      [makeInvoice({ due_date: '2025-09-01', total: 100, amount_paid: 100 })],
      today
    );
    expect(b.current).toBe(0);
    expect(b.d30).toBe(0);
  });
});

describe('selectOverdueInvoices', () => {
  it('returns invoices only strictly past due, most overdue first', () => {
    const today = new Date('2025-09-30T00:00:00Z');
    const out = selectOverdueInvoices(
      [
        makeInvoice({ id: 'today', due_date: '2025-09-30', total: 100, amount_paid: 0 }),
        makeInvoice({ id: 'yesterday', due_date: '2025-09-29', total: 100, amount_paid: 0 }),
        makeInvoice({ id: 'lastweek', due_date: '2025-09-23', total: 100, amount_paid: 0 }),
        makeInvoice({ id: 'paid', due_date: '2025-09-01', total: 100, amount_paid: 100, status: 'Paid' }),
      ],
      today
    );
    expect(out.map((i) => i.id)).toEqual(['lastweek', 'yesterday']);
  });
});

describe('suggestedReminderType', () => {
  it('Friendly for ≤ 7 days', () => {
    expect(suggestedReminderType(0)).toBe('Friendly');
    expect(suggestedReminderType(7)).toBe('Friendly');
  });
  it('Firm for 8–30 days', () => {
    expect(suggestedReminderType(8)).toBe('Firm');
    expect(suggestedReminderType(30)).toBe('Firm');
  });
  it('Final Notice for > 30 days', () => {
    expect(suggestedReminderType(31)).toBe('Final Notice');
  });
});

describe('calculateTransactionTotals', () => {
  it('sums income and expenses separately', () => {
    const t = calculateTransactionTotals([
      makeTx({ amount: 500, direction: 'income' }),
      makeTx({ id: 'tx-2', amount: 200, direction: 'expense' }),
      makeTx({ id: 'tx-3', amount: 300, direction: 'income' }),
    ]);
    expect(t).toEqual({
      totalIncome: 800,
      totalExpenses: 200,
      netIncome: 600,
    });
  });

  it('returns zeros for empty list', () => {
    expect(calculateTransactionTotals([])).toEqual({
      totalIncome: 0,
      totalExpenses: 0,
      netIncome: 0,
    });
  });
});

describe('selectRecentTransactions', () => {
  it('sorts by date desc and limits', () => {
    const txs = [
      makeTx({ id: 'a', date: '2025-09-01' }),
      makeTx({ id: 'b', date: '2025-09-15' }),
      makeTx({ id: 'c', date: '2025-09-10' }),
    ];
    const top2 = selectRecentTransactions(txs, 2);
    expect(top2.map((t) => t.id)).toEqual(['b', 'c']);
  });
});
