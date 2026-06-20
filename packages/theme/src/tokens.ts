/**
 * Modern-minimal design tokens, shared by the web and mobile apps.
 *
 * Direction: a calm, precise "strategy game on cool paper" — deliberately cool-toned
 * neutrals (not warm cream), crisp low shadows, and two confident player colors:
 * indigo for X, emerald for O. The active-board glow is the one place we spend boldness.
 *
 * Primitives are platform-neutral (hex strings + unitless numbers) so they work for both
 * CSS and React Native StyleSheet. A few helpers expose web (`boxShadow` string) and
 * native (`elevation` + shadow props) variants. Evolve the look here once; both apps follow.
 */

export const palette = {
  /** App background — cool off-white paper. */
  bg: '#F4F5F7',
  /** Card / board surface. */
  surface: '#FFFFFF',
  /** Subtle alternate surface (finished boards, insets). */
  surfaceAlt: '#EDEFF3',
  /** Primary text. */
  ink: '#15171C',
  /** Secondary text. */
  inkSoft: '#4B515E',
  /** Muted / disabled text. */
  muted: '#888F9C',
  /** Hairline borders / grid lines. */
  line: '#E4E7EC',
  lineStrong: '#CFD4DC',

  /** Player X — indigo. */
  x: '#4F46E5',
  xSoft: '#ECEDFB',
  xGlow: 'rgba(79, 70, 229, 0.22)',
  /** Player O — emerald. */
  o: '#0E9F6E',
  oSoft: '#E3F6EE',
  oGlow: 'rgba(14, 159, 110, 0.22)',

  /** Accent used for primary actions / active state (indigo, matching X). */
  accent: '#4F46E5',
  accentText: '#FFFFFF',

  draw: '#888F9C',
  danger: '#E5484D',
  overlay: 'rgba(21, 23, 28, 0.5)',
} as const;

/** Spacing scale (in px / RN units). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Corner radii. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  /** Stacks; the apps may swap in a custom font and keep these as fallbacks. */
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontFamilyMono: "'SF Mono', ui-monospace, Menlo, Consolas, monospace",
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 40,
    display: 56,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

/** Motion — durations in ms and a shared easing curve. */
export const motion = {
  fast: 120,
  base: 180,
  slow: 260,
  /** Standard ease-out; usable in CSS transitions and RN Easing.bezier. */
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easingBezier: [0.4, 0, 0.2, 1] as const,
} as const;

/** Soft elevation. Web uses `boxShadow`; native uses the shadow* / elevation fields. */
export const shadow = {
  card: {
    boxShadow: '0 1px 2px rgba(20, 22, 30, 0.05), 0 10px 30px rgba(20, 22, 30, 0.07)',
    shadowColor: '#0F1117',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  active: {
    boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.20), 0 10px 28px rgba(79, 70, 229, 0.16)',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export const theme = {
  palette,
  space,
  radius,
  typography,
  motion,
  shadow,
} as const;

export type Theme = typeof theme;
