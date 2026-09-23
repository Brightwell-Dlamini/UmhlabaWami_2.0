// src/components/ui/ConfirmDialog.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';
import { Modal } from './Modal';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual tone. */
  tone?: 'default' | 'danger' | 'warning';
  /** If set, user must type this exact string to enable the confirm button. */
  requireText?: string;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((v: boolean) => void) | null;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    resolve: null,
  });
  const [typed, setTyped] = useState('');

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setTyped('');
      setState({ ...options, open: true, resolve });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    setState((s) => {
      s.resolve?.(result);
      return { ...s, open: false, resolve: null };
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  const tone = state.tone ?? 'default';
  const canConfirm =
    !state.requireText ||
    typed.trim().toLowerCase() === state.requireText.trim().toLowerCase();

  const confirmButtonClass =
    tone === 'danger'
      ? 'bg-danger-500 hover:bg-danger-600 text-white'
      : tone === 'warning'
        ? 'bg-warning-500 hover:bg-warning-600 text-white'
        : 'bg-accent-500 hover:bg-accent-600 text-white';

  const iconWrapClass =
    tone === 'danger'
      ? 'bg-danger-500/12 text-danger-500 border-danger-500/25'
      : tone === 'warning'
        ? 'bg-warning-500/12 text-warning-500 border-warning-500/25'
        : 'bg-accent-500/12 text-accent-500 border-accent-500/25';

  const Icon = tone === 'danger' ? Trash2 : tone === 'warning' ? ShieldAlert : AlertTriangle;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={state.open}
        onClose={() => close(false)}
        size="sm"
        showCloseButton={false}
        ariaLabel={state.title}
      >
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 w-9 h-9 rounded-md border flex items-center justify-center ${iconWrapClass}`}
          >
            <Icon className="w-4 h-4" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-semibold text-[var(--uw-text)] leading-tight">
              {state.title}
            </h3>
            {state.message && (
              <p className="text-[12px] text-[var(--uw-text-muted)] mt-1.5 leading-relaxed">
                {state.message}
              </p>
            )}
          </div>
        </div>

        {state.requireText && (
          <div className="mt-4">
            <label className="block text-[11px] font-medium text-[var(--uw-text-muted)] mb-1.5">
              Type{' '}
              <span className="font-mono text-[var(--uw-text)] bg-[var(--uw-surface-raised)] px-1 py-0.5 rounded border border-[var(--uw-border)]">
                {state.requireText}
              </span>{' '}
              to confirm
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="w-full h-control px-2.5 text-[13px] rounded-md bg-[var(--uw-surface)] border border-[var(--uw-border)] focus:border-accent-500 focus:shadow-[0_0_0_3px_rgba(124,92,255,0.15)] outline-none transition-[border-color,box-shadow] duration-fast"
            />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="h-control px-3 rounded-md border border-[var(--uw-border-soft)] text-[12px] font-medium text-[var(--uw-text)] hover:bg-[var(--uw-surface-raised)] hover:border-[var(--uw-border-strong)] transition-colors duration-fast"
          >
            {state.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            disabled={!canConfirm}
            className={`h-control px-3 rounded-md text-[12px] font-semibold transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed ${confirmButtonClass}`}
          >
            {state.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
};

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>.');
  }
  return ctx;
}
