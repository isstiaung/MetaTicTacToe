// SPDX-License-Identifier: GPL-3.0-or-later

import { applyMove, getLegalMoves, LINES, metaCells, other } from './engine';
import type { Difficulty, GameState, Move, Player } from './types';

const WIN_SCORE = 1_000_000;

/** Deepest iteration the hard AI attempts (it usually stops earlier on the search limits). */
const MAX_DEPTH = 10;

/** Positional weights (center is most valuable, then corners, then edges). */
const POS_WEIGHT = [3, 2, 3, 2, 4, 2, 3, 2, 3];

/** Bounds on the `hard` search. Whichever runs out first ends it. */
export interface AiLimits {
  /** Maximum positions visited per move (deterministic). Default 100,000. */
  maxNodes?: number;
  /**
   * Wall-clock cap per move in ms, so slow devices stay responsive. Default 250.
   * Pass `Infinity` for fully deterministic play (e.g. in tests).
   */
  maxTimeMs?: number;
}

const DEFAULT_MAX_NODES = 100_000;
const DEFAULT_MAX_TIME_MS = 250;

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

/**
 * Heuristic evaluation of a state from `me`'s perspective. Wins and losses are
 * offset by `ply` so the search prefers the quickest win and the slowest loss.
 */
function evaluate(state: GameState, me: Player, ply: number): number {
  if (state.winner === me) return WIN_SCORE - ply;
  if (state.winner && state.winner !== 'draw') return -WIN_SCORE + ply;
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
  maxNodes: number;
  /** Epoch-ms after which the search gives up. */
  deadline: number;
  me: Player;
  /** Set once a limit is hit; every value computed after that is meaningless. */
  aborted: boolean;
}

/** Minimax with alpha-beta pruning. Sets `ctx.aborted` (and returns junk) once a limit is hit. */
function search(
  state: GameState,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
  ctx: SearchCtx,
): number {
  if (ctx.aborted) return 0;
  ctx.nodes += 1;
  // Check the clock only every 1024 nodes — Date.now() is not free.
  if (ctx.nodes > ctx.maxNodes || ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline)) {
    ctx.aborted = true;
    return 0;
  }
  if (state.winner || depth === 0) {
    return evaluate(state, ctx.me, ply);
  }

  const moves = orderMoves(getLegalMoves(state));
  const maximizing = state.currentPlayer === ctx.me;

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(
        best,
        search(applyMove(state, m.board, m.cell), depth - 1, ply + 1, alpha, beta, ctx),
      );
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }

  let best = Infinity;
  for (const m of moves) {
    best = Math.min(
      best,
      search(applyMove(state, m.board, m.cell), depth - 1, ply + 1, alpha, beta, ctx),
    );
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Choose a move for the current player.
 *
 * - `easy`  — mostly random among legal moves (but always grabs an immediate win). Beatable.
 * - `hard`  — iterative-deepening minimax with alpha-beta: every candidate move is searched to
 *   depth 1, then all to depth 2, and so on until a {@link AiLimits limit} runs out. The move
 *   from the deepest *completed* depth is played, so candidates are always compared at equal
 *   depth and the search stays fast on any device.
 *
 * Returns `null` only when there are no legal moves (the game is over). `rng` is injectable
 * for deterministic testing.
 */
export function chooseAiMove(
  state: GameState,
  difficulty: Difficulty = 'hard',
  rng: () => number = Math.random,
  limits: AiLimits = {},
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

  const ctx: SearchCtx = {
    nodes: 0,
    maxNodes: limits.maxNodes ?? DEFAULT_MAX_NODES,
    deadline: Date.now() + (limits.maxTimeMs ?? DEFAULT_MAX_TIME_MS),
    me,
    aborted: false,
  };

  let ordered = orderMoves(moves);
  let best = ordered[0];

  for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
    let iterBest = ordered[0];
    let iterVal = -Infinity;
    let alpha = -Infinity;

    for (const m of ordered) {
      const val = search(applyMove(state, m.board, m.cell), depth - 1, 1, alpha, Infinity, ctx);
      if (ctx.aborted) break;
      if (val > iterVal) {
        iterVal = val;
        iterBest = m;
      }
      alpha = Math.max(alpha, iterVal);
    }

    // An interrupted iteration compared moves at unequal depths — discard it.
    if (ctx.aborted) break;
    best = iterBest;
    // A forced win is already found; deeper search can't improve on it.
    if (iterVal >= WIN_SCORE - MAX_DEPTH) break;
    // Search the current best first next time: tighter alpha-beta bounds, faster iterations.
    ordered = [iterBest, ...ordered.filter((m) => m !== iterBest)];
  }

  return best;
}
