// src/components/ui/KeyboardHelpModal.tsx
import React from 'react';
import { Modal } from './Modal';
import { Command } from 'lucide-react';

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
    icon={<Command className="w-5 h-5 text-blue-600" />}
  >
    <ul className="space-y-2">
      {ROWS.map((r) => (
        <li
          key={r.label}
          className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0"
        >
          <span className="text-slate-600 dark:text-slate-300">{r.label}</span>
          <span className="flex items-center gap-1">
            {r.keys.map((k) => (
              <kbd
                key={k}
                className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[10px] font-semibold"
              >
                {k}
              </kbd>
            ))}
          </span>
        </li>
      ))}
    </ul>
  </Modal>
);
