// SPDX-License-Identifier: GPL-3.0-or-later

import { applyMove, getLegalMoves, LINES, metaCells, other } from './engine';
import type { Difficulty, GameState, Move, Player } from './types';

const WIN_SCORE = 1_000_000;

/** Positional weights (center is most valuable, then corners, then edges). */
const POS_WEIGHT = [3, 2, 3, 2, 4, 2, 3, 2, 3];

/** Count lines where `me` has two marks and the third is empty (an open threat). */
function lineThreats(cells: (Player | null)[], me: Player): number {
  const opp = other(me);
  let n = 0;
  for (const [a, b, c] of LINES) {
    const trio = [cells[a], cells[b], cells[c]];
    const mine = trio.filter((v) => v === me).length;
    const theirs = trio.filter((v) => v === opp).length;
    if (theirs === 0 && mine === 2) n += 1;
  }
  return n;
}

/** Heuristic evaluation of a state from `me`'s perspective. */
function evaluate(state: GameState, me: Player): number {
  if (state.winner === me) return WIN_SCORE;
  if (state.winner && state.winner !== 'draw') return -WIN_SCORE;
  if (state.winner === 'draw') return 0;

  const opp = other(me);
  let score = 0;

  state.boards.forEach((b, i) => {
    if (b.winner === me) score += 10 * POS_WEIGHT[i];
    else if (b.winner === opp) score -= 10 * POS_WEIGHT[i];
    else if (b.winner === null) {
      score += lineThreats(b.cells, me) * 2;
      score -= lineThreats(b.cells, opp) * 2;
    }
  });

  // Threats on the meta board matter far more than within a single sub-board.
  const meta = metaCells(state) as (Player | null)[];
  score += lineThreats(meta, me) * 30;
  score -= lineThreats(meta, opp) * 30;

  return score;
}

/** Order moves by positional value to make alpha-beta pruning more effective. */
function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort(
    (a, b) =>
      POS_WEIGHT[b.board] + POS_WEIGHT[b.cell] - (POS_WEIGHT[a.board] + POS_WEIGHT[a.cell]),
  );
}

interface SearchCtx {
  nodes: number;
  budget: number;
  me: Player;
}

/** Minimax with alpha-beta pruning, bounded by depth and a node budget. */
function search(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchCtx,
): number {
  ctx.nodes += 1;
  if (state.winner || depth === 0 || ctx.nodes > ctx.budget) {
    return evaluate(state, ctx.me);
  }

  const moves = orderMoves(getLegalMoves(state));
  const maximizing = state.currentPlayer === ctx.me;

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(applyMove(state, m.board, m.cell), depth - 1, alpha, beta, ctx));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }

  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(applyMove(state, m.board, m.cell), depth - 1, alpha, beta, ctx));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Choose a move for the current player.
 *
 * - `easy`  — mostly random among legal moves (but always grabs an immediate win). Beatable.
 * - `hard`  — depth-limited minimax with alpha-beta and a node budget, so moves stay snappy.
 *
 * Returns `null` only when there are no legal moves (the game is over). `rng` is injectable
 * for deterministic testing.
 */
export function chooseAiMove(
  state: GameState,
  difficulty: Difficulty = 'hard',
  rng: () => number = Math.random,
): Move | null {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return null;

  const me = state.currentPlayer;

  // Always take an immediate game-winning move, regardless of difficulty.
  for (const m of moves) {
    if (applyMove(state, m.board, m.cell).winner === me) return m;
  }

  if (difficulty === 'easy') {
    return moves[Math.floor(rng() * moves.length)];
  }

  // hard: search from each root move and keep the best.
  const ctx: SearchCtx = { nodes: 0, budget: 60_000, me };
  const ordered = orderMoves(moves);
  // Search shallower when the branching factor is wide (free-move / early game).
  const depth = ordered.length > 24 ? 4 : 6;

  let best = ordered[0];
  let bestVal = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const m of ordered) {
    const val = search(applyMove(state, m.board, m.cell), depth - 1, alpha, beta, ctx);
    if (val > bestVal) {
      bestVal = val;
      best = m;
    }
    alpha = Math.max(alpha, bestVal);
  }
  return best;
}
