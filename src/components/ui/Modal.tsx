// src/components/ui/Modal.tsx
import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Z } from '../../constants/zIndex';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional title shown in the header bar. If omitted, no header is rendered. */
  title?: React.ReactNode;
  /** Optional subtitle under the title. */
  subtitle?: React.ReactNode;
  /** Icon slot to the left of the title. */
  icon?: React.ReactNode;
  /** Width preset. Defaults to 'md'. */
  size?: ModalSize;
  /** When false, clicking the backdrop won't close. Default true. */
  dismissOnBackdrop?: boolean;
  /** When false, Escape won't close. Default true. */
  dismissOnEscape?: boolean;
  /** When false, no close button rendered. Default true. */
  showCloseButton?: boolean;
  /** Extra classes for the inner panel. */
  panelClassName?: string;
  /** Hide the default padding around the body. Useful for tables. */
  bareBody?: boolean;
  /** Optional ref that receives focus when the modal opens. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Optional aria label when no visible title. */
  ariaLabel?: string;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[min(100vw-1rem,1400px)]',
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Accessible modal. Drop-in for the current hand-rolled overlay.
 *
 *   <Modal open={open} onClose={close} title="New item" icon={<Package />}>
 *     …form…
 *   </Modal>
 *
 * - Portalled to <body>.
 * - Locks body scroll while open.
 * - Escape + backdrop dismissal (both configurable).
 * - Focus trap with Tab cycling.
 * - Restores focus on close.
 * - Mobile: panel slides up from bottom; desktop: centred.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  children,
  title,
  subtitle,
  icon,
  size = 'md',
  dismissOnBackdrop = true,
  dismissOnEscape = true,
  showCloseButton = true,
  panelClassName = '',
  bareBody = false,
  initialFocusRef,
  ariaLabel,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  // Remember who had focus so we can restore it on close.
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
    }
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open || !dismissOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, dismissOnEscape, onClose]);

  // Autofocus: prefer initialFocusRef, then first input, then panel.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      // Don't steal focus from an element that already owns it inside the panel.
      if (panel.contains(document.activeElement)) return;

      const externalTarget = initialFocusRef?.current;
      if (externalTarget && panel.contains(externalTarget)) {
        externalTarget.focus({ preventScroll: true });
        return;
      }

      const firstInput = panel.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      const target = firstInput ?? panel;
      target.focus({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(id);
  }, [open, initialFocusRef]);

  // Restore focus when the modal closes.
  useEffect(() => {
    if (open) return;
    const el = previouslyFocused.current;
    if (el && document.body.contains(el)) {
      el.focus({ preventScroll: true });
    }
    previouslyFocused.current = null;
  }, [open]);

  // Focus trap: cycle Tab within the panel.
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    if (focusable.length === 0) {
      e.preventDefault();
      panel.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  if (!open) return null;

  const panel = (
    <div
      className={`fixed inset-0 ${Z.modal} flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto`}
      aria-modal="true"
      role="dialog"
      aria-label={ariaLabel}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => {
          if (dismissOnBackdrop) onClose();
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`relative w-full ${SIZE_CLASSES[size]} bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col
          rounded-t-2xl sm:rounded-2xl
          mt-auto sm:my-auto
          max-h-[92vh] sm:max-h-[92vh]
          animate-modal-in sm:animate-modal-in-desktop
          ${panelClassName}`}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile grabber hint */}
              <span
                aria-hidden="true"
                className="sm:hidden absolute left-1/2 top-1.5 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700"
              />
              {icon && (
                <div className="shrink-0 text-slate-600 dark:text-slate-300">
                  {icon}
                </div>
              )}
              {title && (
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        <div
          className={
            bareBody
              ? 'flex-1 overflow-y-auto'
              : 'p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto'
          }
        >
          {children}
        </div>
      </div>
    </div>
  );

  // SSR-safe portal target.
  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
};
