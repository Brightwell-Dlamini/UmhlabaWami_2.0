// src/hooks/useFuzzySearch.ts
export interface FuzzyMatch<T> {
  item: T;
  score: number;
}

function scoreFuzzy(needle: string, haystack: string): number {
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  if (!n) return 0;

  const idx = h.indexOf(n);
  if (idx >= 0) return 1000 - h.length + (idx === 0 ? 50 : 0);

  let hi = 0;
  let gapPenalty = 0;
  let boundaryBonus = 0;
  let lastMatch = -1;

  for (let i = 0; i < n.length; i++) {
    const c = n[i];
    let found = -1;
    for (let j = hi; j < h.length; j++) {
      if (h[j] === c) {
        found = j;
        break;
      }
    }
    if (found === -1) return -1;
    if (lastMatch !== -1) gapPenalty += found - lastMatch - 1;
    if (found === 0 || /[\s\-_/.]/.test(h[found - 1] ?? '')) boundaryBonus += 10;
    lastMatch = found;
    hi = found + 1;
  }

  return 500 + boundaryBonus - gapPenalty;
}

export function fuzzyFilter<T>(
  items: T[],
  needle: string,
  getHaystack: (item: T) => string,
  limit = 20
): T[] {
  if (!needle.trim()) return items.slice(0, limit);

  const scored: FuzzyMatch<T>[] = [];
  for (const item of items) {
    const s = scoreFuzzy(needle, getHaystack(item));
    if (s >= 0) scored.push({ item, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.item);
}
