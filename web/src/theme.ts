// SPDX-License-Identifier: MIT

/**
 * Bridges the shared @mtt/theme tokens into CSS custom properties on :root,
 * so the stylesheet can reference them via var(--mtt-*) without re-declaring a
 * parallel palette. Call once at module load.
 */
import { palette, space, radius, typography, motion, shadow } from '@mtt/theme';

const vars: Record<string, string> = {
  '--mtt-bg': palette.bg,
  '--mtt-surface': palette.surface,
  '--mtt-surface-alt': palette.surfaceAlt,
  '--mtt-ink': palette.ink,
  '--mtt-ink-soft': palette.inkSoft,
  '--mtt-muted': palette.muted,
  '--mtt-line': palette.line,
  '--mtt-line-strong': palette.lineStrong,
  '--mtt-x': palette.x,
  '--mtt-x-soft': palette.xSoft,
  '--mtt-x-glow': palette.xGlow,
  '--mtt-o': palette.o,
  '--mtt-o-soft': palette.oSoft,
  '--mtt-o-glow': palette.oGlow,
  '--mtt-accent': palette.accent,
  '--mtt-accent-text': palette.accentText,
  '--mtt-draw': palette.draw,
  '--mtt-danger': palette.danger,
  '--mtt-overlay': palette.overlay,

  '--mtt-space-xs': `${space.xs}px`,
  '--mtt-space-sm': `${space.sm}px`,
  '--mtt-space-md': `${space.md}px`,
  '--mtt-space-lg': `${space.lg}px`,
  '--mtt-space-xl': `${space.xl}px`,
  '--mtt-space-xxl': `${space.xxl}px`,
  '--mtt-space-xxxl': `${space.xxxl}px`,

  '--mtt-radius-sm': `${radius.sm}px`,
  '--mtt-radius-md': `${radius.md}px`,
  '--mtt-radius-lg': `${radius.lg}px`,
  '--mtt-radius-xl': `${radius.xl}px`,
  '--mtt-radius-pill': `${radius.pill}px`,

  '--mtt-font': typography.fontFamily,
  '--mtt-size-xs': `${typography.size.xs}px`,
  '--mtt-size-sm': `${typography.size.sm}px`,
  '--mtt-size-md': `${typography.size.md}px`,
  '--mtt-size-lg': `${typography.size.lg}px`,
  '--mtt-size-xl': `${typography.size.xl}px`,
  '--mtt-size-xxl': `${typography.size.xxl}px`,
  '--mtt-size-display': `${typography.size.display}px`,

  '--mtt-fast': `${motion.fast}ms`,
  '--mtt-base': `${motion.base}ms`,
  '--mtt-slow': `${motion.slow}ms`,
  '--mtt-ease': motion.easing,

  '--mtt-shadow-card': shadow.card.boxShadow,
  '--mtt-shadow-active': shadow.active.boxShadow,
};

export function installThemeVars(): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

/** Tiny classnames helper: joins truthy strings. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
