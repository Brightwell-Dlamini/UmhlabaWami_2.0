// src/components/ui/Skeleton.tsx
import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'block' | 'circle';
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'block',
  lines = 1,
}) => {
  const base = 'bg-slate-200 dark:bg-slate-700 animate-pulse rounded-md';

  if (variant === 'circle') {
    return <div className={`${base} rounded-full ${className}`} />;
  }

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${base} h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
          />
        ))}
      </div>
    );
  }

  return <div className={`${base} h-4 ${className}`} />;
};

export const SkeletonCard: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <div
    className={`p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3 ${className}`}
  >
    <Skeleton className="h-3 w-1/3" />
    <Skeleton className="h-6 w-1/2" />
    <Skeleton className="h-3 w-2/3" />
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 6,
  cols = 4,
}) => (
  <div className="divide-y divide-slate-100 dark:divide-slate-700">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-3 p-4">
        {Array.from({ length: cols }).map((__, c) => (
          <Skeleton key={c} className="h-3 flex-1" />
        ))}
      </div>
    ))}
  </div>
);
