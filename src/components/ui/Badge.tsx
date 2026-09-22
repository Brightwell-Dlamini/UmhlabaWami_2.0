// src/components/ui/Badge.tsx
import React from 'react';

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline';

export interface BadgeProps {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    'bg-[var(--uw-surface-raised)] text-[var(--uw-text-muted)] border-[var(--uw-border)]',
  accent: 'bg-accent-500/12 text-accent-400 border-accent-500/25',
  success: 'bg-success-500/12 text-success-400 border-success-500/25',
  warning: 'bg-warning-500/12 text-warning-400 border-warning-500/25',
  danger: 'bg-danger-500/12 text-danger-400 border-danger-500/25',
  info: 'bg-info-500/12 text-info-400 border-info-500/25',
  outline: 'bg-transparent text-[var(--uw-text-muted)] border-[var(--uw-border-soft)]',
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--uw-text-subtle)]',
  accent: 'bg-accent-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  outline: 'bg-[var(--uw-text-subtle)]',
};

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  size = 'sm',
  dot = false,
  children,
  className = '',
}) => (
  <span
    className={`inline-flex items-center gap-1 font-medium border rounded-full whitespace-nowrap
      ${size === 'sm' ? 'h-5 px-2 text-[10px]' : 'h-6 px-2.5 text-xs'}
      ${TONE_CLASSES[tone]}
      ${className}`}
  >
    {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASSES[tone]}`} />}
    {children}
  </span>
);
