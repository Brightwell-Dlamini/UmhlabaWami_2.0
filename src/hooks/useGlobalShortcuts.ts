// src/hooks/useGlobalShortcuts.ts
import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  onOpenPalette?: () => void;
  onOpenCreateTicket?: () => void;
  onGoDashboard?: () => void;
  onGoTickets?: () => void;
  onGoTenants?: () => void;
  onShowHelp?: () => void;
  onEscape?: () => void;
}

const SEQUENCE_TIMEOUT = 800;

export function useGlobalShortcuts(handlers: ShortcutHandlers, enabled = true) {
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handlersRef.current.onOpenPalette?.();
        return;
      }

      if (isTypingTarget(e.target)) return;

      if (e.key === '?') {
        e.preventDefault();
        handlersRef.current.onShowHelp?.();
        return;
      }

      const now = Date.now();
      const prev = lastKey.current;

      if (e.key.toLowerCase() === 'g') {
        lastKey.current = { key: 'g', at: now };
        return;
      }

      if (prev && prev.key === 'g' && now - prev.at < SEQUENCE_TIMEOUT) {
        const k = e.key.toLowerCase();
        if (k === 'd') handlersRef.current.onGoDashboard?.();
        else if (k === 't') handlersRef.current.onGoTickets?.();
        else if (k === 'c') handlersRef.current.onGoTenants?.();
        else if (k === 'n') handlersRef.current.onOpenCreateTicket?.();
        lastKey.current = null;
      } else if (e.key === 'Escape') {
        handlersRef.current.onEscape?.();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
