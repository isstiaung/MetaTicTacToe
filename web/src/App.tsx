import { useCallback, useEffect, useRef, useState } from 'react';
import type { Difficulty, GameState } from '@mtt/engine';
import { applyMove, chooseAiMove, createGame, isLegalMove } from '@mtt/engine';
import { Landing } from './components/Landing';
import { GameScreen } from './components/GameScreen';
import { ResultModal } from './components/ResultModal';
import { installThemeVars } from './theme';

installThemeVars();

type Mode = 'two-player' | 'vs-computer';
type Screen = 'landing' | 'game';

/** The human is always X when playing the computer. */
const HUMAN: 'X' = 'X';

export function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [mode, setMode] = useState<Mode>('two-player');
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [state, setState] = useState<GameState>(createGame);
  const [thinking, setThinking] = useState(false);

  // Bumped on every new game / mode change so an in-flight AI computation from
  // a previous game can detect it is stale and bail out before committing.
  const genRef = useRef(0);

  const startGame = useCallback((nextMode: Mode) => {
    genRef.current += 1;
    setMode(nextMode);
    setState(createGame());
    setThinking(false);
    setScreen('game');
  }, []);

  const resetGame = useCallback(() => {
    genRef.current += 1;
    setState(createGame());
    setThinking(false);
  }, []);

  const goHome = useCallback(() => {
    genRef.current += 1;
    setThinking(false);
    setScreen('landing');
  }, []);

  // Apply a human (or 2-player) move. Guarded by isLegalMove and the thinking
  // lock so clicks during the AI's turn are ignored.
  const handlePlay = useCallback(
    (board: number, cell: number) => {
      if (thinking) return;
      setState((prev) => {
        if (!isLegalMove(prev, board, cell)) return prev;
        return applyMove(prev, board, cell);
      });
    },
    [thinking],
  );

  // After every state change, if it is the computer's turn, compute its move
  // asynchronously so the heavy minimax never blocks paint. A "thinking" flag
  // locks the board meanwhile.
  useEffect(() => {
    if (screen !== 'game') return;
    if (mode !== 'vs-computer') return;
    if (state.winner !== null) return;
    if (state.currentPlayer === HUMAN) return;

    const gen = genRef.current;
    setThinking(true);

    // Defer to a macrotask so the human's mark paints first, then run the AI.
    const timer = setTimeout(() => {
      // A reset / home / new mode happened while we were queued — abandon.
      if (gen !== genRef.current) return;

      const move = chooseAiMove(state, difficulty);
      if (gen !== genRef.current) return;

      setThinking(false);
      if (move && isLegalMove(state, move.board, move.cell)) {
        setState((prev) => {
          // Re-validate against the latest state before committing.
          if (gen !== genRef.current) return prev;
          if (!isLegalMove(prev, move.board, move.cell)) return prev;
          return applyMove(prev, move.board, move.cell);
        });
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [screen, mode, state, difficulty]);

  const modeLabel =
    mode === 'two-player'
      ? '2 Players'
      : `vs Computer · ${difficulty === 'hard' ? 'Hard' : 'Easy'}`;

  const result = state.winner; // 'X' | 'O' | 'draw' | null

  return (
    <div className="app">
      {screen === 'landing' ? (
        <Landing
          difficulty={difficulty}
          onChangeDifficulty={setDifficulty}
          onStartTwoPlayer={() => startGame('two-player')}
          onStartVsComputer={() => startGame('vs-computer')}
        />
      ) : (
        <>
          <GameScreen
            state={state}
            modeLabel={modeLabel}
            thinking={thinking}
            onPlay={handlePlay}
            onReset={resetGame}
            onHome={goHome}
          />
          {result !== null && (
            <ResultModal outcome={result} onPlayAgain={resetGame} onHome={goHome} />
          )}
        </>
      )}
    </div>
  );
}
