// SPDX-License-Identifier: MIT

import { memo } from 'react';
import type { SubBoard as SubBoardState, Move } from '@mtt/engine';
import { isFinished } from '@mtt/engine';
import { Cell } from './Cell';
import { cn } from '../theme';

interface SubBoardProps {
  board: SubBoardState;
  boardIndex: number;
  /** Is this the (only) board the current player must play in? */
  active: boolean;
  /** Is this board currently playable at all (used to dim non-playable ones)? */
  playable: boolean;
  /** Disable interaction (e.g. while the AI is thinking, or game over). */
  locked: boolean;
  lastMove: Move | null;
  onPlay: (board: number, cell: number) => void;
}

function SubBoardBase({
  board,
  boardIndex,
  active,
  playable,
  locked,
  lastMove,
  onPlay,
}: SubBoardProps) {
  const finished = isFinished(board);
  const winner = board.winner;

  return (
    <div
      className={cn(
        'subboard',
        active && !locked && 'subboard--active',
        !playable && !finished && 'subboard--dim',
        finished && 'subboard--finished',
      )}
      role="group"
      aria-label={`Sub-board ${boardIndex + 1}`}
    >
      {board.cells.map((value, cell) => {
        const cellPlayable = playable && !locked && value === null;
        const isLast = lastMove?.board === boardIndex && lastMove?.cell === cell;
        const state = value ? `${value} placed here` : cellPlayable ? 'empty, playable' : 'empty';
        return (
          <Cell
            key={cell}
            value={value}
            playable={cellPlayable}
            isLast={isLast}
            label={`Sub-board ${boardIndex + 1}, cell ${cell + 1}, ${state}`}
            onPlay={() => onPlay(boardIndex, cell)}
          />
        );
      })}

      {finished && winner && (
        <span
          className={cn(
            'subboard__claim',
            winner === 'X' && 'subboard__claim--X',
            winner === 'O' && 'subboard__claim--O',
            winner === 'draw' && 'subboard__claim--draw',
          )}
          aria-hidden="true"
        >
          {winner === 'draw' ? 'Draw' : winner}
        </span>
      )}
    </div>
  );
}

export const SubBoard = memo(SubBoardBase);
