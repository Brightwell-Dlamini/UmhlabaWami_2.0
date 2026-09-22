// tailwind.config.ts
import type { Config } from 'tailwindcss';
import {
  palette,
  type as typeTokens,
  space,
  radius,
  shadow,
  motion,
  z,
  density,
} from './src/designTokens';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: palette.ink,
        accent: palette.accent,
        success: palette.success,
        warning: palette.warning,
        danger: palette.danger,
        info: palette.info,
      },
      fontFamily: {
        sans: [typeTokens.family.sans],
        display: [typeTokens.family.display],
        mono: [typeTokens.family.mono],
      },
      fontSize: Object.fromEntries(
        Object.entries(typeTokens.size).map(([k, v]) => [
          k,
          [v, { lineHeight: typeTokens.leading.snug, letterSpacing: '-0.01em' }],
        ])
      ),
      letterSpacing: typeTokens.tracking,
      fontWeight: typeTokens.weight,
      spacing: space,
      borderRadius: radius,
      boxShadow: shadow,
      transitionDuration: motion.duration,
      transitionTimingFunction: motion.ease,
      zIndex: z,
      height: {
        'row': density.compact.rowHeight,
        'row-tall': density.compact.rowHeightTall,
        'control': density.compact.controlHeight,
        'control-sm': density.compact.controlHeightSm,
        'control-lg': density.compact.controlHeightLg,
      },
      minHeight: {
        'row': density.compact.rowHeight,
        'control': density.compact.controlHeight,
      },
    },
  },
  plugins: [],
} satisfies Config;
