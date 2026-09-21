// src/constants/invoiceStatus.ts

/**
 * Mirror of the Postgres `invoice_status` enum.
 * Keep in sync with supabase/migrations — if you ever rename a value in SQL,
 * update both. The `InvoiceStatus` type in `src/types/index.ts` is derived
 * from this list.
 */
export const INVOICE_STATUSES = [
  'Draft',
  'Sent',
  'Partially Paid',
  'Paid',
  'Overdue',
  'Cancelled',
] as const;

export type InvoiceStatusLiteral = (typeof INVOICE_STATUSES)[number];

/** Statuses that should NOT count toward outstanding receivables. */
export const SETTLED_INVOICE_STATUSES: readonly InvoiceStatusLiteral[] = [
  'Paid',
  'Cancelled',
];

/** Statuses that allow recording a payment. */
export const PAYABLE_INVOICE_STATUSES: readonly InvoiceStatusLiteral[] = [
  'Draft',
  'Sent',
  'Partially Paid',
  'Overdue',
];

/** Filter options for the InvoicesTab dropdown. 'All' is UI-only. */
export const INVOICE_STATUS_FILTERS: readonly ('All' | InvoiceStatusLiteral)[] = [
  'All',
  ...INVOICE_STATUSES,
];

/**
 * Tailwind classes for status pills. Keep these in one place so badges
 * look identical everywhere.
 */
export function invoiceStatusTone(status: string): string {
  switch (status) {
    case 'Paid':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    case 'Overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
    case 'Partially Paid':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    case 'Sent':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
    case 'Cancelled':
      return 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 line-through';
    case 'Draft':
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
  }
}

export function isSettledStatus(status: string): boolean {
  return (SETTLED_INVOICE_STATUSES as readonly string[]).includes(status);
}

export function isPayableStatus(status: string): boolean {
  return (PAYABLE_INVOICE_STATUSES as readonly string[]).includes(status);
}
