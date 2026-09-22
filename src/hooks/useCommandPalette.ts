// src/hooks/useCommandPalette.ts
import { useEffect, useState } from 'react';

let listeners: Set<(open: boolean) => void> = new Set();
let isOpen = false;

function setOpen(next: boolean) {
  isOpen = next;
  listeners.forEach((l) => l(next));
}

/**
 * Global command palette open state.
 * - `useCommandPalette()` gives a component read/write access.
 * - The palette itself registers a Ctrl/Cmd-K global listener.
 */
export function useCommandPalette() {
  const [open, setLocalOpen] = useState(isOpen);

  useEffect(() => {
    const listener = (next: boolean) => setLocalOpen(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    open,
    openPalette: () => setOpen(true),
    closePalette: () => setOpen(false),
    togglePalette: () => setOpen(!isOpen),
  };
}
