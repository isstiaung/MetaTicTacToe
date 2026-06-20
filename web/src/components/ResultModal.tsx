import { useEffect, useRef } from 'react';
import type { Outcome } from '@mtt/engine';
import { cn } from '../theme';

interface ResultModalProps {
  /** A decided outcome: 'X', 'O', or 'draw'. Caller only renders when decided. */
  outcome: Exclude<Outcome, null>;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function ResultModal({ outcome, onPlayAgain, onHome }: ResultModalProps) {
  const playAgainRef = useRef<HTMLButtonElement>(null);

  // Pull focus to the primary action when the result appears.
  useEffect(() => {
    playAgainRef.current?.focus();
  }, []);

  const title =
    outcome === 'draw' ? "It's a draw" : outcome === 'X' ? 'X wins!' : 'O wins!';
  const sub =
    outcome === 'draw'
      ? 'Every board is settled with no line claimed.'
      : 'Three claimed squares in a line.';
  const glyph = outcome === 'draw' ? 'Draw' : outcome;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <span
          className={cn(
            'modal__glyph',
            outcome === 'X' && 'modal__glyph--X',
            outcome === 'O' && 'modal__glyph--O',
            outcome === 'draw' && 'modal__glyph--draw',
          )}
          aria-hidden="true"
        >
          {glyph}
        </span>
        <h2 className="modal__title">{title}</h2>
        <p className="modal__sub">{sub}</p>
        <div className="modal__actions">
          <button
            ref={playAgainRef}
            type="button"
            className="btn btn--primary"
            onClick={onPlayAgain}
          >
            Play again
          </button>
          <button type="button" className="btn btn--ghost" onClick={onHome}>
            Back to menu
          </button>
        </div>
      </div>
    </div>
  );
}
