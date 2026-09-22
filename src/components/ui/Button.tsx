// src/components/ui/Button.tsx
import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'accent-outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** Render as full-width. Useful in forms. */
  block?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 ' +
    'dark:bg-accent-500 dark:hover:bg-accent-400 dark:active:bg-accent-600',
  secondary:
    'bg-transparent text-[var(--uw-text)] border border-[var(--uw-border-soft)] ' +
    'hover:bg-[var(--uw-surface-raised)] hover:border-[var(--uw-border-strong)]',
  ghost:
    'bg-transparent text-[var(--uw-text-muted)] hover:bg-[var(--uw-surface-raised)] ' +
    'hover:text-[var(--uw-text)]',
  danger:
    'bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-600',
  success:
    'bg-success-500 text-white hover:bg-success-600 active:bg-success-600',
  'accent-outline':
    'bg-transparent text-accent-500 border border-accent-500/40 ' +
    'hover:bg-accent-500/10 hover:border-accent-500/60',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-control-sm px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-control px-3 text-sm gap-1.5 rounded-md',
  lg: 'h-control-lg px-4 text-md gap-2 rounded-lg',
  icon: 'h-control w-control rounded-md',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      leadingIcon,
      trailingIcon,
      block = false,
      disabled,
      children,
      className = '',
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center font-medium
          transition-[background-color,border-color,color,opacity] duration-fast
          disabled:opacity-50 disabled:cursor-not-allowed select-none
          whitespace-nowrap
          ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]}
          ${block ? 'w-full' : ''}
          ${className}`}
        {...rest}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          leadingIcon && <span className="shrink-0 -ml-0.5">{leadingIcon}</span>
        )}
        {size !== 'icon' && children && (
          <span className="truncate">{children}</span>
        )}
        {trailingIcon && !loading && (
          <span className="shrink-0 -mr-0.5">{trailingIcon}</span>
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';
