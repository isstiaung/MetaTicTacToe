import { useEffect, useRef } from 'react';

interface RulesModalProps {
  /** Close the dialog (backdrop click, ✕, "Got it", or Escape). */
  onClose: () => void;
}

/**
 * A quick in-app explainer of the Ultimate / Meta Tic-Tac-Toe rules. Shown from
 * the "?" button anywhere, and auto-opened once at a player's first game start.
 */
export function RulesModal({ onClose }: RulesModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
      onClick={onClose}
    >
      <div className="modal modal--rules" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="btn btn--ghost modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        <h2 className="modal__title">How to play</h2>
        <p className="modal__sub">Tic-tac-toe, nine times over.</p>
        <ol className="rules-list">
          <li>
            The board is <b>nine</b> small tic-tac-toe boards in a 3×3 grid.
          </li>
          <li>
            Win a small board to claim its square on the big board. <b>Line up three claimed
            squares to win the game.</b>
          </li>
          <li>
            Your move sends your opponent to the matching board — play the <i>top-right</i> cell and
            they must play in the <i>top-right</i> board next.
          </li>
          <li>
            If that board is already finished, they may play in <b>any</b> open board.
          </li>
          <li>X moves first.</li>
        </ol>
        <button ref={closeRef} type="button" className="btn btn--primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
