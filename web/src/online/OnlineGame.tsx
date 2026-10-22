// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useRef, useState } from 'react';
import { boardScore, isLegalMove } from '@mtt/engine';
import type { Outcome } from '@mtt/engine';
import type { RoomPlayers, Seat } from '@mtt/protocol';
import { MetaBoard } from '../components/MetaBoard';
import { MatchStats } from '../components/MatchStats';
import { ResultModal } from '../components/ResultModal';
import { Score } from '../components/Score';
import { roomShareUrl, useOnlineGame } from './useOnlineGame';
import { AuthChallenge, useSessionToken } from './AuthChallenge';
import { HelpButton } from '../components/HelpButton';
import { cn } from '../theme';

interface OnlineGameProps {
  /** The room code to connect to (already normalised / generated). */
  code: string;
  name: string;
  /** Leave the room and return to the online menu. */
  onLeave: () => void;
  /** Fired once when the game first becomes playable (both seats filled). */
  onGameStart?: () => void;
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

/**
 * Live countdown for the current player's move. Ticks once a second off the
 * server's absolute `deadline`; the server auto-plays an `easy` move when it
 * hits zero, so this is purely informational and self-corrects on every sync.
 */
function MoveTimer({ deadline, seat }: { deadline: number; seat: Seat }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const remaining = Math.max(0, deadline - now);
  const totalSec = Math.ceil(remaining / 1000);
  const label = `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;
  const urgent = remaining <= 15_000;

  return (
    <span
      className={cn(
        'move-timer',
        seat === 'X' ? 'move-timer--X' : 'move-timer--O',
        urgent && 'move-timer--urgent',
      )}
      role="timer"
      aria-label={`${label} left to move`}
    >
      <span className="move-timer__time">{label}</span>
      <span className="move-timer__unit">left</span>
    </span>
  );
}

/**
 * Shown to the player left behind while their opponent is offline mid-game: counts down the
 * grace period, then offers to end the game as a win by forfeit. The server re-checks the time.
 */
function ClaimWin({ claimableAt, onClaim }: { claimableAt: number; onClaim: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = Math.ceil((claimableAt - now) / 1000);
  if (seconds > 0) {
    return (
      <span className="status__hint">
        If they don’t return, you can claim the win in {seconds}s.
      </span>
    );
  }
  return (
    <div className="status__actions">
      <button type="button" className="btn btn--primary" onClick={onClaim}>
        Claim win
      </button>
    </div>
  );
}

export function OnlineGame({ code, name, onLeave, onGameStart }: OnlineGameProps) {
  // Abuse gate: a session token must be minted (via Turnstile) before the socket
  // can connect. When arriving from a shared `?room=` link we skip the online
  // menu where this normally happens, so mint it here too — otherwise the socket
  // hits the gate with an empty token and is stuck "Connecting…" forever. If a
  // token is already cached (e.g. created via the menu), connect immediately.
  const [authReady, markAuthReady] = useSessionToken();
  // Connect once a token is in hand, then stay connected. When the token expires mid-game,
  // `authReady` flips back and a fresh one is minted in the background for future reconnects,
  // without dropping the live socket.
  const [authedOnce, setAuthedOnce] = useState(authReady);
  useEffect(() => {
    if (authReady) setAuthedOnce(true);
  }, [authReady]);

  // Hold off connecting (empty `code`) until we hold a valid session token.
  const game = useOnlineGame(authedOnce ? code : '', name);
  const {
    state,
    status,
    you,
    players,
    rematch,
    connected,
    turnDeadline,
    claimableAt,
    forfeit,
    error,
    sendMove,
    sendRematch,
    sendClaim,
  } = game;
  const [copied, setCopied] = useState(false);
  // Whether the player dismissed the result dialog; reset when a new game
  // (rematch) begins, i.e. once the board no longer has a winner.
  const [resultDismissed, setResultDismissed] = useState(false);
  useEffect(() => {
    if (state.winner === null) setResultDismissed(false);
  }, [state.winner]);

  // Auto-show the rules explainer once, the moment the game first becomes playable.
  const gameStartedRef = useRef(false);
  useEffect(() => {
    if (status === 'playing' && !gameStartedRef.current) {
      gameStartedRef.current = true;
      onGameStart?.();
    }
  }, [status, onGameStart]);

  // Copy a shareable link that auto-joins this room when opened by a friend.
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomShareUrl(code));
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
          <div className="topbar__actions">
            <HelpButton />
          </div>
        </div>

        <div className="lobby">
          <h2 className="lobby__title">
            {!authedOnce
              ? 'Verifying…'
              : !connected
                ? 'Connecting…'
                : waitingForOpponent
                  ? 'Waiting for opponent…'
                  : 'Joining game…'}
          </h2>
          <p className="lobby__sub">Share this link (or the code) so a friend can join:</p>
          <div className="code-chip">
            <span className="code-chip__value">{code}</span>
            <button type="button" className="btn btn--ghost code-chip__copy" onClick={copyCode}>
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>

          {/* Invisible/managed Turnstile — only shows UI if interaction is needed. */}
          {!authReady && <AuthChallenge onReady={markAuthReady} />}

          {you !== null && (
            <p className="lobby__seat">
              You are{' '}
              <span className={cn('turn__mark', you === 'X' ? 'turn__mark--X' : 'turn__mark--O')}>
                {you}
              </span>
            </p>
          )}
          {error && <p className="status__hint" style={{ color: 'var(--mtt-danger)' }}>{error}</p>}
          <p className="fine-print">Inactive rooms are freed after 6 hours.</p>
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
  const opponentName = seatName(players, opponentSeat);

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
    hint = `Waiting for ${opponentName}…`;
  }

  // Rematch: a pending note once we've asked; otherwise say if the opponent has asked or left.
  const iAskedRematch = rematch[you];
  const opponentAskedRematch = rematch[opponentSeat];
  const rematchLabel = opponentAskedRematch && !iAskedRematch ? 'Accept rematch' : 'Rematch';
  const pendingNote = iAskedRematch
    ? opponentConnected
      ? 'Waiting for opponent to accept'
      : `Waiting for ${opponentName} to come back`
    : undefined;
  let rematchNote: string | undefined;
  if (gameOver && !iAskedRematch) {
    if (!opponentConnected) rematchNote = `${opponentName} has left the room.`;
    else if (opponentAskedRematch) rematchNote = `${opponentName} wants a rematch!`;
  }
  const forfeitNote = forfeit ? `${seatName(players, forfeit)} left the game.` : undefined;

  // Opponent offline mid-game: after a grace period we may end it as a win by forfeit.
  const canClaim =
    status === 'playing' && connected && !opponentConnected && claimableAt !== null;

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
          <HelpButton />
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
        {!gameOver && status === 'playing' && turnDeadline !== null && (
          <MoveTimer deadline={turnDeadline} seat={state.currentPlayer} />
        )}
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
        {canClaim && <ClaimWin claimableAt={claimableAt} onClaim={sendClaim} />}
        {gameOver && forfeitNote && <span className="status__hint">{forfeitNote}</span>}
        {/* With the result dialog closed, keep the rematch reachable here. */}
        {gameOver && resultDismissed && (
          <>
            <div className="status__actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={sendRematch}
                disabled={iAskedRematch}
              >
                {iAskedRematch ? 'Rematch requested' : rematchLabel}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setResultDismissed(false)}
              >
                Show result
              </button>
            </div>
            {(pendingNote ?? rematchNote) && (
              <span className="status__hint">{pendingNote ?? rematchNote}</span>
            )}
          </>
        )}
        {/* Mid-game the token may expire; mint a fresh one quietly for future reconnects. */}
        {!authReady && <AuthChallenge onReady={markAuthReady} />}
        {error && (
          <span className="status__hint" style={{ color: 'var(--mtt-danger)' }}>
            {error}
          </span>
        )}
      </div>

      <MetaBoard state={state} locked={locked} onPlay={handlePlay} />

      <MatchStats state={state} names={shareNames} you={you} />

      <p className="fine-print">Inactive rooms are freed after 6 hours.</p>

      {gameOver && !resultDismissed && (
        <ResultModal
          outcome={state.winner as Exclude<Outcome, null>}
          state={state}
          players={shareNames}
          onPlayAgain={sendRematch}
          onHome={onLeave}
          onDismiss={() => setResultDismissed(true)}
          playAgainLabel={rematchLabel}
          pendingNote={pendingNote}
          note={rematchNote}
          subtitle={forfeitNote}
        />
      )}
    </main>
  );
}
