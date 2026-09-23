// src/components/ui/ToastProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { Z } from '../../constants/zIndex';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  title: string;
  message?: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: ToastAction;
}

interface Toast extends Required<Omit<ToastInput, 'message' | 'action'>> {
  id: string;
  message?: string;
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 4;

const TONE_ICON: Record<ToastTone, React.ReactNode> = {
  success: (
    <CheckCircle2
      className="w-4 h-4 text-success-500"
      strokeWidth={2}
    />
  ),
  error: (
    <AlertTriangle
      className="w-4 h-4 text-danger-500"
      strokeWidth={2}
    />
  ),
  info: (
    <Info className="w-4 h-4 text-info-500" strokeWidth={2} />
  ),
};

const TONE_BAR: Record<ToastTone, string> = {
  success: 'bg-success-500',
  error: 'bg-danger-500',
  info: 'bg-info-500',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput): string => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const durationMs =
        input.durationMs ?? (input.tone === 'error' ? 6000 : 4000);
      const next: Toast = {
        id,
        title: input.title,
        message: input.message,
        tone: input.tone ?? 'info',
        durationMs,
        action: input.action,
      };
      setToasts((prev) => {
        const trimmed =
          prev.length >= MAX_VISIBLE
            ? prev.slice(prev.length - MAX_VISIBLE + 1)
            : prev;
        return [...trimmed, next];
      });
      if (durationMs > 0) {
        const handle = window.setTimeout(() => dismiss(id), durationMs);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => window.clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, message) => toast({ title, message, tone: 'success' }),
      error: (title, message) => toast({ title, message, tone: 'error' }),
      info: (title, message) => toast({ title, message, tone: 'info' }),
    }),
    [toast, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className={`fixed bottom-4 right-4 ${Z.toast} flex flex-col gap-2 w-[calc(100vw-2rem)] sm:w-[360px] pointer-events-none`}
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
            className="pointer-events-auto relative flex items-start gap-3 pl-3.5 pr-9 py-3 rounded-lg bg-[var(--uw-surface)] border border-[var(--uw-border)] overflow-hidden animate-in shadow-[var(--uw-shadow-panel)]"
          >
            <span
              className={`absolute left-0 top-0 bottom-0 w-0.5 ${TONE_BAR[t.tone]}`}
            />
            <div className="shrink-0 mt-0.5">{TONE_ICON[t.tone]}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-[var(--uw-text)] leading-tight">
                {t.title}
              </div>
              {t.message && (
                <div className="text-[11px] text-[var(--uw-text-muted)] mt-1 leading-snug">
                  {t.message}
                </div>
              )}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-2 px-2.5 h-6 rounded-md bg-[var(--uw-surface-raised)] border border-[var(--uw-border-soft)] text-[11px] font-semibold text-[var(--uw-text)] hover:border-[var(--uw-border-strong)] transition-colors duration-fast"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="absolute right-2 top-2 w-6 h-6 rounded-md text-[var(--uw-text-subtle)] hover:text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] flex items-center justify-center transition-colors duration-fast"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }
  return ctx;
}
