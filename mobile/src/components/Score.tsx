import { memo } from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';
import { palette, radius, space, typography } from '@mtt/theme';
import { boardScore, type GameState } from '@mtt/engine';

interface ScoreProps {
  state: GameState;
}

/**
 * Compact meta-board score readout: how many sub-boards X and O have each won.
 * X in the indigo accent, O in emerald — consistent across all game modes.
 */
function ScoreImpl({ state }: ScoreProps) {
  const score = boardScore(state);
  return (
    <View style={styles.row}>
      <View style={styles.seat}>
        <Text style={[styles.label, { color: palette.x }]} allowFontScaling={false}>
          X
        </Text>
        <Text style={[styles.value, { color: palette.x }]} allowFontScaling={false}>
          {score.X}
        </Text>
      </View>
      <Text style={styles.divider} allowFontScaling={false}>
        ·
      </Text>
      <View style={styles.seat}>
        <Text style={[styles.label, { color: palette.o }]} allowFontScaling={false}>
          O
        </Text>
        <Text style={[styles.value, { color: palette.o }]} allowFontScaling={false}>
          {score.O}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceAlt,
  },
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
  },
  value: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
  },
  divider: {
    fontSize: typography.size.sm,
    color: palette.muted,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
  },
});

export const Score = memo(ScoreImpl);
