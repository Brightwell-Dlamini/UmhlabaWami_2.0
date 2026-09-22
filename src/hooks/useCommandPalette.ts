// src/hooks/useCommandPalette.ts
import { useEffect, useState } from 'react';

let listeners: Set<(open: boolean) => void> = new Set();
let isOpen = false;

function setOpen(next: boolean) {
  isOpen = next;
  listeners.forEach((l) => l(next));
}

// ---------------------------------------------------------------------------
// Recents — persisted to localStorage. The id format matches the palette
// result ids: `nav:<tab>`, `tenant:<id>`, `ticket:<id>`, etc.
// ---------------------------------------------------------------------------

const RECENTS_KEY = 'uw_palette_recents';
const RECENTS_LIMIT = 8;

let recents: string[] = loadRecents();
const recentListeners: Set<(r: string[]) => void> = new Set();

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENTS_LIMIT);
  } catch {
    return [];
  }
}

function saveRecents(next: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function pushRecent(id: string) {
  if (!id) return;
  const next = [id, ...recents.filter((x) => x !== id)].slice(0, RECENTS_LIMIT);
  recents = next;
  saveRecents(next);
  recentListeners.forEach((l) => l(next));
}

/**
 * Global command palette open state and recents.
 * - `useCommandPalette()` gives a component read/write access.
 * - The palette itself registers a Ctrl/Cmd-K global listener.
 */
export function useCommandPalette() {
  const [open, setLocalOpen] = useState(isOpen);
  const [recentIds, setRecentIds] = useState<string[]>(recents);

  useEffect(() => {
    const listener = (next: boolean) => setLocalOpen(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    const listener = (next: string[]) => setRecentIds(next);
    recentListeners.add(listener);
    return () => {
      recentListeners.delete(listener);
    };
  }, []);

  return {
    open,
    openPalette: () => setOpen(true),
    closePalette: () => setOpen(false),
    togglePalette: () => setOpen(!isOpen),
    recents: recentIds,
    pushRecent,
  };
}
