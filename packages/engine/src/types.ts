// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Core types for Ultimate / Meta Tic-Tac-Toe.
 *
 * Indexing convention (matches the original Android app, re-based to 0):
 * sub-boards and cells are numbered 0..8 in row-major order:
 *
 *   0 | 1 | 2
 *   --+---+--
 *   3 | 4 | 5
 *   --+---+--
 *   6 | 7 | 8
 */

export type Player = 'X' | 'O';

/** A single cell: a player's mark, or empty. */
export type Cell = Player | null;

/** Outcome of a sub-board or the meta-board: a winner, a draw, or still undecided. */
export type Outcome = Player | 'draw' | null;

export interface SubBoard {
  /** 9 cells, row-major (0..8). */
  cells: Cell[];
  /** `null` = ongoing, `'X'`/`'O'` = won, `'draw'` = full with no winner. */
  winner: Outcome;
}

export interface Move {
  /** Sub-board index, 0..8 (row-major). */
  board: number;
  /** Cell index within the sub-board, 0..8 (row-major). */
  cell: number;
}

export interface GameState {
  /** The nine sub-boards, row-major. */
  boards: SubBoard[];
  /** Whose turn it is. X always moves first. */
  currentPlayer: Player;
  /**
   * The sub-board the next move must be played in, or `null` to mean
   * "any unfinished board" (the free-move exception).
   */
  activeBoard: number | null;
  /** Meta result: `null` ongoing, `'X'`/`'O'` winner, or `'draw'`. */
  winner: Outcome;
  /** The most recent move, or `null` before any move. */
  lastMove: Move | null;
}

export type Difficulty = 'easy' | 'hard';
