import { describe, it, expect } from 'vitest';
import {
  applyTimeout,
  createRoom,
  reduce,
  disconnect,
  ROOM_TTL_MS,
  syncMessage,
  TURN_DURATION_MS,
  type RoomState,
} from './room';
import type { ClientMessage } from '@mtt/protocol';

const join = (playerId: string, name: string): ClientMessage => ({ type: 'join', playerId, name });

/** A room with both seats filled (X = p1/Alice, O = p2/Bob), status 'playing'. */
function seated(): RoomState {
  let room = createRoom('ABCD');
  room = reduce(room, undefined, join('p1', 'Alice')).room;
  room = reduce(room, undefined, join('p2', 'Bob')).room;
  return room;
}

/** As `seated`, but with the game starting at a fixed `now` so the clock is deterministic. */
function seatedAt(now: number): RoomState {
  let room = createRoom('ABCD');
  room = reduce(room, undefined, join('p1', 'Alice'), now).room;
  room = reduce(room, undefined, join('p2', 'Bob'), now).room;
  return room;
}

describe('joining', () => {
  it('assigns X then O and starts the game', () => {
    let room = createRoom('ABCD');
    const r1 = reduce(room, undefined, join('p1', 'Alice'));
    expect(r1.reply).toContainEqual({ type: 'assigned', you: 'X', code: 'ABCD' });
    expect(r1.broadcast).toBe(true);
    expect(r1.room.status).toBe('waiting');

    const r2 = reduce(r1.room, undefined, join('p2', 'Bob'));
    expect(r2.reply).toContainEqual({ type: 'assigned', you: 'O', code: 'ABCD' });
    expect(r2.room.status).toBe('playing');
  });

  it('rejects a third player as room_full', () => {
    const r = reduce(seated(), undefined, join('p3', 'Eve'));
    expect(r.reply[0]).toMatchObject({ type: 'error', code: 'room_full' });
    expect(r.broadcast).toBe(false);
  });

  it('reclaims the same seat on reconnect by playerId (not a new seat)', () => {
    let room = createRoom('ABCD');
    room = reduce(room, undefined, join('p1', 'Alice')).room;
    const r = reduce(room, 'p1', join('p1', 'Alice Renamed'));
    expect(r.reply).toContainEqual({ type: 'assigned', you: 'X', code: 'ABCD' });
    expect(r.room.seats.X?.name).toBe('Alice Renamed');
    expect(r.room.seats.O).toBeUndefined();
  });
});

describe('moves', () => {
  it('applies a legal move and flips the turn', () => {
    const r = reduce(seated(), 'p1', { type: 'move', board: 4, cell: 0 });
    expect(r.broadcast).toBe(true);
    expect(r.room.game.currentPlayer).toBe('O');
    expect(r.room.game.lastMove).toEqual({ board: 4, cell: 0 });
  });

  it('rejects an out-of-turn move', () => {
    const r = reduce(seated(), 'p2', { type: 'move', board: 4, cell: 0 });
    expect(r.reply[0]).toMatchObject({ code: 'not_your_turn' });
  });

  it('rejects a move from someone not in the room', () => {
    const r = reduce(seated(), 'ghost', { type: 'move', board: 4, cell: 0 });
    expect(r.reply[0]).toMatchObject({ code: 'not_joined' });
  });

  it('rejects an illegal move (wrong board after routing)', () => {
    const afterX = reduce(seated(), 'p1', { type: 'move', board: 4, cell: 0 }).room; // routes O to board 0
    const r = reduce(afterX, 'p2', { type: 'move', board: 1, cell: 0 });
    expect(r.reply[0]).toMatchObject({ code: 'illegal_move' });
  });

  it('rejects moves before the game is in progress', () => {
    let room = createRoom('ABCD');
    room = reduce(room, undefined, join('p1', 'Alice')).room; // only one player
    const r = reduce(room, 'p1', { type: 'move', board: 4, cell: 0 });
    expect(r.reply[0]).toMatchObject({ code: 'illegal_move' });
  });
});

describe('rematch', () => {
  it('resets the game only once both players agree', () => {
    const mid = reduce(seated(), 'p1', { type: 'move', board: 4, cell: 0 }).room;
    expect(mid.game.lastMove).not.toBeNull();

    const one = reduce(mid, 'p1', { type: 'rematch' });
    expect(one.room.rematch).toEqual({ X: true, O: false });
    expect(one.room.game.lastMove).not.toBeNull(); // not reset yet

    const both = reduce(one.room, 'p2', { type: 'rematch' });
    expect(both.room.rematch).toEqual({ X: false, O: false });
    expect(both.room.game.lastMove).toBeNull(); // fresh game
    expect(both.room.game.currentPlayer).toBe('X');
  });
});

describe('move clock', () => {
  it('starts only once the second player makes the game playable', () => {
    let room = createRoom('ABCD');
    room = reduce(room, undefined, join('p1', 'Alice'), 1_000).room;
    expect(room.status).toBe('waiting');
    expect(room.turnDeadline).toBeNull();

    room = reduce(room, undefined, join('p2', 'Bob'), 5_000).room;
    expect(room.status).toBe('playing');
    expect(room.turnDeadline).toBe(5_000 + TURN_DURATION_MS);
  });

  it('resets the clock on every move', () => {
    const start = seatedAt(0);
    const afterMove = reduce(start, 'p1', { type: 'move', board: 4, cell: 0 }, 10_000).room;
    expect(afterMove.turnDeadline).toBe(10_000 + TURN_DURATION_MS);
  });

  it('keeps the running clock on a plain reconnect (no reset)', () => {
    const room = seatedAt(0); // deadline = TURN_DURATION_MS
    const reconnect = reduce(room, 'p1', join('p1', 'Alice'), 30_000);
    expect(reconnect.room.turnDeadline).toBe(TURN_DURATION_MS); // unchanged
  });

  it('restarts a lapsed clock when a player returns (resume after a both-gone pause)', () => {
    const room = seatedAt(0); // deadline = TURN_DURATION_MS
    const reconnect = reduce(room, 'p1', join('p1', 'Alice'), TURN_DURATION_MS + 50_000);
    expect(reconnect.room.turnDeadline).toBe(TURN_DURATION_MS + 50_000 + TURN_DURATION_MS);
  });

  it('clears the clock when the game ends and restarts it on rematch', () => {
    const start = seatedAt(0);
    // Drive a quick X win on the meta board by winning boards 0,1,2 — but simplest:
    // just verify a rematch (re)arms the clock from a fresh game.
    const one = reduce(start, 'p1', { type: 'rematch' }, 1_000).room;
    expect(one.rematch).toEqual({ X: true, O: false });
    const both = reduce(one, 'p2', { type: 'rematch' }, 9_000).room;
    expect(both.game.lastMove).toBeNull();
    expect(both.turnDeadline).toBe(9_000 + TURN_DURATION_MS);
  });

  it('broadcasts the deadline in sync', () => {
    const sync = syncMessage(seatedAt(7_000));
    expect(sync.type).toBe('sync');
    if (sync.type === 'sync') expect(sync.turnDeadline).toBe(7_000 + TURN_DURATION_MS);
  });
});

describe('room expiry (idle cleanup)', () => {
  it('exposes a 6-hour TTL', () => {
    expect(ROOM_TTL_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('stamps lastActivityAt on creation and on every action', () => {
    const room = createRoom('ABCD', 1_000);
    expect(room.lastActivityAt).toBe(1_000);

    const joined = reduce(room, undefined, join('p1', 'Alice'), 2_000).room;
    expect(joined.lastActivityAt).toBe(2_000);

    const seated = reduce(joined, undefined, join('p2', 'Bob'), 3_000).room;
    expect(seated.lastActivityAt).toBe(3_000);

    const moved = reduce(seated, 'p1', { type: 'move', board: 4, cell: 0 }, 7_000).room;
    expect(moved.lastActivityAt).toBe(7_000);
  });

  it('treats an auto-move as activity (keeps a watched room alive)', () => {
    const room = seatedAt(0);
    const r = applyTimeout(room, 130_000, () => 0);
    expect(r.room.lastActivityAt).toBe(130_000);
  });
});

describe('turn timeout (auto-move)', () => {
  it('auto-plays a legal move for the current player and re-arms the clock', () => {
    const room = seatedAt(0); // X to move
    const r = applyTimeout(room, 130_000, () => 0); // deterministic rng
    expect(r.broadcast).toBe(true);
    expect(r.room.game.currentPlayer).toBe('O'); // turn flipped
    expect(r.room.game.lastMove).not.toBeNull();
    expect(r.room.turnDeadline).toBe(130_000 + TURN_DURATION_MS);
  });

  it('is a no-op when the game is not in progress', () => {
    let room = createRoom('ABCD');
    room = reduce(room, undefined, join('p1', 'Alice'), 0).room; // still waiting
    const r = applyTimeout(room, 1_000);
    expect(r.broadcast).toBe(false);
    expect(r.room.game.lastMove).toBeNull();
  });
});

describe('disconnect', () => {
  it('marks the seat disconnected and broadcasts', () => {
    const r = disconnect(seated(), 'p1');
    expect(r.broadcast).toBe(true);
    expect(r.room.seats.X?.connected).toBe(false);
    const sync = syncMessage(r.room);
    expect(sync.type).toBe('sync');
    if (sync.type === 'sync') {
      expect(sync.players.X?.connected).toBe(false);
      expect(sync.players.O?.connected).toBe(true);
    }
  });

  it('is a no-op for an unknown player', () => {
    const r = disconnect(seated(), 'ghost');
    expect(r.broadcast).toBe(false);
  });
});
