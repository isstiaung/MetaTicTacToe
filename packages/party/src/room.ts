// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Pure, framework-agnostic room logic for an online match.
 *
 * This module has NO PartyKit dependency — `server.ts` is a thin adapter around it — so the
 * entire authority (seat assignment, turn + legality enforcement, rematch, disconnect) is
 * unit-testable. It reuses `@mtt/engine` as the single source of truth for the rules.
 */
import { applyMove, chooseAiMove, createGame, forfeit, isLegalMove, other } from '@mtt/engine';
import type {
  ClientMessage,
  RematchState,
  RoomPlayers,
  RoomStatus,
  Seat,
  ServerErrorCode,
  ServerMessage,
} from '@mtt/protocol';
import type { GameState } from '@mtt/engine';

interface SeatState {
  playerId: string;
  name: string;
  connected: boolean;
  /** Epoch-ms when this seat last went offline, or `null` while connected. */
  disconnectedAt: number | null;
}

/**
 * How long the current player has to move before the server auto-plays for them.
 * A move (or a new game) resets the clock; running out triggers an `easy` AI move.
 */
export const TURN_DURATION_MS = 120_000;

/**
 * How long a room may sit idle (no join/move/rematch/auto-move) before the server
 * frees it: the Durable Object deletes its own storage so the code is reusable.
 */
export const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * How long a player must have been offline, mid-game, before their opponent may claim the win.
 * Long enough to ride out a reconnect (backgrounded phone, network switch); short enough that the
 * player left behind isn't stuck waiting on auto-moves.
 */
export const CLAIM_WIN_AFTER_MS = 60_000;

/** Difficulty of the move the server auto-plays when a turn times out. */
const TIMEOUT_DIFFICULTY = 'easy';

/** Server-internal room state (a superset of what's broadcast). */
export interface RoomState {
  code: string;
  game: GameState;
  status: RoomStatus;
  seats: { X?: SeatState; O?: SeatState };
  rematch: RematchState;
  /**
   * Absolute epoch-ms deadline for the current move, or `null` when no clock is
   * running (not `playing`). The pure reducer sets it from the injected `now`;
   * the server arms a Durable Object alarm at this time.
   */
  turnDeadline: number | null;
  /**
   * Epoch-ms of the last meaningful action in the room. The server frees the room
   * once this is older than {@link ROOM_TTL_MS}. Stamped by the reducer on every
   * broadcasting action (and by `applyTimeout`, since an auto-move means a player
   * is still present to watch it).
   */
  lastActivityAt: number;
  /** The seat that lost by forfeit (its opponent claimed the win), or `null`. */
  forfeit: Seat | null;
}

/** Result of handling one message: the new room, replies to the sender, and whether to broadcast. */
export interface ReduceResult {
  room: RoomState;
  reply: ServerMessage[];
  broadcast: boolean;
  /**
   * Seats changed hands (a rematch swaps X and O), so every connection must be told its new
   * seat — the server re-sends `assigned` to each one, not just to the sender.
   */
  reseated?: boolean;
}

export function createRoom(code: string, now: number = Date.now()): RoomState {
  return {
    code,
    game: createGame(),
    status: 'waiting',
    seats: {},
    rematch: { X: false, O: false },
    turnDeadline: null,
    lastActivityAt: now,
    forfeit: null,
  };
}

/** The seat held by `playerId`, if any. */
export function seatOfPlayer(room: RoomState, playerId: string): Seat | undefined {
  if (room.seats.X?.playerId === playerId) return 'X';
  if (room.seats.O?.playerId === playerId) return 'O';
  return undefined;
}

function defaultName(seat: Seat): string {
  return seat === 'X' ? 'Player X' : 'Player O';
}

function recomputeStatus(room: RoomState): RoomStatus {
  if (room.game.winner) return 'ended';
  if (room.seats.X && room.seats.O) return 'playing';
  return 'waiting';
}

function players(room: RoomState): RoomPlayers {
  const out: RoomPlayers = {};
  if (room.seats.X) out.X = { name: room.seats.X.name, connected: room.seats.X.connected };
  if (room.seats.O) out.O = { name: room.seats.O.name, connected: room.seats.O.connected };
  return out;
}

/**
 * When the connected player may claim the win because their opponent has been offline for
 * {@link CLAIM_WIN_AFTER_MS}, or `null` if no claim is pending: the game must be in progress
 * with exactly one of the two players connected.
 */
export function claimableAt(room: RoomState): number | null {
  const { X, O } = room.seats;
  if (room.status !== 'playing' || !X || !O || X.connected === O.connected) return null;
  const gone = X.connected ? O : X;
  // `?? null`: rooms persisted before this field existed have no timestamp — no claim then.
  const since = gone.disconnectedAt ?? null;
  return since === null ? null : since + CLAIM_WIN_AFTER_MS;
}

/** The broadcast message describing the room's shared state. */
export function syncMessage(room: RoomState): ServerMessage {
  return {
    type: 'sync',
    status: room.status,
    game: room.game,
    players: players(room),
    rematch: room.rematch,
    turnDeadline: room.turnDeadline,
    claimableAt: claimableAt(room),
    forfeit: room.forfeit,
  };
}

function error(room: RoomState, code: ServerErrorCode, message: string): ReduceResult {
  return { room, reply: [{ type: 'error', code, message }], broadcast: false };
}

function setSeat(room: RoomState, seat: Seat, value: SeatState): RoomState {
  return { ...room, seats: { ...room.seats, [seat]: value } };
}

/**
 * Derive the move clock for the room's current status.
 *
 * - Not `playing`, or **the opening move** (no move played yet) → `null` (no clock).
 *   Leaving the first move untimed gives both players time to read the rules
 *   explainer before any countdown begins; the clock kicks in from move two.
 * - A new turn just began (`fresh`) → a fresh `now + TURN_DURATION_MS` deadline.
 * - Same turn continuing (e.g. a reconnect) → keep the running deadline, but if it
 *   has already lapsed or was paused (both players had left), restart it so a
 *   returning player isn't auto-moved the instant they reconnect.
 */
function nextDeadline(room: RoomState, now: number, fresh: boolean): number | null {
  if (room.status !== 'playing' || room.game.lastMove === null) return null;
  if (fresh || room.turnDeadline === null || room.turnDeadline <= now) {
    return now + TURN_DURATION_MS;
  }
  return room.turnDeadline;
}

/**
 * Apply a client message to the room.
 *
 * @param connPlayerId the player id already bound to the sending connection (undefined until
 *   that connection has sent a `join`). A `join` claims the seat of the id in the message, which
 *   must match this one if the connection is already bound — one connection, one seat.
 * @param now epoch-ms used to stamp the move clock (injected so the reducer stays pure/testable).
 */
export function reduce(
  room: RoomState,
  connPlayerId: string | undefined,
  msg: ClientMessage,
  now: number = Date.now(),
): ReduceResult {
  switch (msg.type) {
    case 'join': {
      const pid = msg.playerId;
      if (connPlayerId !== undefined && connPlayerId !== pid) {
        return error(room, 'bad_message', 'This connection has already joined as another player.');
      }
      const wasPlaying = room.status === 'playing';
      let seat = seatOfPlayer(room, pid);
      if (seat) {
        // Reclaim an existing seat (reconnect): refresh name + mark connected.
        const prev = room.seats[seat]!;
        room = setSeat(room, seat, {
          ...prev,
          name: msg.name || prev.name,
          connected: true,
          disconnectedAt: null,
        });
      } else if (!room.seats.X || !room.seats.O) {
        seat = room.seats.X ? 'O' : 'X';
        room = setSeat(room, seat, {
          playerId: pid,
          name: msg.name || defaultName(seat),
          connected: true,
          disconnectedAt: null,
        });
      } else {
        return error(room, 'room_full', 'This game already has two players.');
      }
      room = { ...room, status: recomputeStatus(room) };
      // Start the clock when the second player makes the game playable; a plain
      // reconnect into an in-progress game keeps the already-running clock.
      room = { ...room, turnDeadline: nextDeadline(room, now, !wasPlaying), lastActivityAt: now };
      return { room, reply: [{ type: 'assigned', you: seat, code: room.code }], broadcast: true };
    }

    case 'move': {
      const seat = connPlayerId ? seatOfPlayer(room, connPlayerId) : undefined;
      if (!seat) return error(room, 'not_joined', 'Join the game before playing.');
      if (room.status !== 'playing') return error(room, 'illegal_move', 'The game is not in progress.');
      if (room.game.currentPlayer !== seat) return error(room, 'not_your_turn', "It's not your turn.");
      if (!isLegalMove(room.game, msg.board, msg.cell)) {
        return error(room, 'illegal_move', 'That move is not allowed.');
      }
      room = { ...room, game: applyMove(room.game, msg.board, msg.cell) };
      room = { ...room, status: recomputeStatus(room) };
      room = { ...room, turnDeadline: nextDeadline(room, now, true), lastActivityAt: now };
      return { room, reply: [], broadcast: true };
    }

    case 'rematch': {
      const seat = connPlayerId ? seatOfPlayer(room, connPlayerId) : undefined;
      if (!seat) return error(room, 'not_joined', 'Join the game first.');
      if (room.status !== 'ended') {
        return error(room, 'illegal_move', 'A rematch can only start once the game is over.');
      }
      const rematch: RematchState = { ...room.rematch, [seat]: true };
      room = { ...room, rematch };
      let reseated = false;
      if (rematch.X && rematch.O) {
        // X always opens, so swap seats: the other player moves first in the new game.
        room = {
          ...room,
          seats: { X: room.seats.O, O: room.seats.X },
          game: createGame(),
          rematch: { X: false, O: false },
          forfeit: null,
        };
        room = { ...room, status: recomputeStatus(room) };
        room = { ...room, turnDeadline: nextDeadline(room, now, true) };
        reseated = true;
      }
      room = { ...room, lastActivityAt: now };
      return { room, reply: [], broadcast: true, reseated };
    }

    case 'claim': {
      const seat = connPlayerId ? seatOfPlayer(room, connPlayerId) : undefined;
      if (!seat) return error(room, 'not_joined', 'Join the game first.');
      const at = claimableAt(room);
      if (at === null || !room.seats[seat]!.connected) {
        return error(room, 'cannot_claim', 'Your opponent is still in the game.');
      }
      if (now < at) {
        return error(room, 'cannot_claim', 'Your opponent may still come back — wait a little longer.');
      }
      const loser = other(seat);
      room = { ...room, game: forfeit(room.game, loser), forfeit: loser };
      room = { ...room, status: recomputeStatus(room) };
      room = { ...room, turnDeadline: nextDeadline(room, now, true), lastActivityAt: now };
      return { room, reply: [], broadcast: true };
    }

    case 'leave': {
      const seat = connPlayerId ? seatOfPlayer(room, connPlayerId) : undefined;
      if (seat) {
        room = markOffline(room, seat, now);
        room = { ...room, lastActivityAt: now };
      }
      return { room, reply: [], broadcast: Boolean(seat) };
    }
  }
}

/**
 * Auto-play a move for the current player because their turn clock ran out.
 *
 * Pure (the engine's RNG is injectable). The server calls this from its Durable
 * Object alarm. A no-op unless the game is in progress; otherwise it picks an
 * `easy` engine move, applies it, and re-arms the clock for the next turn (or
 * clears it when the auto-move ends the game).
 */
export function applyTimeout(
  room: RoomState,
  now: number = Date.now(),
  rng: () => number = Math.random,
): ReduceResult {
  if (room.status !== 'playing') return { room, reply: [], broadcast: false };
  const move = chooseAiMove(room.game, TIMEOUT_DIFFICULTY, rng);
  if (!move) return { room, reply: [], broadcast: false };
  room = { ...room, game: applyMove(room.game, move.board, move.cell) };
  room = { ...room, status: recomputeStatus(room) };
  room = { ...room, turnDeadline: nextDeadline(room, now, true), lastActivityAt: now };
  return { room, reply: [], broadcast: true };
}

/** Mark `seat` offline, keeping the original time if it was already offline. */
function markOffline(room: RoomState, seat: Seat, now: number): RoomState {
  const prev = room.seats[seat]!;
  const disconnectedAt = prev.connected ? now : (prev.disconnectedAt ?? now);
  return setSeat(room, seat, { ...prev, connected: false, disconnectedAt });
}

/**
 * Mark a player's seat disconnected (called when their last connection closes — the server
 * skips this while another connection still holds the same player id).
 */
export function disconnect(
  room: RoomState,
  playerId: string,
  now: number = Date.now(),
): ReduceResult {
  const seat = seatOfPlayer(room, playerId);
  if (!seat) return { room, reply: [], broadcast: false };
  room = markOffline(room, seat, now);
  return { room, reply: [], broadcast: true };
}
