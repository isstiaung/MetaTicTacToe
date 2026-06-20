/**
 * Pure, framework-agnostic room logic for an online match.
 *
 * This module has NO PartyKit dependency — `server.ts` is a thin adapter around it — so the
 * entire authority (seat assignment, turn + legality enforcement, rematch, disconnect) is
 * unit-testable. It reuses `@mtt/engine` as the single source of truth for the rules.
 */
import { applyMove, createGame, isLegalMove } from '@mtt/engine';
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

/** Server-internal room state (a superset of what's broadcast). */
export interface RoomState {
  code: string;
  game: GameState;
  status: RoomStatus;
  seats: { X?: SeatState; O?: SeatState };
  rematch: RematchState;
}

/** Result of handling one message: the new room, replies to the sender, and whether to broadcast. */
export interface ReduceResult {
  room: RoomState;
  reply: ServerMessage[];
  broadcast: boolean;
}

export function createRoom(code: string): RoomState {
  return {
    code,
    game: createGame(),
    status: 'waiting',
    seats: {},
    rematch: { X: false, O: false },
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
  };
}

function error(room: RoomState, code: ServerErrorCode, message: string): ReduceResult {
  return { room, reply: [{ type: 'error', code, message }], broadcast: false };
}

function setSeat(room: RoomState, seat: Seat, value: SeatState): RoomState {
  return { ...room, seats: { ...room.seats, [seat]: value } };
}

/**
 * Apply a client message to the room.
 *
 * @param connPlayerId the player id already bound to the sending connection (undefined until
 *   that connection has sent a `join`). For a `join` message the id comes from the message itself.
 */
export function reduce(
  room: RoomState,
  connPlayerId: string | undefined,
  msg: ClientMessage,
): ReduceResult {
  switch (msg.type) {
    case 'join': {
      const pid = msg.playerId;
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
      }
      return { room, reply: [], broadcast: true };
    }

    case 'leave': {
      const seat = connPlayerId ? seatOfPlayer(room, connPlayerId) : undefined;
      if (seat) {
        room = setSeat(room, seat, { ...room.seats[seat]!, connected: false });
      }
      return { room, reply: [], broadcast: Boolean(seat) };
    }
  }
}

/** Mark a player's seat disconnected (called when their connection closes). */
export function disconnect(room: RoomState, playerId: string): ReduceResult {
  const seat = seatOfPlayer(room, playerId);
  if (!seat) return { room, reply: [], broadcast: false };
  room = setSeat(room, seat, { ...room.seats[seat]!, connected: false });
  return { room, reply: [], broadcast: true };
}
