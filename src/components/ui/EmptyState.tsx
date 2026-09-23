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

const TONE_WRAP: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  default:
    'bg-[var(--uw-surface-raised)] text-[var(--uw-text-muted)] border-[var(--uw-border)]',
  success: 'bg-success-500/10 text-success-500 border-success-500/25',
  warning: 'bg-warning-500/10 text-warning-500 border-warning-500/25',
  error: 'bg-danger-500/10 text-danger-500 border-danger-500/25',
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  action,
  tone = 'default',
  variant = 'padded',
}) => {
  if (variant === 'compact') {
    return (
      <div className="py-6 flex items-center justify-center gap-2 text-[12px] text-[var(--uw-text-subtle)]">
        {icon && <span className="shrink-0">{icon}</span>}
        {title && <span className="font-medium">{title}</span>}
        {message && <span className="text-[var(--uw-text-subtle)]">· {message}</span>}
      </div>
    );
  }

  return (
    <div className="p-10 flex flex-col items-center justify-center text-center gap-3">
      {icon && (
        <div
          className={`w-10 h-10 rounded-md border flex items-center justify-center ${TONE_WRAP[tone]}`}
        >
          {icon}
        </div>
      )}
      {(title || message) && (
        <div className="space-y-1 max-w-sm">
          {title && (
            <div className="text-[13px] font-semibold text-[var(--uw-text)] leading-tight">
              {title}
            </div>
          )}
          {message && (
            <div className="text-[12px] text-[var(--uw-text-muted)] leading-relaxed">
              {message}
            </div>
          )}
        </div>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
