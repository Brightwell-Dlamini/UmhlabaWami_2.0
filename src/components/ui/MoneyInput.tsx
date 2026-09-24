import React, { forwardRef } from 'react';
import { MONEY_INPUT_PROPS } from '../../lib/money';

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'step' | 'min'> {
  label: string;
  hint?: string;
  error?: string;
  currencySymbol?: string;
}

/**
 * Labeled money field that always accepts cents (step 0.01).
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      label,
      hint,
      error,
      currencySymbol = 'E',
      className = '',
      id,
      placeholder,
      ...rest
    },
    ref
  ) => {
    const inputId = id ?? rest.name ?? `money-${label.replace(/\s+/g, '-').toLowerCase()}`;
    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-[var(--uw-text-muted)] mb-1"
        >
          {label}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--uw-text-subtle)]">
            {currencySymbol}
          </span>
          <input
            ref={ref}
            id={inputId}
            {...MONEY_INPUT_PROPS}
            placeholder={placeholder ?? '0.00'}
            className={`w-full pl-8 pr-3 py-2 text-xs rounded-xl border bg-[var(--uw-surface)] text-[var(--uw-text)] placeholder:text-[var(--uw-text-subtle)] ${className}`}
            {...rest}
          />
        </div>
        {error ? (
          <p className="text-[11px] text-red-500 mt-1">{error}</p>
        ) : hint ? (
          <p className="text-[11px] text-[var(--uw-text-subtle)] mt-1">{hint}</p>
        ) : null}
      </div>
    );
  }
);
MoneyInput.displayName = 'MoneyInput';
