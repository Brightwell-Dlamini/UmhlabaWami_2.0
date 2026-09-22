// src/components/ui/EmptyState.tsx
import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  action?: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'error';
  /** 'padded' (default) for page sections; 'compact' for inline lists. */
  variant?: 'padded' | 'compact';
}

const TONE_ICON_BG: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  default: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
  error: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  action,
  tone = 'default',
  variant = 'padded',
}) => {
  const iconWrap =
    variant === 'compact'
      ? 'flex items-center justify-center gap-2 text-xs text-slate-400'
      : 'flex flex-col items-center justify-center text-center gap-3';

  return (
    <div className={variant === 'padded' ? 'p-10' : 'py-4'}>
      <div className={iconWrap}>
        {icon && (
          <div
            className={
              variant === 'padded'
                ? `w-10 h-10 rounded-full flex items-center justify-center ${TONE_ICON_BG[tone]}`
                : ''
            }
          >
            {icon}
          </div>
        )}
        {(title || message) && (
          <div className={variant === 'padded' ? 'space-y-1' : ''}>
            {title && (
              <div
                className={
                  variant === 'padded'
                    ? 'text-sm font-bold text-slate-900 dark:text-white'
                    : 'text-xs font-semibold text-slate-500'
                }
              >
                {title}
              </div>
            )}
            {message && (
              <div
                className={
                  variant === 'padded'
                    ? 'text-xs text-slate-500 max-w-sm'
                    : 'text-xs text-slate-400'
                }
              >
                {message}
              </div>
            )}
          </div>
        )}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
};
