// SPDX-License-Identifier: GPL-3.0-or-later

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
} from './engine';

export { chooseAiMove } from './ai';

export { boardScore, gameSummaryText } from './summary';
export type { BoardScore, SummaryOptions } from './summary';
