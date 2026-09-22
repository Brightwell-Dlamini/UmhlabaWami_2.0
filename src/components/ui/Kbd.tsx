// src/components/ui/Kbd.tsx
import React from 'react';

export const Kbd: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <kbd className={`kbd ${className}`}>{children}</kbd>
);
