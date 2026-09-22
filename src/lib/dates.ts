/**
 * Date helpers with a single, explicit contract:
 *
 *   • Date-only operations (aging, SLA, rent roll) must be in LOCAL time,
 *     because a property manager looking at "today" means their wall-clock
 *     today — not UTC today. Eswatini is UTC+2, so `toISOString()` on any
 *     date before 02:00 local returns *yesterday's* date. That breaks
 *     aging buckets, overdue detection, and SLA math.
 *
 *   • Full timestamps (created_at, resolved_at, sent_at) remain ISO/UTC
 *     and must NOT go through these helpers.
 *
 * Every site that previously did `new Date().toISOString().slice(0, 10)`
 * for a date-only value should now call `todayIsoLocal()` instead.
 */

const MS_PER_DAY = 86_400_000;

/** Local date as YYYY-MM-DD. */
export function todayIsoLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Convert any date string/Date into a local YYYY-MM-DD. */
export function toIsoLocal(value: string | Date): string {
  if (typeof value === 'string') {
    // Fast path for date-only strings — no parsing, no timezone shift.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  }
  const d = value instanceof Date ? value : new Date(value);
  return todayIsoLocal(d);
}

/**
 * Whole days between two dates, local-time, immune to time-of-day and
 * daylight-saving shifts (Eswatini has none, but our dev environments do).
 */
export function localDaysBetween(
  from: string | Date,
  to: string | Date = new Date()
): number {
  const a = startOfLocalDay(from);
  const b = startOfLocalDay(to);
  return Math.round((b - a) / MS_PER_DAY);
}

/** UTC-midnight epoch for a local calendar date. */
function startOfLocalDay(value: string | Date): number {
  const d =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(
          Number(value.slice(0, 4)),
          Number(value.slice(5, 7)) - 1,
          Number(value.slice(8, 10))
        )
      : value instanceof Date
        ? value
        : new Date(value);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * True when `iso` is strictly before today (local). Same-day is NOT past.
 * Used for "overdue" checks where the due date is inclusive.
 */
export function isPastLocal(iso: string, now: Date = new Date()): boolean {
  return localDaysBetween(iso, now) > 0;
}

/**
 * Add `days` (can be negative) to a local date, returning a new YYYY-MM-DD.
 */
export function addDaysLocal(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return todayIsoLocal(dt);
}
