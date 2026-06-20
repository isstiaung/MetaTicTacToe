import { memo } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import { palette, typography } from '@mtt/theme';
import type { Player } from '@mtt/engine';

interface MarkProps {
  player: Player;
  /** Font size of the glyph. */
  size: number;
  /** Optional opacity (used for finished-board ghost glyphs). */
  opacity?: number;
  color?: string;
}

/** A single bold X / O glyph in the player's colour. */
function MarkImpl({ player, size, opacity = 1, color }: MarkProps) {
  const resolved = color ?? (player === 'X' ? palette.x : palette.o);
  const style: TextStyle = {
    fontSize: size,
    lineHeight: size * 1.05,
    color: resolved,
    opacity,
  };
  return (
    <Text style={[styles.glyph, style]} allowFontScaling={false}>
      {player}
    </Text>
  );
}

const styles = StyleSheet.create({
  glyph: {
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export const Mark = memo(MarkImpl);
