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

export interface ToastInput {
  title: string;
  message?: string;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. Set to 0 to require manual close. */
  durationMs?: number;
}

interface Toast extends Required<Omit<ToastInput, 'message'>> {
  id: string;
  message?: string;
}

interface ToastContextValue {
  /** Push a toast. Returns the id so the caller can dismiss it. */
  toast: (input: ToastInput) => string;
  /** Dismiss a toast by id. */
  dismiss: (id: string) => void;
  /** Convenience wrappers. */
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 4;

const TONE_STYLES: Record<ToastTone, { bar: string; icon: React.ReactNode }> = {
  success: {
    bar: 'bg-emerald-600',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
  },
  error: {
    bar: 'bg-red-600',
    icon: <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />,
  },
  info: {
    bar: 'bg-blue-600',
    icon: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
  },
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
      };
      setToasts((prev) => {
        const trimmed =
          prev.length >= MAX_VISIBLE ? prev.slice(prev.length - MAX_VISIBLE + 1) : prev;
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

  // Cleanup all timers on unmount.
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
      {/* Viewport */}
      <div
        className={`fixed bottom-6 right-6 ${Z.toast} flex flex-col gap-2 max-w-sm w-[calc(100vw-3rem)] sm:w-auto pointer-events-none`}
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => {
          const tone = TONE_STYLES[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
              className="pointer-events-auto relative flex items-start gap-3 pl-4 pr-10 py-3 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in"
            >
              <span className={`absolute left-0 top-0 bottom-0 w-1 ${tone.bar}`} />
              <div className="shrink-0 mt-0.5">{tone.icon}</div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {t.title}
                </div>
                {t.message && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {t.message}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="absolute right-2 top-2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
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
