// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from 'react';
import type { GameState, Outcome } from '@mtt/engine';
import { boardScore, gameSummaryText } from '@mtt/engine';
import { cn } from '../theme';

interface ResultModalProps {
  /** A decided outcome: 'X', 'O', or 'draw'. Caller only renders when decided. */
  outcome: Exclude<Outcome, null>;
  /** The finished game state — used for the score and the shareable summary. */
  state: GameState;
  onPlayAgain: () => void;
  onHome: () => void;
  /** Dismiss the dialog without ending interaction; the finished board shows. */
  onDismiss: () => void;
  /**
   * Display names for the share summary (online play). Omitted for local play,
   * where the summary defaults to "X" / "O".
   */
  players?: { X?: string; O?: string };
  /**
   * Optional override for the primary action label (e.g. "Rematch" online).
   * Defaults to "Play again" for local play.
   */
  playAgainLabel?: string;
  /**
   * When set (online play), this note appears under the actions — e.g.
   * "Waiting for opponent to accept…". Disables the primary button so the
   * player can't double-request a rematch.
   */
  pendingNote?: string;
  /** An informational line under the actions (online), e.g. "Bob wants a rematch!". */
  note?: string;
  /** Overrides the line under the title, e.g. to explain a win by forfeit. */
  subtitle?: string;
}

/**
 * Copy text to the clipboard, preferring the async Clipboard API and falling
 * back to a hidden-textarea + execCommand for older browsers and in-app
 * webviews (e.g. Instagram/Facebook) that restrict the modern API. Must be
 * called from a user gesture (it is — a button click).
 */
async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    if (!document.execCommand('copy')) throw new Error('copy command rejected');
  } finally {
    document.body.removeChild(ta);
  }
}

export function ResultModal({
  outcome,
  state,
  onPlayAgain,
  onHome,
  onDismiss,
  players,
  playAgainLabel = 'Play again',
  pendingNote,
  note,
  subtitle,
}: ResultModalProps) {
  const playAgainRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  // Pull focus to the primary action when the result appears.
  useEffect(() => {
    playAgainRef.current?.focus();
  }, []);

  // Escape dismisses the dialog (revealing the finished board).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const score = boardScore(state);

  const title =
    outcome === 'draw' ? "It's a draw" : outcome === 'X' ? 'X wins!' : 'O wins!';
  const sub =
    subtitle ??
    (outcome === 'draw'
      ? 'Every board is settled with no line claimed.'
      : 'Three claimed squares in a line.');
  const glyph = outcome === 'draw' ? 'Draw' : outcome;

  // Copy the result to the clipboard (Wordle-style) rather than going through
  // the native share sheet: multi-line emoji grids get mangled or dropped by
  // some share targets (notably Android apps), whereas a clipboard write
  // preserves the block verbatim on every platform.
  const handleCopy = async () => {
    const text = gameSummaryText(state, { players, url: window.location.origin });
    try {
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard genuinely unavailable — nothing more we can do.
    }
  };

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onDismiss}
    >
      {/* Stop clicks inside the card from bubbling to the backdrop handler. */}
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="btn btn--ghost modal__close"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          &times;
        </button>
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
        <p className="modal__score" aria-label={`Boards won — X ${score.X}, O ${score.O}`}>
          <span className="score__side score__side--X">
            <span className="score__mark">X</span> {score.X}
          </span>
          <span className="score__sep" aria-hidden="true">
            –
          </span>
          <span className="score__side score__side--O">
            {score.O} <span className="score__mark">O</span>
          </span>
        </p>
        <div className="modal__actions">
          <button
            ref={playAgainRef}
            type="button"
            className="btn btn--primary"
            onClick={onPlayAgain}
            disabled={pendingNote !== undefined}
          >
            {playAgainLabel}
          </button>
          <button type="button" className="btn btn--secondary" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy result'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onHome}>
            Back to menu
          </button>
          {pendingNote !== undefined && (
            <p className="modal__pending thinking-dots">{pendingNote}</p>
          )}
          {note !== undefined && <p className="modal__pending">{note}</p>}
        </div>
      </div>
    </div>
  );
}
