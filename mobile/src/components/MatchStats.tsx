// SPDX-License-Identifier: MIT

import { StyleSheet, Text, type TextStyle, View } from 'react-native';
import type { GameState, Player } from '@mtt/engine';
import { boardScore, isFinished, LINES, metaCells } from '@mtt/engine';
import { palette, radius, space, typography } from '@mtt/theme';

interface MatchStatsProps {
  state: GameState;
  /** Display names per seat (online play). Omitted for local play. */
  names?: { X?: string; O?: string };
  /** The viewer's own seat, if any (online) — tags their column with "(You)". */
  you?: Player | null;
}

interface SeatStats {
  boardsWon: number;
  territory: number;
  control: number;
  matchPoints: number;
}

/**
 * Derived purely from the *current* board (no move history), so it works identically
 * for local and online play. Reuses the engine's primitives rather than re-deriving
 * any rules — a direct port of the web MatchStats computation.
 */
function computeStats(state: GameState): { X: SeatStats; O: SeatStats } {
  const score = boardScore(state);
  const meta = metaCells(state);

  const territory = { X: 0, O: 0 };
  const control = { X: 0, O: 0 };
  for (const b of state.boards) {
    let x = 0;
    let o = 0;
    for (const c of b.cells) {
      if (c === 'X') x += 1;
      else if (c === 'O') o += 1;
    }
    territory.X += x;
    territory.O += o;
    if (!isFinished(b)) {
      if (x > o) control.X += 1;
      else if (o > x) control.O += 1;
    }
  }

  const matchPoints = { X: 0, O: 0 };
  for (const line of LINES) {
    const winnable = line.filter((i) => meta[i] === null && !isFinished(state.boards[i]));
    if (winnable.length !== 1) continue;
    if (line.filter((i) => meta[i] === 'X').length === 2) matchPoints.X += 1;
    if (line.filter((i) => meta[i] === 'O').length === 2) matchPoints.O += 1;
  }

  return {
    X: { boardsWon: score.X, territory: territory.X, control: control.X, matchPoints: matchPoints.X },
    O: { boardsWon: score.O, territory: territory.O, control: control.O, matchPoints: matchPoints.O },
  };
}

/**
 * A compact, live readout of the current match for each player — boards won,
 * territory (cells claimed), board control, and "match points" (lines one win
 * from victory). Recomputes from `state` every render, so it stays live.
 */
export function MatchStats({ state, names, you }: MatchStatsProps) {
  const stats = computeStats(state);
  const nameX = names?.X?.trim() || 'X';
  const nameO = names?.O?.trim() || 'O';

  const rows = [
    { key: 'won', label: 'Boards won', hint: null, x: stats.X.boardsWon, o: stats.O.boardsWon },
    { key: 'territory', label: 'Territory', hint: 'cells claimed', x: stats.X.territory, o: stats.O.territory },
    { key: 'control', label: 'Board control', hint: 'boards leading', x: stats.X.control, o: stats.O.control },
    { key: 'mp', label: 'Match points', hint: 'a line away', x: stats.X.matchPoints, o: stats.O.matchPoints },
  ] as const;

  return (
    <View style={styles.card} accessibilityLabel="Match statistics">
      <Text style={styles.title} allowFontScaling={false}>
        This match
      </Text>

      {/* Header row: X / O marks + optional names */}
      <View style={styles.row}>
        <View style={styles.metricCol} />
        <View style={styles.valueCol}>
          <Text style={[styles.headMark, { color: palette.x }]} allowFontScaling={false}>
            X
          </Text>
          {names?.X ? (
            <Text style={styles.headName} numberOfLines={1} allowFontScaling={false}>
              {nameX}
              {you === 'X' ? ' (You)' : ''}
            </Text>
          ) : null}
        </View>
        <View style={styles.valueCol}>
          <Text style={[styles.headMark, { color: palette.o }]} allowFontScaling={false}>
            O
          </Text>
          {names?.O ? (
            <Text style={styles.headName} numberOfLines={1} allowFontScaling={false}>
              {nameO}
              {you === 'O' ? ' (You)' : ''}
            </Text>
          ) : null}
        </View>
      </View>

      {rows.map((r) => {
        const mpX = r.key === 'mp' && r.x > 0;
        const mpO = r.key === 'mp' && r.o > 0;
        return (
          <View style={styles.row} key={r.key}>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel} allowFontScaling={false}>
                {r.label}
              </Text>
              {r.hint ? (
                <Text style={styles.metricHint} allowFontScaling={false}>
                  {r.hint}
                </Text>
              ) : null}
            </View>
            <Text
              style={[styles.value, { color: palette.x }, mpX && styles.valueMp]}
              allowFontScaling={false}
            >
              {r.x}
            </Text>
            <Text
              style={[styles.value, { color: palette.o }, mpO && styles.valueMp]}
              allowFontScaling={false}
            >
              {r.o}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.xs,
  },
  title: {
    fontSize: typography.size.xs,
    color: palette.muted,
    fontWeight: typography.weight.semibold as TextStyle['fontWeight'],
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  metricCol: {
    flex: 1,
  },
  metricLabel: {
    fontSize: typography.size.sm,
    color: palette.ink,
    fontWeight: typography.weight.medium as TextStyle['fontWeight'],
  },
  metricHint: {
    fontSize: typography.size.xs,
    color: palette.muted,
  },
  valueCol: {
    width: 64,
    alignItems: 'center',
  },
  headMark: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
  },
  headName: {
    fontSize: typography.size.xs,
    color: palette.muted,
    maxWidth: 64,
  },
  value: {
    width: 64,
    textAlign: 'center',
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    fontVariant: ['tabular-nums'],
  },
  valueMp: {
    // "Match point" emphasis — a line away from winning.
    color: palette.accent,
  },
});
