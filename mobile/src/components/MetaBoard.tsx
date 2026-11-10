// SPDX-License-Identifier: MIT

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@mtt/theme';
import { allowedBoards, type GameState } from '@mtt/engine';
import { SubBoardView } from './SubBoardView';

interface MetaBoardProps {
  state: GameState;
  /** Total width available for the whole meta board. */
  width: number;
  onPressCell: (board: number, cell: number) => void;
}

const GUTTER = space.sm;

function MetaBoardImpl({ state, width, onPressCell }: MetaBoardProps) {
  const subSize = (width - GUTTER * 2) / 3;
  const allowed = allowedBoards(state);
  const allowedSet = new Set(allowed);

  // Free-move (activeBoard === null) highlights every playable board; otherwise
  // only the single routed board is "active". When the game is over, nothing is.
  const gameOver = state.winner !== null;
  const freeMove = state.activeBoard === null;

  return (
    <View style={[styles.meta, { width }]}>
      {state.boards.map((sub, i) => {
        const isAllowed = allowedSet.has(i);
        const active = !gameOver && isAllowed && (freeMove || state.activeBoard === i);
        // Dim boards that aren't playable while the game is ongoing.
        const dimmed = !gameOver && !isAllowed && sub.winner === null;
        const lastMoveCell =
          state.lastMove && state.lastMove.board === i ? state.lastMove.cell : null;
        return (
          <SubBoardView
            key={i}
            boardIndex={i}
            cells={sub.cells}
            winner={sub.winner}
            active={active}
            dimmed={dimmed}
            lastMoveCell={lastMoveCell}
            size={subSize}
            onPressCell={onPressCell}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
    rowGap: GUTTER,
  },
});

export const MetaBoard = memo(MetaBoardImpl);
