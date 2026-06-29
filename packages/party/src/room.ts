// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Pure, framework-agnostic room logic for an online match.
 *
 * This module has NO PartyKit dependency — `server.ts` is a thin adapter around it — so the
 * entire authority (seat assignment, turn + legality enforcement, rematch, disconnect) is
 * unit-testable. It reuses `@mtt/engine` as the single source of truth for the rules.
 */
import { applyMove, chooseAiMove, createGame, isLegalMove } from '@mtt/engine';
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
}

/** Result of handling one message: the new room, replies to the sender, and whether to broadcast. */
export interface ReduceResult {
  room: RoomState;
  reply: ServerMessage[];
  broadcast: boolean;
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
  };
}

function seatOfPlayer(room: RoomState, playerId: string): Seat | undefined {
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

/** The broadcast message describing the room's shared state. */
export function syncMessage(room: RoomState): ServerMessage {
  return {
    type: 'sync',
    status: room.status,
    game: room.game,
    players: players(room),
    rematch: room.rematch,
    turnDeadline: room.turnDeadline,
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
 *   that connection has sent a `join`). For a `join` message the id comes from the message itself.
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
      const wasPlaying = room.status === 'playing';
      let seat = seatOfPlayer(room, pid);
      if (seat) {
        // Reclaim an existing seat (reconnect): refresh name + mark connected.
        const prev = room.seats[seat]!;
        room = setSeat(room, seat, { ...prev, name: msg.name || prev.name, connected: true });
      } else if (!room.seats.X) {
        seat = 'X';
        room = setSeat(room, seat, { playerId: pid, name: msg.name || defaultName(seat), connected: true });
      } else if (!room.seats.O) {
        seat = 'O';
        room = setSeat(room, seat, { playerId: pid, name: msg.name || defaultName(seat), connected: true });
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
      let rematch: RematchState = { ...room.rematch, [seat]: true };
      room = { ...room, rematch };
      if (rematch.X && rematch.O) {
        rematch = { X: false, O: false };
        room = { ...room, game: createGame(), rematch };
        room = { ...room, status: recomputeStatus(room) };
        room = { ...room, turnDeadline: nextDeadline(room, now, true) };
      }
      room = { ...room, lastActivityAt: now };
      return { room, reply: [], broadcast: true };
    }

    case 'leave': {
      const seat = connPlayerId ? seatOfPlayer(room, connPlayerId) : undefined;
      if (seat) {
        room = setSeat(room, seat, { ...room.seats[seat]!, connected: false });
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

/** Mark a player's seat disconnected (called when their connection closes). */
export function disconnect(room: RoomState, playerId: string): ReduceResult {
  const seat = seatOfPlayer(room, playerId);
  if (!seat) return { room, reply: [], broadcast: false };
  room = setSeat(room, seat, { ...room.seats[seat]!, connected: false });
  return { room, reply: [], broadcast: true };
}
