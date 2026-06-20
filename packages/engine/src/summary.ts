import type { GameState } from './types';

export interface BoardScore {
  /** Sub-boards claimed by X on the meta board. */
  X: number;
  /** Sub-boards claimed by O. */
  O: number;
  /** Sub-boards that ended in a draw (claimed by neither). */
  draw: number;
}

/** Count how many sub-boards each player has won (the meta-board score). */
export function boardScore(state: GameState): BoardScore {
  const score: BoardScore = { X: 0, O: 0, draw: 0 };
  for (const b of state.boards) {
    if (b.winner === 'X') score.X += 1;
    else if (b.winner === 'O') score.O += 1;
    else if (b.winner === 'draw') score.draw += 1;
  }
  return score;
}

export interface SummaryOptions {
  /** Display names for each seat; defaults to "X" / "O". */
  players?: { X?: string; O?: string };
  /** Optional link appended to the summary (e.g. the app URL). */
  url?: string;
}

const GLYPH: Record<'X' | 'O' | 'draw', string> = { X: 'X', O: 'O', draw: '–' };

/** A small ASCII rendering of the meta board (winner of each sub-board). */
function metaGridAscii(state: GameState): string {
  const cell = (i: number): string => {
    const w = state.boards[i].winner;
    return w ? GLYPH[w] : '·';
  };
  const rows: string[] = [];
  for (let r = 0; r < 3; r++) {
    rows.push(` ${cell(r * 3)} | ${cell(r * 3 + 1)} | ${cell(r * 3 + 2)} `);
  }
  return rows.join('\n-----------\n');
}

/**
 * A shareable, plain-text summary of a finished (or in-progress) game:
 * the result, the board-won score, and an ASCII snapshot of the meta board.
 * Both clients use this for the "Share" action.
 */
export function gameSummaryText(state: GameState, opts: SummaryOptions = {}): string {
  const score = boardScore(state);
  const nameX = opts.players?.X?.trim() || 'X';
  const nameO = opts.players?.O?.trim() || 'O';

  let result: string;
  if (state.winner === 'X') result = `${nameX} (X) wins!`;
  else if (state.winner === 'O') result = `${nameO} (O) wins!`;
  else if (state.winner === 'draw') result = "It's a draw!";
  else result = 'Game in progress';

  const lines = [
    'Meta Tic-Tac-Toe',
    result,
    `Boards won — X: ${score.X}  O: ${score.O}`,
    '',
    metaGridAscii(state),
  ];
  if (opts.url) lines.push('', opts.url);
  return lines.join('\n');
}
