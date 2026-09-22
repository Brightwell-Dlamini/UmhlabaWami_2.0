// src/designTokens.ts
/**
 * Umhlaba Wami design tokens.
 *
 * This file is the ONLY source of truth for colours, type, spacing, motion,
 * and radii. tailwind.config.ts and index.css both read from here. Never
 * hardcode a colour or a curve in a component.
 *
 * Palette philosophy:
 *   - Near-black canvas, warm tinted (not pure grey, not blue-tinted).
 *   - Single electric-violet accent for action and focus.
 *   - Semantic colours reserved exclusively for meaning (never decoration).
 *   - Two-tone borders: hairline (structure) + soft (interactive).
 */

export const palette = {
  // Warm neutral canvas — mirrors the Linear/Vercel register.
  ink: {
    0: '#000000',
    50: '#08080a',
    100: '#0d0d10',
    150: '#111114',
    200: '#16161a',
    250: '#1c1c22',
    300: '#232329',
    350: '#2c2c34',
    400: '#3a3a44',
    450: '#4a4a55',
    500: '#5c5c68',
    550: '#72727e',
    600: '#8a8a95',
    650: '#a1a1ab',
    700: '#b8b8c0',
    750: '#cfcfd6',
    800: '#e3e3e8',
    850: '#eeeeF1',
    900: '#f5f5f7',
    950: '#fafafb',
    1000: '#ffffff',
  },
  // Electric violet — accent. Used for actions, focus, brand moments.
  accent: {
    50: '#f3f0ff',
    100: '#e6e0ff',
    200: '#cbc0ff',
    300: '#ab9bff',
    400: '#8e7bff',
    500: '#7c5cff', // primary
    600: '#6a45f5',
    700: '#5a35db',
    800: '#4a2cb8',
    900: '#3a2290',
    950: '#241557',
  },
  // Semantic — reserved for meaning only.
  success: {
    400: '#3ecf8e',
    500: '#2eb67d',
    600: '#229e6a',
  },
  warning: {
    400: '#f5a524',
    500: '#e08c0b',
    600: '#b87108',
  },
  danger: {
    400: '#f05a5a',
    500: '#e03b3b',
    600: '#c02525',
  },
  info: {
    400: '#5b9dff',
    500: '#3b82f6',
    600: '#2563eb',
  },
} as const;

export const semantic = {
  light: {
    bg: palette.ink[950],
    surface: palette.ink[1000],
    surfaceRaised: palette.ink[1000],
    surfaceSunken: palette.ink[900],
    border: palette.ink[850],
    borderSoft: palette.ink[800],
    borderStrong: palette.ink[750],
    text: palette.ink[100],
    textMuted: palette.ink[550],
    textSubtle: palette.ink[600],
    textInverse: palette.ink[1000],
  },
  dark: {
    bg: palette.ink[50],
    surface: palette.ink[150],
    surfaceRaised: palette.ink[200],
    surfaceSunken: palette.ink[100],
    border: 'rgba(255,255,255,0.06)',
    borderSoft: 'rgba(255,255,255,0.09)',
    borderStrong: 'rgba(255,255,255,0.14)',
    text: palette.ink[900],
    textMuted: palette.ink[500],
    textSubtle: palette.ink[550],
    textInverse: palette.ink[100],
  },
} as const;

export const type = {
  family: {
    sans: "'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif",
    display: "'Inter Display', 'Inter Variable', system-ui, sans-serif",
    mono: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
  },
  // Tight, tall-leading scale. SaaS-2026 register.
  size: {
    '2xs': '10px',
    xs: '11px',
    sm: '12px',
    base: '13px', // default body
    md: '14px',
    lg: '15px',
    xl: '17px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '30px',
    '5xl': '38px',
  },
  leading: {
    tight: '1.2',
    snug: '1.35',
    normal: '1.5',
    relaxed: '1.65',
  },
  tracking: {
    tighter: '-0.03em',
    tight: '-0.015em',
    normal: '0',
    wide: '0.02em',
    wider: '0.06em',
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const space = {
  '0': '0',
  'px': '1px',
  '0.5': '2px',
  '1': '4px',
  '1.5': '6px',
  '2': '8px',
  '2.5': '10px',
  '3': '12px',
  '3.5': '14px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '7': '28px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '14': '56px',
  '16': '64px',
  '20': '80px',
  '24': '96px',
} as const;

export const radius = {
  none: '0',
  xs: '3px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '10px',
  '2xl': '12px',
  '3xl': '16px',
  full: '9999px',
} as const;

export const shadow = {
  // Subtle, layered. No harsh drop-shadows anywhere.
  xs: '0 1px 2px rgba(0,0,0,0.04)',
  sm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  md: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
  lg: '0 12px 32px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.05)',
  xl: '0 24px 48px rgba(0,0,0,0.16), 0 8px 16px rgba(0,0,0,0.06)',
  // Inner highlight for "raised" surfaces in dark mode.
  darkRaised: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  darkPanel:
    '0 0 0 1px rgba(255,255,255,0.04), 0 12px 32px rgba(0,0,0,0.5)',
} as const;

export const motion = {
  // Durations — snap, don't slide.
  duration: {
    instant: '80ms',
    fast: '120ms',
    normal: '180ms',
    slow: '240ms',
    deliberate: '320ms',
  },
  // Easing — the Linear curve. Fast-out, slow-in.
  ease: {
    standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
    emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
    snap: 'cubic-bezier(0.4, 0, 0.2, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  // Spring presets for Framer-style layout animation.
  spring: {
    soft: { stiffness: 180, damping: 22 },
    standard: { stiffness: 260, damping: 26 },
    snappy: { stiffness: 340, damping: 30 },
  },
} as const;

export const z = {
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  banner: 300,
  overlay: 400,
  modal: 500,
  popover: 600,
  toast: 700,
  tooltip: 800,
  max: 9999,
} as const;

export const density = {
  // Compact preset — the default. Rows and controls at Linear register.
  compact: {
    rowHeight: '32px',
    rowHeightTall: '36px',
    controlHeight: '28px',
    controlHeightSm: '24px',
    controlHeightLg: '32px',
    cardPadding: '12px',
    cardPaddingLg: '16px',
    sectionGap: '16px',
    pageGap: '20px',
  },
  // Spacious preset — for marketing surfaces and onboarding only.
  spacious: {
    rowHeight: '48px',
    rowHeightTall: '56px',
    controlHeight: '36px',
    controlHeightSm: '30px',
    controlHeightLg: '44px',
    cardPadding: '20px',
    cardPaddingLg: '24px',
    sectionGap: '24px',
    pageGap: '32px',
  },
} as const;
