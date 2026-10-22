// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Runs the engine's AI in a Web Worker (`aiWorker.ts`) so a `hard` search never blocks clicks,
 * painting or animation on the main thread. Falls back to computing on the main thread when
 * workers are unavailable or the worker fails to load.
 */
import { chooseAiMove } from '@mtt/engine';
import type { Difficulty, GameState, Move } from '@mtt/engine';

export interface AiRequest {
  id: number;
  state: GameState;
  difficulty: Difficulty;
}

export interface AiResponse {
  id: number;
  move: Move | null;
}

interface Pending {
  resolve: (move: Move | null) => void;
  state: GameState;
  difficulty: Difficulty;
}

/** `undefined` = not started yet; `null` = unavailable (use the main thread). */
let worker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<number, Pending>();

/** Finish every outstanding request on the main thread and stop using the worker. */
function abandonWorker(): void {
  worker?.terminate();
  worker = null;
  for (const { resolve, state, difficulty } of pending.values()) {
    resolve(chooseAiMove(state, difficulty));
  }
  pending.clear();
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<AiResponse>) => {
      const request = pending.get(event.data.id);
      pending.delete(event.data.id);
      request?.resolve(event.data.move);
    };
    worker.onerror = abandonWorker;
  } catch {
    worker = null;
  }
  return worker;
}

/** The AI's move for `state` (the current player), or `null` if the game is over. */
export function requestAiMove(state: GameState, difficulty: Difficulty): Promise<Move | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(chooseAiMove(state, difficulty));
  return new Promise((resolve) => {
    nextId += 1;
    pending.set(nextId, { resolve, state, difficulty });
    const request: AiRequest = { id: nextId, state, difficulty };
    w.postMessage(request);
  });
}
