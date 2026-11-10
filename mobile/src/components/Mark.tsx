// SPDX-License-Identifier: MIT

import { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, type TextStyle } from 'react-native';
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

/**
 * A single bold X / O glyph in the player's colour. Pops in with a spring on mount —
 * since a cell only mounts a Mark when it's newly claimed, this animates exactly the
 * just-placed marks (parity with the web's cell-placement transition).
 */
function MarkImpl({ player, size, opacity = 1, color }: MarkProps) {
  const resolved = color ?? (player === 'X' ? palette.x : palette.o);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  }, [anim]);

  const style = {
    fontSize: size,
    lineHeight: size * 1.05,
    color: resolved,
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, opacity] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
  };

  return (
    <Animated.Text style={[styles.glyph, style]} allowFontScaling={false}>
      {player}
    </Animated.Text>
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
