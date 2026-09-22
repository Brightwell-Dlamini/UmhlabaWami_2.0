// src/components/ui/ConfirmDialog.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from './Modal';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual tone. 'danger' gets a red confirm button and trash icon. */
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

/**
 * Wraps children with a confirm-dialog host. Mount once, high in the tree.
 *
 *   <ConfirmProvider>
 *     <App />
 *   </ConfirmProvider>
 *
 * Then anywhere:
 *
 *   const { confirm } = useConfirm();
 *   if (await confirm({ title: 'Delete?', tone: 'danger' })) { … }
 */
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

  const close = useCallback(
    (result: boolean) => {
      setState((s) => {
        s.resolve?.(result);
        return { ...s, open: false, resolve: null };
      });
    },
    []
  );

  const value = useMemo(() => ({ confirm }), [confirm]);

  const tone = state.tone ?? 'default';
  const canConfirm =
    !state.requireText ||
    typed.trim().toLowerCase() === state.requireText.trim().toLowerCase();

  const confirmButtonClass =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : tone === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700'
        : 'bg-blue-600 hover:bg-blue-700';

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={state.open}
        onClose={() => close(false)}
        size="sm"
        showCloseButton={false}
        title={undefined}
      >
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              tone === 'danger'
                ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                : tone === 'warning'
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
            }`}
          >
            {tone === 'danger' ? (
              <Trash2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              {state.title}
            </h3>
            {state.message && (
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {state.message}
              </p>
            )}
          </div>
        </div>

        {state.requireText && (
          <div className="mt-3">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Type <span className="font-mono">{state.requireText}</span> to confirm
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {state.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60 ${confirmButtonClass}`}
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
