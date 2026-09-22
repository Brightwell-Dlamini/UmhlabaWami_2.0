// src/components/ui/Card.tsx
import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Opt into raised surface (elevated shadow). */
  raised?: boolean;
  /** Remove inner padding — useful for tables. */
  bare?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  raised = false,
  bare = false,
}) => (
  <div
    className={`rounded-lg border border-[var(--uw-border)] bg-[var(--uw-surface)]
      ${raised ? 'shadow-md' : ''}
      ${bare ? '' : 'p-3'}
      ${className}`}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<{
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, description, action, className = '' }) => (
  <div className={`flex items-start justify-between gap-3 px-3 py-2.5 border-b border-[var(--uw-border)] ${className}`}>
    <div className="min-w-0">
      {title && (
        <h3 className="text-sm font-semibold text-[var(--uw-text)] truncate">{title}</h3>
      )}
      {description && (
        <p className="text-[11px] text-[var(--uw-text-muted)] mt-0.5">{description}</p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
