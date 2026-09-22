import type { Invoice, FinanceTransaction } from '../../types';
import { localDaysBetween, todayIsoLocal } from '../../lib/dates';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Statuses excluded from BOTH sides of the receivables equation.
 * Cancelled invoices never happened; Paid invoices are fully collected.
 * We still want the Paid row to contribute to `totalCollected` — see below.
 */
const VOID_STATUSES = new Set(['Cancelled']);
const SETTLED_STATUSES = new Set(['Paid', 'Cancelled']);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgingBuckets {
  /** Not yet due (or due today). */
  current: number;
  /** 1 to 30 days past due. */
  d30: number;
  /** 31 to 60 days past due. */
  d60: number;
  /** 61 to 90 days past due. */
  d90: number;
  /** More than 90 days past due. */
  older: number;
}

export interface InvoiceTotals {
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  invoiceCount: number;
  unpaidCount: number;
  collectionRate: number; // 0..100, rounded
}

export interface TransactionTotals {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Whole days between two dates, floor-based, immune to time-of-day.
 * Delegates to the local-time implementation in lib/dates.
 *
 * Kept exported under the original name so existing call sites and tests
 * continue to work without modification.
 */
export function daysBetween(fromIso: string, toIso: string): number {
  return localDaysBetween(fromIso, toIso);
}

/** Days an invoice is past due as of `now` (local). Negative = not yet due. */
export function daysOverdue(invoice: Invoice, now: Date = new Date()): number {
  return localDaysBetween(invoice.due_date, now);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Invoice calculations
// ---------------------------------------------------------------------------

/**
 * Aggregates invoice totals.
 *
 * Cancelled invoices are excluded from every figure — they never happened.
 * Paid invoices contribute to `totalCollected` but not to `totalOutstanding`.
 *
 * `collectionRate` = collected / invoiced (invoiced excludes Cancelled).
 */
export function calculateInvoiceTotals(invoices: Invoice[]): InvoiceTotals {
  let totalInvoiced = 0;
  let totalCollected = 0;
  let unpaidCount = 0;
  let countableCount = 0;

  for (const inv of invoices) {
    if (VOID_STATUSES.has(inv.status)) continue;
    countableCount++;
    totalInvoiced += inv.total;
    totalCollected += inv.amount_paid;
    if (!SETTLED_STATUSES.has(inv.status)) unpaidCount++;
  }

  const totalOutstanding = Math.max(0, totalInvoiced - totalCollected);
  const collectionRate =
    totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

  return {
    totalInvoiced: round2(totalInvoiced),
    totalCollected: round2(totalCollected),
    totalOutstanding: round2(totalOutstanding),
    invoiceCount: countableCount,
    unpaidCount,
    collectionRate,
  };
}

/**
 * Bucket outstanding amounts by days past due.
 * Boundary rule (inclusive lower, exclusive upper):
 *   current  : overdueDays <= 0
 *   d30      : 1..=30
 *   d60      : 31..=60
 *   d90      : 61..=90
 *   older    : >= 91
 *
 * Cancelled invoices never enter any bucket.
 */
export function calculateAgingBuckets(
  invoices: Invoice[],
  now: Date = new Date()
): AgingBuckets {
  const buckets: AgingBuckets = {
    current: 0,
    d30: 0,
    d60: 0,
    d90: 0,
    older: 0,
  };

  for (const inv of invoices) {
    if (SETTLED_STATUSES.has(inv.status)) continue;
    const outstanding = inv.total - inv.amount_paid;
    if (outstanding <= 0) continue;

    const overdueDays = localDaysBetween(inv.due_date, now);

    if (overdueDays <= 0) buckets.current += outstanding;
    else if (overdueDays <= 30) buckets.d30 += outstanding;
    else if (overdueDays <= 60) buckets.d60 += outstanding;
    else if (overdueDays <= 90) buckets.d90 += outstanding;
    else buckets.older += outstanding;
  }

  return {
    current: round2(buckets.current),
    d30: round2(buckets.d30),
    d60: round2(buckets.d60),
    d90: round2(buckets.d90),
    older: round2(buckets.older),
  };
}

/**
 * Return unpaid invoices sorted by how overdue they are, oldest due first.
 * Only includes invoices that are strictly past due (same-day is not overdue).
 */
export function selectOverdueInvoices(
  invoices: Invoice[],
  now: Date = new Date()
): Invoice[] {
  return invoices
    .filter((inv) => !SETTLED_STATUSES.has(inv.status))
    .filter((inv) => inv.total - inv.amount_paid > 0)
    .filter((inv) => localDaysBetween(inv.due_date, now) > 0)
    .sort(
      (a, b) =>
        localDaysBetween(b.due_date, now) -
        localDaysBetween(a.due_date, now)
    );
}

/**
 * Suggested reminder severity for an overdue invoice.
 * Friendly ≤ 7 days, Firm ≤ 30, Final beyond that.
 */
export function suggestedReminderType(
  overdueDays: number
): 'Friendly' | 'Firm' | 'Final Notice' {
  if (overdueDays > 30) return 'Final Notice';
  if (overdueDays > 7) return 'Firm';
  return 'Friendly';
}

// ---------------------------------------------------------------------------
// Transaction calculations
// ---------------------------------------------------------------------------

export function calculateTransactionTotals(
  transactions: FinanceTransaction[]
): TransactionTotals {
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const tx of transactions) {
    if (tx.direction === 'income') totalIncome += tx.amount;
    else if (tx.direction === 'expense') totalExpenses += tx.amount;
  }

  return {
    totalIncome: round2(totalIncome),
    totalExpenses: round2(totalExpenses),
    netIncome: round2(totalIncome - totalExpenses),
  };
}

/** Most recent N transactions, newest first. */
export function selectRecentTransactions(
  transactions: FinanceTransaction[],
  limit: number
): FinanceTransaction[] {
  return [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Utilities exposed for views that need a local "today" without importing
// lib/dates directly.
// ---------------------------------------------------------------------------

export { todayIsoLocal };
