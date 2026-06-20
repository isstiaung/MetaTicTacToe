import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import {
  applyMove,
  chooseAiMove,
  createGame,
  isLegalMove,
  type Difficulty,
  type GameState,
} from '@mtt/engine';

export type Mode = 'two-player' | 'vs-computer' | 'online';

/** Human is always X in vs-computer; the AI plays O. */
const AI_PLAYER = 'O';

interface UseGame {
  state: GameState;
  mode: Mode;
  difficulty: Difficulty;
  /** True while the AI move is being computed (taps are blocked). */
  thinking: boolean;
  /** Attempt to play a cell; ignored if illegal or while the AI is thinking. */
  play: (board: number, cell: number) => void;
  /** Reset to a fresh game in the same mode/difficulty. */
  newGame: () => void;
}

export function useGame(mode: Mode, difficulty: Difficulty): UseGame {
  const [state, setState] = useState<GameState>(createGame);
  const [thinking, setThinking] = useState(false);

  // Guard so a deferred AI move from a previous game can't land on a new one.
  const generation = useRef(0);

  const newGame = useCallback(() => {
    generation.current += 1;
    setThinking(false);
    setState(createGame());
  }, []);

  const play = useCallback(
    (board: number, cell: number) => {
      if (thinking) return;
      setState((prev) => {
        if (!isLegalMove(prev, board, cell)) return prev;
        return applyMove(prev, board, cell);
      });
    },
    [thinking],
  );

  // After any state change in vs-computer mode, let the AI move if it's its turn.
  useEffect(() => {
    if (mode !== 'vs-computer') return;
    if (state.winner) return;
    if (state.currentPlayer !== AI_PLAYER) return;

    const myGeneration = generation.current;
    setThinking(true);

    // Defer the (potentially expensive) search off the interaction so the
    // "thinking…" indicator paints and taps stay responsive.
    const task = InteractionManager.runAfterInteractions(() => {
      // Bail if a new game started while we were waiting.
      if (myGeneration !== generation.current) return;
      setState((prev) => {
        if (prev.winner || prev.currentPlayer !== AI_PLAYER) return prev;
        const move = chooseAiMove(prev, difficulty);
        if (!move) return prev;
        return applyMove(prev, move.board, move.cell);
      });
      setThinking(false);
    });

    return () => task.cancel();
  }, [mode, difficulty, state]);

  return { state, mode, difficulty, thinking, play, newGame };
}
