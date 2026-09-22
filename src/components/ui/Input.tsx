// src/components/ui/Input.tsx
import React, { forwardRef } from 'react';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingSlot?: React.ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'h-control-sm px-2 text-xs',
  md: 'h-control px-2.5 text-sm',
  lg: 'h-control-lg px-3 text-md',
} as const;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      leadingIcon,
      trailingSlot,
      inputSize = 'md',
      className = '',
      id,
      ...rest
    },
    ref
  ) => {
    const inputId = id ?? rest.name;
    const hasIcon = !!leadingIcon;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-[var(--uw-text-muted)] mb-1.5"
          >
            {label}
          </label>
        )}
        <div
          className={`relative flex items-center rounded-md border
            bg-[var(--uw-surface)] border-[var(--uw-border)]
            focus-within:border-accent-500 focus-within:shadow-[0_0_0_3px_rgba(124,92,255,0.15)]
            transition-[border-color,box-shadow] duration-fast
            ${error ? 'border-danger-500/60' : ''}
          `}
        >
          {hasIcon && (
            <span className="pl-2.5 pr-1.5 text-[var(--uw-text-subtle)] shrink-0 flex items-center">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`flex-1 min-w-0 bg-transparent outline-none
              text-[var(--uw-text)] placeholder:text-[var(--uw-text-subtle)]
              ${hasIcon ? 'pl-0' : ''}
              ${trailingSlot ? 'pr-0' : ''}
              ${SIZE_CLASSES[inputSize]}
              ${className}
            `}
            {...rest}
          />
          {trailingSlot && (
            <span className="pr-1.5 shrink-0 flex items-center">
              {trailingSlot}
            </span>
          )}
        </div>
        {error ? (
          <p className="text-[11px] text-danger-500 mt-1.5">{error}</p>
        ) : hint ? (
          <p className="text-[11px] text-[var(--uw-text-subtle)] mt-1.5">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
