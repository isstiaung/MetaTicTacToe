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
