// src/components/ui/KeyboardHelpModal.tsx
import React from 'react';
import { Modal } from './Modal';
import { Command } from 'lucide-react';
import { Kbd } from './Kbd';

const ROWS: { keys: string[]; label: string }[] = [
  { keys: ['⌘', 'K'], label: 'Open command palette' },
  { keys: ['Ctrl', 'K'], label: 'Open command palette (Windows/Linux)' },
  { keys: ['G', 'D'], label: 'Go to dashboard' },
  { keys: ['G', 'T'], label: 'Go to tickets' },
  { keys: ['G', 'C'], label: 'Go to tenants' },
  { keys: ['G', 'N'], label: 'New ticket' },
  { keys: ['?'], label: 'Show this help' },
  { keys: ['Esc'], label: 'Close dialogs' },
];

export const KeyboardHelpModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => (
  <Modal
    open={open}
    onClose={onClose}
    size="sm"
    title="Keyboard shortcuts"
    icon={<Command className="w-4 h-4" strokeWidth={1.75} />}
  >
    <ul className="space-y-0.5">
      {ROWS.map((r) => (
        <li
          key={r.label}
          className="flex items-center justify-between text-[12px] py-2 border-b border-[var(--uw-border)] last:border-0"
        >
          <span className="text-[var(--uw-text-muted)]">{r.label}</span>
          <span className="flex items-center gap-1">
            {r.keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        </li>
      ))}
    </ul>
  </Modal>
);
