import type { GameState, Player } from '@mtt/engine';
import { boardScore } from '@mtt/engine';
import { MetaBoard } from './MetaBoard';
import { Score } from './Score';
import { cn } from '../theme';

interface GameScreenProps {
  state: GameState;
  /** Game mode label, e.g. "2 Players" or "vs Computer (Hard)". */
  modeLabel: string;
  /** True while the AI is computing its move. */
  thinking: boolean;
  onPlay: (board: number, cell: number) => void;
  onReset: () => void;
  onHome: () => void;
}

function TurnIndicator({ player }: { player: Player }) {
  return (
    <span className="turn">
      <span className={cn('turn__mark', player === 'X' ? 'turn__mark--X' : 'turn__mark--O')}>
        {player}
      </span>
      <span>{player} to move</span>
    </span>
  );
}

/** When the game is over: "X wins! · X 4–2 O" (or the draw equivalent). */
function ResultLine({ state }: { state: GameState }) {
  const score = boardScore(state);
  const label =
    state.winner === 'draw' ? "It's a draw" : state.winner === 'X' ? 'X wins!' : 'O wins!';
  return (
    <span className="turn turn--result">
      <span>{label}</span>
      <span className="turn__dot" aria-hidden="true">
        ·
      </span>
      <span className="score score--inline">
        <span className="score__side score__side--X">
          <span className="score__mark">X</span> {score.X}
        </span>
        <span className="score__sep" aria-hidden="true">
          –
        </span>
        <span className="score__side score__side--O">
          {score.O} <span className="score__mark">O</span>
        </span>
      </span>
    </span>
  );
}

export function GameScreen({
  state,
  modeLabel,
  thinking,
  onPlay,
  onReset,
  onHome,
}: GameScreenProps) {
  const gameOver = state.winner !== null;
  const locked = thinking || gameOver;

  // Free move = no single forced board (routed board is finished or it's the
  // very first move). The engine encodes that as activeBoard === null.
  const freeMove = state.activeBoard === null;

  let hint: string;
  if (gameOver) {
    hint = 'Game over.';
  } else if (thinking) {
    hint = 'Computer is thinking';
  } else if (freeMove) {
    hint = 'Free move — play in any open board.';
  } else {
    hint = 'Play in the highlighted board.';
  }

  return (
    <main className="game">
      <div className="topbar">
        <button type="button" className="btn btn--ghost" onClick={onHome} aria-label="Back to menu">
          &larr; Menu
        </button>
        <span className="topbar__mode" aria-hidden="true" style={{ color: 'var(--mtt-muted)', fontSize: 'var(--mtt-size-sm)' }}>
          {modeLabel}
        </span>
        <div className="topbar__actions">
          <Score state={state} />
          <button type="button" className="btn btn--ghost" onClick={onReset}>
            New game
          </button>
        </div>
      </div>

      <div className="status" aria-live="polite">
        {gameOver ? (
          <ResultLine state={state} />
        ) : (
          <TurnIndicator player={state.currentPlayer} />
        )}
        <span
          className={cn(
            'status__hint',
            thinking && 'status__hint--thinking',
            thinking && 'thinking-dots',
          )}
        >
          {hint}
        </span>
      </div>

      <MetaBoard state={state} locked={locked} onPlay={onPlay} />
    </main>
  );
}
