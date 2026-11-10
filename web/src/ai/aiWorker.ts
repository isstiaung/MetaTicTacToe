// SPDX-License-Identifier: MIT

/** Web Worker entry: computes one AI move per request, off the main thread (see `aiClient.ts`). */
import { chooseAiMove } from '@mtt/engine';
import type { AiRequest, AiResponse } from './aiClient';

self.onmessage = (event: MessageEvent<AiRequest>) => {
  const { id, state, difficulty } = event.data;
  const reply: AiResponse = { id, move: chooseAiMove(state, difficulty) };
  self.postMessage(reply);
};
