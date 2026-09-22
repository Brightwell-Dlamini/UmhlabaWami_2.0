// src/hooks/useOfflineQueue.ts
import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'uw_offline_queue_v1';

export interface QueuedMutation {
  id: string;
  label: string;
  run: () => Promise<unknown>;
  enqueuedAt: number;
  attempts: number;
}

let memoryQueue: QueuedMutation[] = [];

function saveCount(count: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ count }));
  } catch {
    /* ignore */
  }
}

/**
 * Fire-and-forget mutation queue. If a call fails while offline,
 * it is retried automatically when connectivity returns.
 *
 * Non-durable across reloads by design — mutations carry closures that
 * cannot be safely serialized.
 */
export function useOfflineQueue() {
  const [pending, setPending] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as { count?: number };
      return parsed.count ?? 0;
    } catch {
      return 0;
    }
  });
  const flushing = useRef(false);

  const flush = async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const remaining: QueuedMutation[] = [];
      for (const item of memoryQueue) {
        try {
          await item.run();
        } catch {
          item.attempts += 1;
          if (item.attempts < 5) remaining.push(item);
        }
      }
      memoryQueue = remaining;
      setPending(remaining.length);
      saveCount(remaining.length);
    } finally {
      flushing.current = false;
    }
  };

  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enqueue = (
    item: Omit<QueuedMutation, 'id' | 'enqueuedAt' | 'attempts'>
  ) => {
    const entry: QueuedMutation = {
      ...item,
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      enqueuedAt: Date.now(),
      attempts: 0,
    };
    memoryQueue.push(entry);
    setPending(memoryQueue.length);
    saveCount(memoryQueue.length);
    if (navigator.onLine) void flush();
  };

  return { enqueue, pending, flush };
}
