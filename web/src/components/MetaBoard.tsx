// SPDX-License-Identifier: GPL-3.0-or-later

import { useMemo } from 'react';
import type { GameState } from '@mtt/engine';
import { allowedBoards } from '@mtt/engine';
import { SubBoard } from './SubBoard';

interface MetaBoardProps {
  state: GameState;
  /** When true, all interaction is blocked (AI thinking or game finished). */
  locked: boolean;
  onPlay: (board: number, cell: number) => void;
}

export function MetaBoard({ state, locked, onPlay }: MetaBoardProps) {
  // The set of boards a move may legally land in right now.
  const allowed = useMemo(() => new Set(allowedBoards(state)), [state]);

  // A single forced board (the active-board ring) vs. the free-move case where
  // every unfinished board is allowed and nothing is singled out.
  const forcedBoard =
    state.activeBoard !== null && allowed.has(state.activeBoard) ? state.activeBoard : null;

  return (
    <div className="metaboard" data-busy={locked} aria-label="Meta board" role="grid">
      {state.boards.map((board, i) => (
        <SubBoard
          key={i}
          board={board}
          boardIndex={i}
          active={forcedBoard === i}
          playable={allowed.has(i)}
          locked={locked}
          lastMove={state.lastMove}
          onPlay={onPlay}
        />
      ))}
    </div>
  );
}
