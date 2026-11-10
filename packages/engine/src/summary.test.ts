// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import { createGame } from './engine';
import { boardScore, gameSummaryText } from './summary';
import type { GameState } from './types';

/** A state with some sub-boards already decided. */
function decided(): GameState {
  const s = createGame();
  s.boards[0].winner = 'X';
  s.boards[1].winner = 'X';
  s.boards[4].winner = 'O';
  s.boards[8].winner = 'draw';
  return s;
}

describe('boardScore', () => {
  it('is all-zero for a fresh game', () => {
    expect(boardScore(createGame())).toEqual({ X: 0, O: 0, draw: 0 });
  });

  it('counts won and drawn sub-boards', () => {
    expect(boardScore(decided())).toEqual({ X: 2, O: 1, draw: 1 });
  });
});

describe('gameSummaryText', () => {
  it('includes the result, score, and an emoji 3x3 grid', () => {
    const s = decided();
    s.winner = 'X';
    const text = gameSummaryText(s, { url: 'https://example.com' });
    expect(text).toContain('Meta Tic-Tac-Toe');
    expect(text).toContain('X (X) wins!');
    expect(text).toContain('Boards won — ❌ 2  ⭕ 1');
    expect(text).toContain('https://example.com');
    // Emoji grid: 0,1 = X (❌), 4 = O (⭕), 8 = draw (⬜), rest unclaimed (⬛).
    expect(text).toContain('❌❌⬛\n⬛⭕⬛\n⬛⬛⬜');
    // No ASCII grid separators anymore.
    expect(text).not.toMatch(/\|/);
  });

  it('uses player display names when provided', () => {
    const s = decided();
    s.winner = 'O';
    const text = gameSummaryText(s, { players: { X: 'Alice', O: 'Bob' } });
    expect(text).toContain('Bob (O) wins!');
  });

  it('reports a draw', () => {
    const s = createGame();
    s.winner = 'draw';
    expect(gameSummaryText(s)).toContain("It's a draw!");
  });
});
