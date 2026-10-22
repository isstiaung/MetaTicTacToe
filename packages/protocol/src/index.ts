// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Wire protocol for online MetaTicTacToe.
 *
 * Shared by the PartyKit server (`@mtt/party`) and both clients (web + mobile) so the
 * contract stays type-safe and in one place. The game state itself is the engine's
 * `GameState` — the server is authoritative and broadcasts it verbatim.
 */
import type { GameState, Move, Player } from '@mtt/engine';

/** Which side of the board a connected player holds. */
export type Seat = 'X' | 'O';

export interface PlayerInfo {
  name: string;
  connected: boolean;
}

/** Both seats, as far as they are filled. */
export interface RoomPlayers {
  X?: PlayerInfo;
  O?: PlayerInfo;
}

/**
 * `waiting`  — fewer than two players have joined.
 * `playing`  — both seats filled and the game is in progress.
 * `ended`    — the current game has a winner or a draw.
 */
export type RoomStatus = 'waiting' | 'playing' | 'ended';

/** Whether each seat has asked for a rematch. */
export interface RematchState {
  X: boolean;
  O: boolean;
}

/** Messages a client sends to the server. */
export type ClientMessage =
  | { type: 'join'; playerId: string; name: string }
  | { type: 'move'; board: number; cell: number }
  /** Ask for (or accept) a rematch. Only valid once the game has ended. */
  | { type: 'rematch' }
  /** Claim the win because the opponent has been offline for too long (see `claimableAt`). */
  | { type: 'claim' }
  | { type: 'leave' };

export type ServerErrorCode =
  | 'room_full'
  | 'not_your_turn'
  | 'illegal_move'
  | 'not_joined'
  | 'cannot_claim'
  | 'bad_message';

/** Messages the server sends to clients. */
export type ServerMessage =
  /**
   * Sent to a single connection once it has joined (and on reconnect). Also re-sent to
   * every player when a rematch starts, because seats swap so the other player opens.
   */
  | { type: 'assigned'; you: Seat; code: string }
  /** Broadcast to everyone whenever the room changes. */
  | {
      type: 'sync';
      status: RoomStatus;
      game: GameState;
      players: RoomPlayers;
      rematch: RematchState;
      /**
       * Absolute epoch-ms deadline for the current player's move, or `null` when
       * no clock is running (not `playing`). When it lapses the server auto-plays
       * a move for the current player. Clients render `deadline - Date.now()`.
       */
      turnDeadline: number | null;
      /**
       * Absolute epoch-ms from which the connected player may `claim` the win because
       * their opponent has been offline that long, or `null` when no claim is pending
       * (both present, both gone, or the game is not in progress).
       */
      claimableAt: number | null;
      /** The seat that lost by forfeit (its opponent claimed the win), or `null`. */
      forfeit: Seat | null;
    }
  | { type: 'error'; code: ServerErrorCode; message: string };

// Re-export the engine types that travel across the wire, for convenience.
export type { GameState, Move, Player };

export {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  normalizeRoomCode,
  isValidRoomCode,
} from './roomCode';
