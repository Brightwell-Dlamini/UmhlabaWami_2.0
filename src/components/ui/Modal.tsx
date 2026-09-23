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
  /** Optional title shown in the header bar. */
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
  /** Hide the default padding around the body. */
  bareBody?: boolean;
  /** Optional ref that receives focus when the modal opens. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Optional aria label when no visible title. */
  ariaLabel?: string;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[720px]',
  xl: 'max-w-[960px]',
  full: 'max-w-[min(100vw-16px,1400px)]',
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

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

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

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

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
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

  useEffect(() => {
    if (open) return;
    const el = previouslyFocused.current;
    if (el && document.body.contains(el)) {
      el.focus({ preventScroll: true });
    }
    previouslyFocused.current = null;
  }, [open]);

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
      <div
        className="fixed inset-0 bg-ink-0/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => {
          if (dismissOnBackdrop) onClose();
        }}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`relative w-full ${SIZE_CLASSES[size]} bg-[var(--uw-surface)] border border-[var(--uw-border)] flex flex-col
          rounded-t-xl sm:rounded-xl
          mt-auto sm:my-auto
          max-h-[92vh]
          shadow-[var(--uw-shadow-panel)]
          animate-modal-in sm:animate-modal-in-desktop
          ${panelClassName}`}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--uw-border)] shrink-0">
            <span
              aria-hidden="true"
              className="sm:hidden absolute left-1/2 top-1.5 -translate-x-1/2 w-9 h-1 rounded-full bg-[var(--uw-border-soft)]"
            />
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && (
                <div className="shrink-0 text-[var(--uw-text-muted)]">
                  {icon}
                </div>
              )}
              {title && (
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-[var(--uw-text)] truncate leading-tight">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-[11px] text-[var(--uw-text-muted)] mt-0.5 truncate leading-tight">
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
                className="w-7 h-7 -mr-1 rounded-md text-[var(--uw-text-subtle)] hover:text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] shrink-0 flex items-center justify-center transition-colors duration-fast"
                aria-label="Close"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}

        <div
          className={
            bareBody
              ? 'flex-1 overflow-y-auto scrollbar-thin'
              : 'p-4 sm:p-5 flex-1 overflow-y-auto scrollbar-thin'
          }
        >
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
};
