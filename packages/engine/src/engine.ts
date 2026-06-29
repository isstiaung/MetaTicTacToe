// SPDX-License-Identifier: GPL-3.0-or-later

import type { Cell, GameState, Move, Outcome, Player, SubBoard } from './types';

/** The eight winning lines of a 3x3 grid (rows, columns, diagonals). */
export const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // columns
  [0, 4, 8],
  [2, 4, 6], // diagonals
];

export const other = (p: Player): Player => (p === 'X' ? 'O' : 'X');

/**
 * Winner of a 3x3 grid of cells by three-in-a-row, or `null`.
 * Direct port of `Board.isBoardWon()` from the Android app.
 */
export function lineWinner(cells: Cell[]): Player | null {
  for (const [a, b, c] of LINES) {
    const v = cells[a];
    if (v !== null && v === cells[b] && v === cells[c]) return v;
  }
  return null;
}

/** Full outcome of a 3x3 grid: a winner, a draw (full, no winner), or ongoing. */
export function outcomeOf(cells: Cell[]): Outcome {
  const w = lineWinner(cells);
  if (w) return w;
  return cells.every((c) => c !== null) ? 'draw' : null;
}

export const isFinished = (b: SubBoard): boolean => b.winner !== null;

/** A fresh game: empty boards, X to move, no forced board. */
export function createGame(): GameState {
  return {
    boards: Array.from({ length: 9 }, () => ({
      cells: Array<Cell>(9).fill(null),
      winner: null as Outcome,
    })),
    currentPlayer: 'X',
    activeBoard: null,
    winner: null,
    lastMove: null,
  };
}

/**
 * The sub-boards a move may legally be played in for the current state,
 * applying the routing rule and the free-move exception (if the routed
 * board is already finished, any unfinished board is allowed).
 */
export function allowedBoards(state: GameState): number[] {
  if (state.winner) return [];
  if (state.activeBoard !== null && !isFinished(state.boards[state.activeBoard])) {
    return [state.activeBoard];
  }
  return state.boards.map((_, i) => i).filter((i) => !isFinished(state.boards[i]));
}

/** Every legal move in the current state. Empty once the game is over. */
export function getLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (const b of allowedBoards(state)) {
    const cells = state.boards[b].cells;
    for (let i = 0; i < 9; i++) {
      if (cells[i] === null) moves.push({ board: b, cell: i });
    }
  }
  return moves;
}

export function isLegalMove(state: GameState, board: number, cell: number): boolean {
  if (state.winner) return false;
  if (board < 0 || board > 8 || cell < 0 || cell > 8) return false;
  if (!allowedBoards(state).includes(board)) return false;
  return state.boards[board].cells[cell] === null;
}

/** The meta board: one cell per sub-board (its winning player, or `null`). */
export function metaCells(state: GameState): Cell[] {
  return state.boards.map((b) => (b.winner === 'X' || b.winner === 'O' ? b.winner : null));
}

/**
 * Apply a move and return a new immutable state. Throws on an illegal move —
 * callers should gate on `isLegalMove` / `getLegalMoves`.
 */
export function applyMove(state: GameState, board: number, cell: number): GameState {
  if (!isLegalMove(state, board, cell)) {
    throw new Error(`Illegal move: board ${board}, cell ${cell}`);
  }

  const player = state.currentPlayer;

  // Copy only the touched board; other boards keep their reference.
  const boards = state.boards.map((b, i) =>
    i === board ? { cells: b.cells.slice(), winner: b.winner } : b,
  );
  boards[board].cells[cell] = player;
  boards[board].winner = outcomeOf(boards[board].cells);

  // Meta result from the sub-board winners.
  const meta: Cell[] = boards.map((b) =>
    b.winner === 'X' || b.winner === 'O' ? b.winner : null,
  );
  let winner: Outcome = lineWinner(meta);
  if (!winner && boards.every(isFinished)) winner = 'draw';

  // Routing: the opponent is sent to the board matching this move's cell.
  // If that board is already finished, they may play anywhere (activeBoard null).
  const nextActive = isFinished(boards[cell]) ? null : cell;

  return {
    boards,
    currentPlayer: other(player),
    activeBoard: winner ? null : nextActive,
    winner,
    lastMove: { board, cell },
  };
}
