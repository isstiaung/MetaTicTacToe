// SPDX-License-Identifier: MIT

import { Fragment } from 'react';
import type { GameState, Player } from '@mtt/engine';
import { boardScore, isFinished, LINES, metaCells } from '@mtt/engine';
import { cn } from '../theme';

interface MatchStatsProps {
  state: GameState;
  /** Display names per seat (online play). Omitted for local play. */
  names?: { X?: string; O?: string };
  /** The viewer's own seat, if any (online) — tags their column with "(You)". */
  you?: Player | null;
}

interface SeatStats {
  /** Sub-boards won on the meta board. */
  boardsWon: number;
  /** Total cells claimed across all sub-boards (also each player's move count). */
  territory: number;
  /** Unfinished sub-boards where this player currently has more marks. */
  control: number;
  /** Meta lines with two claimed and the third still winnable — one win from victory. */
  matchPoints: number;
}

/**
 * Everything here is derived purely from the *current* board — no move history,
 * so it works identically for local and online play (online clients hold the
 * full broadcast `state`). Reuses the engine's primitives rather than
 * re-deriving any rules.
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
    // "Control" only counts boards still in play — a finished board is settled.
    if (!isFinished(b)) {
      if (x > o) control.X += 1;
      else if (o > x) control.O += 1;
    }
  }

  const matchPoints = { X: 0, O: 0 };
  for (const line of LINES) {
    // The line is a one-move threat only if exactly one cell is still winnable
    // (in progress — a drawn board reads null on the meta board but is finished).
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
    <section className="stats" aria-label="Match statistics">
      <div className="stats__title">This match</div>
      <div className="stats__grid">
        <span className="stats__metric" aria-hidden="true" />
        <span className="stats__head stats__val--X" aria-hidden="true">
          <span className="score__mark">X</span>
          {names?.X && (
            <span className="stats__name">
              {nameX}
              {you === 'X' && <span className="stats__you"> (You)</span>}
            </span>
          )}
        </span>
        <span className="stats__head stats__val--O" aria-hidden="true">
          <span className="score__mark">O</span>
          {names?.O && (
            <span className="stats__name">
              {nameO}
              {you === 'O' && <span className="stats__you"> (You)</span>}
            </span>
          )}
        </span>

        {rows.map((r) => {
          const mpX = r.key === 'mp' && r.x > 0;
          const mpO = r.key === 'mp' && r.o > 0;
          return (
            <Fragment key={r.key}>
              <span className="stats__metric" aria-hidden="true">
                {r.label}
                {r.hint && <span className="stats__hint">{r.hint}</span>}
              </span>
              <span
                className={cn('stats__val stats__val--X', mpX && 'stats__val--mp')}
                aria-label={`${nameX} ${r.label}: ${r.x}`}
              >
                {r.x}
              </span>
              <span
                className={cn('stats__val stats__val--O', mpO && 'stats__val--mp')}
                aria-label={`${nameO} ${r.label}: ${r.o}`}
              >
                {r.o}
              </span>
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
