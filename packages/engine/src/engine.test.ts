// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import {
  createGame,
  applyMove,
  getLegalMoves,
  allowedBoards,
  isLegalMove,
  lineWinner,
  metaCells,
  outcomeOf,
} from './engine';
import { chooseAiMove } from './ai';
import type { Cell, GameState } from './types';

function play(state: GameState, moves: [number, number][]): GameState {
  return moves.reduce((s, [b, c]) => applyMove(s, b, c), state);
}

describe('lineWinner', () => {
  it('detects a row', () => {
    expect(lineWinner(['X', 'X', 'X', null, null, null, null, null, null])).toBe('X');
  });
  it('detects a column', () => {
    expect(lineWinner(['O', null, null, 'O', null, null, 'O', null, null])).toBe('O');
  });
  it('detects a diagonal', () => {
    expect(lineWinner(['X', null, null, null, 'X', null, null, null, 'X'])).toBe('X');
  });
  it('returns null with no line', () => {
    expect(lineWinner(Array<Cell>(9).fill(null))).toBeNull();
    expect(lineWinner(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'])).toBeNull();
  });
});

describe('outcomeOf', () => {
  it('reports a draw when full with no winner', () => {
    expect(outcomeOf(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'])).toBe('draw');
  });
  it('reports ongoing when not full and no winner', () => {
    expect(outcomeOf(['X', 'O', null, null, null, null, null, null, null])).toBeNull();
  });
});

describe('createGame', () => {
  it('starts with X, no forced board, 81 legal moves', () => {
    const s = createGame();
    expect(s.currentPlayer).toBe('X');
    expect(s.activeBoard).toBeNull();
    expect(s.winner).toBeNull();
    expect(getLegalMoves(s)).toHaveLength(81);
  });
});

describe('routing', () => {
  it('sends the opponent to the board matching the played cell', () => {
    const s = applyMove(createGame(), 4, 0); // play center board, cell 0
    expect(s.currentPlayer).toBe('O');
    expect(s.activeBoard).toBe(0);
    const moves = getLegalMoves(s);
    expect(moves.every((m) => m.board === 0)).toBe(true);
    expect(moves).toHaveLength(9);
  });

  it('alternates players each move', () => {
    const s = play(createGame(), [
      [4, 0],
      [0, 4],
    ]);
    expect(s.currentPlayer).toBe('X');
    expect(s.lastMove).toEqual({ board: 0, cell: 4 });
  });

  it('frees the move (any board) when routed to a finished board', () => {
    const s = createGame();
    s.boards[0].winner = 'X'; // pretend board 0 is already won
    s.activeBoard = 0; // and we are routed there
    const allowed = allowedBoards(s);
    expect(allowed).not.toContain(0);
    expect(allowed).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('sub-board + meta wins', () => {
  it('a winning move claims the sub-board on the meta board', () => {
    const s = createGame();
    s.boards[0].cells = ['X', 'X', null, null, null, null, null, null, null];
    s.activeBoard = 0;
    const next = applyMove(s, 0, 2);
    expect(next.boards[0].winner).toBe('X');
    expect(metaCells(next)[0]).toBe('X');
  });

  it('three sub-boards in a row wins the game', () => {
    const s = createGame();
    s.boards[0].winner = 'X';
    s.boards[1].winner = 'X';
    s.boards[2].cells = ['X', 'X', null, null, null, null, null, null, null];
    s.activeBoard = 2;
    const next = applyMove(s, 2, 2); // completes board 2 -> meta row 0
    expect(next.boards[2].winner).toBe('X');
    expect(next.winner).toBe('X');
    expect(getLegalMoves(next)).toHaveLength(0);
  });

  it('declares a draw when all boards finish with no meta line', () => {
    // Cat's-game meta pattern: X X O / O O X / X X O has no line.
    const s = createGame();
    const metaWinners: ('X' | 'O')[] = ['X', 'X', 'O', 'O', 'O', 'X', 'X', 'X', 'O'];
    for (let i = 0; i < 8; i++) s.boards[i].winner = metaWinners[i];
    // Board 8 is one O-move (cell 2) away from completing its top row, no line yet.
    s.boards[8].cells = ['O', 'O', null, 'X', 'X', 'O', 'X', 'O', 'X'];
    s.currentPlayer = 'O';
    s.activeBoard = 8;
    const next = applyMove(s, 8, 2);
    expect(next.boards[8].winner).toBe('O');
    expect(next.winner).toBe('draw');
  });
});

describe('legality', () => {
  it('rejects playing outside the forced board', () => {
    const s = applyMove(createGame(), 4, 0); // forces board 0
    expect(isLegalMove(s, 1, 0)).toBe(false);
    expect(isLegalMove(s, 0, 1)).toBe(true);
  });
  it('rejects an occupied cell', () => {
    const s = createGame();
    expect(isLegalMove(applyMove(s, 4, 4), 4, 4)).toBe(false);
  });
  it('applyMove throws on an illegal move', () => {
    const s = applyMove(createGame(), 4, 0);
    expect(() => applyMove(s, 1, 0)).toThrow();
  });
});

describe('AI', () => {
  it('easy returns a legal move', () => {
    const s = createGame();
    const m = chooseAiMove(s, 'easy', () => 0)!;
    expect(getLegalMoves(s)).toContainEqual(m);
  });

  it('hard returns a legal move for a fresh game', () => {
    const s = createGame();
    const m = chooseAiMove(s, 'hard')!;
    expect(getLegalMoves(s)).toContainEqual(m);
  });

  it('takes an immediate winning move', () => {
    const s = createGame();
    s.boards[0].winner = 'X';
    s.boards[1].winner = 'X';
    s.boards[2].cells = ['X', 'X', null, null, null, null, null, null, null];
    s.activeBoard = 2;
    expect(chooseAiMove(s, 'hard')).toEqual({ board: 2, cell: 2 });
    expect(chooseAiMove(s, 'easy', () => 0.99)).toEqual({ board: 2, cell: 2 });
  });

  it('returns null when the game is over', () => {
    const s = createGame();
    s.winner = 'X';
    expect(chooseAiMove(s, 'hard')).toBeNull();
  });

  it('only ever produces legal moves across a full self-play game', () => {
    let s = createGame();
    let guard = 0;
    while (!s.winner && getLegalMoves(s).length > 0 && guard < 200) {
      const m = chooseAiMove(s, guard % 2 === 0 ? 'hard' : 'easy', () => 0.5)!;
      expect(isLegalMove(s, m.board, m.cell)).toBe(true);
      s = applyMove(s, m.board, m.cell);
      guard += 1;
    }
    expect(guard).toBeLessThan(200); // game terminates
  });
});
