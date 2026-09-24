/**
 * Money helpers — always support cents (e.g. E10.50).
 * Emalangeni (E) display; values stored as JS numbers (decimal).
 */

export function formatMoney(
  value: number | null | undefined,
  options?: { showCurrency?: boolean; compact?: boolean }
): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const digits = options?.compact && Number.isInteger(safe) ? 0 : 2;
  const body = safe.toLocaleString(undefined, {
    minimumFractionDigits: digits === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  if (options?.showCurrency === false) return body;
  return `E${body}`;
}

/** Always two decimal places, with currency prefix. */
export function formatE(value: number | null | undefined): string {
  return formatMoney(value, { showCurrency: true });
}

/** Parse user input into a number rounded to cents. */
export function parseMoney(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.round(raw * 100) / 100 : 0;
  }
  const cleaned = String(raw ?? '')
    .replace(/,/g, '')
    .replace(/[^\d.\-]/g, '')
    .trim();
  if (!cleaned || cleaned === '-' || cleaned === '.') return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Shared props for money number inputs. */
export const MONEY_INPUT_PROPS = {
  type: 'number' as const,
  min: 0,
  step: 0.01,
  inputMode: 'decimal' as const,
};
