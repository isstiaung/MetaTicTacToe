// SPDX-License-Identifier: GPL-3.0-or-later

import { memo, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { motion, palette, radius, shadow, space } from '@mtt/theme';
import type { Cell, Move, Outcome, Player } from '@mtt/engine';
import { Mark } from './Mark';

interface SubBoardViewProps {
  boardIndex: number;
  cells: Cell[];
  winner: Outcome;
  /** This board is currently playable. */
  active: boolean;
  /** A move can be played somewhere, but not in this board. */
  dimmed: boolean;
  /** Cell index of the last move if it landed in this board, else null. */
  lastMoveCell: number | null;
  size: number;
  onPressCell: (board: number, cell: number) => void;
}

const CELL_GAP = 2;
const PADDING = space.xs;

function SubBoardViewImpl({
  boardIndex,
  cells,
  winner,
  active,
  dimmed,
  lastMoveCell,
  size,
  onPressCell,
}: SubBoardViewProps) {
  const finished = winner !== null;
  const cellGlyph = (size - PADDING * 2 - CELL_GAP * 2) / 3;

  // Animate the accent emphasis when a board becomes active.
  const emphasis = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(emphasis, {
      toValue: active ? 1 : 0,
      duration: motion.base,
      easing: Easing.bezier(...motion.easingBezier),
      useNativeDriver: false,
    }).start();
  }, [active, emphasis]);

  const cardStyle: ViewStyle = {
    width: size,
    height: size,
    padding: PADDING,
    borderRadius: radius.md,
    backgroundColor: finished ? palette.surfaceAlt : palette.surface,
    opacity: dimmed ? 0.45 : 1,
    borderWidth: 2,
    borderColor: active ? palette.accent : palette.line,
  };

  const shadowStyle = active ? shadow.active : shadow.card;

  return (
    <Animated.View
      style={[
        cardStyle,
        {
          shadowColor: shadowStyle.shadowColor,
          shadowOpacity: shadowStyle.shadowOpacity,
          shadowRadius: shadowStyle.shadowRadius,
          shadowOffset: shadowStyle.shadowOffset,
          elevation: shadowStyle.elevation,
          transform: [
            {
              scale: emphasis.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.015],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.grid}>
        {cells.map((cell, i) => {
          const isLast = i === lastMoveCell;
          const playable = active && !finished && cell === null;
          return (
            <Pressable
              key={i}
              disabled={!playable}
              onPress={() => onPressCell(boardIndex, i)}
              style={({ pressed }) => [
                styles.cell,
                {
                  width: cellGlyph,
                  height: cellGlyph,
                  backgroundColor: isLast
                    ? cell === 'X'
                      ? palette.xSoft
                      : palette.oSoft
                    : 'transparent',
                  opacity: pressed && playable ? 0.6 : 1,
                },
              ]}
            >
              {cell && <Mark player={cell as Player} size={cellGlyph * 0.62} />}
            </Pressable>
          );
        })}
      </View>

      {finished && winner !== 'draw' && (
        <View pointerEvents="none" style={styles.ghost}>
          <Mark player={winner as Player} size={size * 0.62} opacity={0.32} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  ghost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const SubBoardView = memo(SubBoardViewImpl);
