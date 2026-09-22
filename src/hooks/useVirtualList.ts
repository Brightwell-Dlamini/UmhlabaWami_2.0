// src/hooks/useVirtualList.ts
import { useEffect, useMemo, useRef, useState } from 'react';

interface Options {
  itemHeight: number;
  overscan?: number;
}

/**
 * Minimal windowed-list hook. No external deps.
 * Returns a slice range you render, plus the container ref & total height.
 */
export function useVirtualList<T>(
  items: T[],
  { itemHeight, overscan = 6 }: Options
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    const onResize = () => setViewport(el.clientHeight);
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    onResize();
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const { start, end, offsetY, totalHeight } = useMemo(() => {
    const total = items.length * itemHeight;
    const first = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visible = Math.ceil(viewport / itemHeight) + overscan * 2;
    const last = Math.min(items.length, first + visible);
    return {
      start: first,
      end: last,
      offsetY: first * itemHeight,
      totalHeight: total,
    };
  }, [items.length, itemHeight, scrollTop, viewport, overscan]);

  return {
    containerRef,
    virtualItems: items.slice(start, end),
    startIndex: start,
    offsetY,
    totalHeight,
  };
}
