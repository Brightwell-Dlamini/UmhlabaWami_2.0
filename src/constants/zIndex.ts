/**
 * Single source of truth for stacking order. Never hardcode z-* values
 * in components — import from here so nothing collides.
 *
 * Tailwind's arbitrary-value syntax `z-[60]` is used so the numbers
 * don't have to map to Tailwind's default scale.
 */
export const Z = {
  /** Page content — the baseline. */
  content: 'z-0',
  /** Sticky sidebars, in-page tabs. */
  sticky: 'z-20',
  /** Top nav (Navbar). */
  nav: 'z-30',
  /** Global banners (offline, emergency broadcast). */
  banner: 'z-40',
  /** Dropdowns anchored to nav (notification, profile menu). */
  dropdown: 'z-50',
  /** Modals and their backdrops. */
  modal: 'z-[60]',
  /** Toasts — above modals so they're never covered. */
  toast: 'z-[70]',
  /** Critical overlays (booting, hard errors). */
  critical: 'z-[80]',
} as const;

export type ZLayer = keyof typeof Z;
