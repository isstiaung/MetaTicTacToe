import { useEffect, useState } from 'react';
import { boardScore, isLegalMove } from '@mtt/engine';
import type { Outcome } from '@mtt/engine';
import type { RoomPlayers, Seat } from '@mtt/protocol';
import { MetaBoard } from '../components/MetaBoard';
import { ResultModal } from '../components/ResultModal';
import { Score } from '../components/Score';
import { useOnlineGame } from './useOnlineGame';
import { cn } from '../theme';

interface OnlineGameProps {
  /** The room code to connect to (already normalised / generated). */
  code: string;
  name: string;
  /** Leave the room and return to the online menu. */
  onLeave: () => void;
}

function seatName(players: RoomPlayers, seat: Seat): string {
  return players[seat]?.name ?? (seat === 'X' ? 'Player X' : 'Player O');
}

/** A name plate showing one player's seat, name, and whose turn it is. */
function PlayerTag({
  seat,
  name,
  isYou,
  isTurn,
  connected,
}: {
  seat: Seat;
  name: string;
  isYou: boolean;
  isTurn: boolean;
  connected: boolean;
}) {
  return (
    <div className={cn('player-tag', isTurn && 'player-tag--turn')}>
      <span className={cn('turn__mark', seat === 'X' ? 'turn__mark--X' : 'turn__mark--O')}>
        {seat}
      </span>
      <span className="player-tag__name">
        {name}
        {isYou && <span className="player-tag__you"> (You)</span>}
        {!connected && <span className="player-tag__off"> · offline</span>}
      </span>
    </div>
  );
}

export function OnlineGame({ code, name, onLeave }: OnlineGameProps) {
  const game = useOnlineGame(code, name);
  const { state, status, you, players, rematch, connected, error, sendMove, sendRematch } = game;
  const [copied, setCopied] = useState(false);
  // Whether the player dismissed the result dialog; reset when a new game
  // (rematch) begins, i.e. once the board no longer has a winner.
  const [resultDismissed, setResultDismissed] = useState(false);
  useEffect(() => {
    if (state.winner === null) setResultDismissed(false);
  }, [state.winner]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — the code is shown on screen regardless.
    }
  };

  // ----- Lobby: connecting or waiting for the opponent -----
  if (status === 'waiting' || you === null) {
    const waitingForOpponent = you !== null && status === 'waiting';
    return (
      <main className="game">
        <div className="topbar">
          <button type="button" className="btn btn--ghost" onClick={onLeave}>
            &larr; Leave
          </button>
          <span className="topbar__mode" style={{ color: 'var(--mtt-muted)', fontSize: 'var(--mtt-size-sm)' }}>
            Online
          </span>
          <div className="topbar__actions" />
        </div>

        <div className="lobby">
          <h2 className="lobby__title">
            {!connected
              ? 'Connecting…'
              : waitingForOpponent
                ? 'Waiting for opponent…'
                : 'Joining game…'}
          </h2>
          <p className="lobby__sub">Share this code so a friend can join:</p>
          <div className="code-chip">
            <span className="code-chip__value">{code}</span>
            <button type="button" className="btn btn--ghost code-chip__copy" onClick={copyCode}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {you !== null && (
            <p className="lobby__seat">
              You are{' '}
              <span className={cn('turn__mark', you === 'X' ? 'turn__mark--X' : 'turn__mark--O')}>
                {you}
              </span>
            </p>
          )}
          {error && <p className="status__hint" style={{ color: 'var(--mtt-danger)' }}>{error}</p>}
        </div>
      </main>
    );
  }

  // ----- Active game (playing / ended) -----
  const gameOver = state.winner !== null;
  const myTurn = status === 'playing' && state.currentPlayer === you && connected;

  // Lock unless it's our turn while connected. Optionally gate clicks with
  // isLegalMove for snappiness; the server is still the final authority.
  const locked = !myTurn;
  const handlePlay = (board: number, cell: number) => {
    if (locked) return;
    if (!isLegalMove(state, board, cell)) return;
    sendMove(board, cell);
  };

  const opponentSeat: Seat = you === 'X' ? 'O' : 'X';
  const opponentConnected = players[opponentSeat]?.connected ?? false;

  let statusNote: string | null = null;
  if (!connected) {
    statusNote = 'Reconnecting…';
  } else if (!opponentConnected && status !== 'ended') {
    statusNote = 'Opponent disconnected…';
  }

  let hint: string;
  if (gameOver) {
    hint = 'Game over.';
  } else if (!connected) {
    hint = 'Reconnecting to the game…';
  } else if (myTurn) {
    hint = state.activeBoard === null ? 'Your move — any open board.' : 'Your move — play in the highlighted board.';
  } else {
    hint = `Waiting for ${seatName(players, opponentSeat)}…`;
  }

  // Rematch modal state: show a pending note when only we have requested it.
  const iRequestedRematch = rematch[you];
  const pendingNote = iRequestedRematch ? 'Waiting for opponent to accept' : undefined;

  // End-of-game header readout and the names used for the share summary.
  const metaScore = boardScore(state);
  const resultLabel =
    state.winner === 'draw' ? "It's a draw" : state.winner === 'X' ? 'X wins!' : 'O wins!';
  const shareNames = { X: players.X?.name, O: players.O?.name };

  return (
    <main className="game">
      <div className="topbar">
        <button type="button" className="btn btn--ghost" onClick={onLeave} aria-label="Leave game">
          &larr; Leave
        </button>
        <span className="topbar__mode" style={{ color: 'var(--mtt-muted)', fontSize: 'var(--mtt-size-sm)' }}>
          Online · {code}
        </span>
        <div className="topbar__actions">
          <Score state={state} />
        </div>
      </div>

      <div className="players" aria-label="Players">
        <PlayerTag
          seat="X"
          name={seatName(players, 'X')}
          isYou={you === 'X'}
          isTurn={!gameOver && state.currentPlayer === 'X'}
          connected={players.X?.connected ?? true}
        />
        <span className="players__vs">vs</span>
        <PlayerTag
          seat="O"
          name={seatName(players, 'O')}
          isYou={you === 'O'}
          isTurn={!gameOver && state.currentPlayer === 'O'}
          connected={players.O?.connected ?? true}
        />
      </div>

      <div className="status" aria-live="polite">
        {gameOver && (
          <span className="turn turn--result">
            <span>{resultLabel}</span>
            <span className="turn__dot" aria-hidden="true">
              ·
            </span>
            <span className="score score--inline">
              <span className="score__side score__side--X">
                <span className="score__mark">X</span> {metaScore.X}
              </span>
              <span className="score__sep" aria-hidden="true">
                –
              </span>
              <span className="score__side score__side--O">
                {metaScore.O} <span className="score__mark">O</span>
              </span>
            </span>
          </span>
        )}
        <span className="status__hint">{hint}</span>
        {statusNote && (
          <span className="status__hint" style={{ color: 'var(--mtt-danger)', fontWeight: 600 }}>
            {statusNote}
          </span>
        )}
        {error && (
          <span className="status__hint" style={{ color: 'var(--mtt-danger)' }}>
            {error}
          </span>
        )}
      </div>

      <MetaBoard state={state} locked={locked} onPlay={handlePlay} />

      {gameOver && !resultDismissed && (
        <ResultModal
          outcome={state.winner as Exclude<Outcome, null>}
          state={state}
          players={shareNames}
          onPlayAgain={sendRematch}
          onHome={onLeave}
          onDismiss={() => setResultDismissed(true)}
          playAgainLabel="Rematch"
          pendingNote={pendingNote}
        />
      )}
    </main>
  );
}
