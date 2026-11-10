// SPDX-License-Identifier: MIT

export type {
  Player,
  Cell,
  Outcome,
  SubBoard,
  Move,
  GameState,
  Difficulty,
} from './types';

export {
  LINES,
  other,
  lineWinner,
  outcomeOf,
  isFinished,
  createGame,
  allowedBoards,
  getLegalMoves,
  isLegalMove,
  metaCells,
  applyMove,
  forfeit,
} from './engine';

export { chooseAiMove } from './ai';
export type { AiLimits } from './ai';

export { boardScore, gameSummaryText } from './summary';
export type { BoardScore, SummaryOptions } from './summary';
