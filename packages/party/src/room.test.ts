// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import {
  applyTimeout,
  CLAIM_WIN_AFTER_MS,
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

/** A seated room whose game has been played out to the end (status 'ended'). */
function finished(now = 0): RoomState {
  let room = seatedAt(now);
  // Deterministic auto-moves (rng = 0) until the game ends.
  for (let i = 0; i < 81 && room.status === 'playing'; i += 1) {
    room = applyTimeout(room, now, () => 0).room;
  }
  expect(room.status).toBe('ended');
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

  it('does not let one connection take a second seat under another playerId', () => {
    let room = createRoom('ABCD');
    room = reduce(room, undefined, join('p1', 'Alice')).room;
    // The same connection (bound to p1) tries to join again as p1b.
    const r = reduce(room, 'p1', join('p1b', 'Alice again'));
    expect(r.reply[0]).toMatchObject({ type: 'error', code: 'bad_message' });
    expect(r.room.seats.O).toBeUndefined();
    // The real opponent still gets the second seat.
    const friend = reduce(r.room, undefined, join('p2', 'Bob'));
    expect(friend.reply).toContainEqual({ type: 'assigned', you: 'O', code: 'ABCD' });
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
    const ended = finished();

    const one = reduce(ended, 'p1', { type: 'rematch' });
    expect(one.room.rematch).toEqual({ X: true, O: false });
    expect(one.room.game.winner).not.toBeNull(); // not reset yet
    expect(one.reseated).toBeFalsy();

    const both = reduce(one.room, 'p2', { type: 'rematch' });
    expect(both.room.rematch).toEqual({ X: false, O: false });
    expect(both.room.game.lastMove).toBeNull(); // fresh game
    expect(both.room.status).toBe('playing');
  });

  it('swaps seats so the other player opens the next game', () => {
    const one = reduce(finished(), 'p1', { type: 'rematch' }).room;
    const both = reduce(one, 'p2', { type: 'rematch' });
    expect(both.reseated).toBe(true);
    expect(both.room.seats.X).toMatchObject({ playerId: 'p2', name: 'Bob' });
    expect(both.room.seats.O).toMatchObject({ playerId: 'p1', name: 'Alice' });
    expect(both.room.game.currentPlayer).toBe('X'); // Bob, now X, moves first
  });

  it('rejects a rematch request while the game is still being played', () => {
    const mid = reduce(seated(), 'p1', { type: 'move', board: 4, cell: 0 }).room;
    const r = reduce(mid, 'p1', { type: 'rematch' });
    expect(r.reply[0]).toMatchObject({ type: 'error', code: 'illegal_move' });
    expect(r.room.rematch).toEqual({ X: false, O: false });
    expect(r.broadcast).toBe(false);
  });
});

describe('move clock', () => {
  /** A seated room with the opening move already played, so the clock is running. */
  function started(now: number): RoomState {
    return reduce(seatedAt(0), 'p1', { type: 'move', board: 4, cell: 0 }, now).room;
  }

  it('leaves the opening move untimed, then starts the clock on the first move', () => {
    let room = createRoom('ABCD');
    room = reduce(room, undefined, join('p1', 'Alice'), 1_000).room;
    expect(room.turnDeadline).toBeNull();

    room = reduce(room, undefined, join('p2', 'Bob'), 5_000).room;
    expect(room.status).toBe('playing');
    expect(room.turnDeadline).toBeNull(); // opening move is untimed (rules-explainer grace)

    const moved = reduce(room, 'p1', { type: 'move', board: 4, cell: 0 }, 8_000).room;
    expect(moved.turnDeadline).toBe(8_000 + TURN_DURATION_MS);
  });

  it('resets the clock on every move', () => {
    const afterFirst = started(10_000); // clock armed at the first move
    const afterSecond = reduce(afterFirst, 'p2', { type: 'move', board: 0, cell: 0 }, 20_000).room;
    expect(afterSecond.turnDeadline).toBe(20_000 + TURN_DURATION_MS);
  });

  it('keeps the running clock on a plain reconnect (no reset)', () => {
    const room = started(1_000); // deadline = 1_000 + TURN_DURATION_MS
    const reconnect = reduce(room, 'p2', join('p2', 'Bob'), 30_000);
    expect(reconnect.room.turnDeadline).toBe(1_000 + TURN_DURATION_MS); // unchanged
  });

  it('restarts a lapsed clock when a player returns (resume after a both-gone pause)', () => {
    const room = started(1_000); // deadline = 1_000 + TURN_DURATION_MS
    const at = 1_000 + TURN_DURATION_MS + 50_000; // well past the deadline
    const reconnect = reduce(room, 'p2', join('p2', 'Bob'), at);
    expect(reconnect.room.turnDeadline).toBe(at + TURN_DURATION_MS);
  });

  it('keeps the new game untimed until its first move on rematch', () => {
    const start = finished(1_000);
    const one = reduce(start, 'p1', { type: 'rematch' }, 2_000).room;
    expect(one.rematch).toEqual({ X: true, O: false });
    const both = reduce(one, 'p2', { type: 'rematch' }, 9_000).room;
    expect(both.game.lastMove).toBeNull();
    expect(both.turnDeadline).toBeNull(); // fresh game's opening move is untimed again
  });

  it('broadcasts the deadline in sync once the clock is running', () => {
    const sync = syncMessage(started(7_000));
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

  it('records when the seat went offline and clears it on rejoin', () => {
    const gone = disconnect(seated(), 'p2', 5_000).room;
    expect(gone.seats.O?.disconnectedAt).toBe(5_000);
    // A second close (e.g. a stale socket) keeps the original time.
    expect(disconnect(gone, 'p2', 9_000).room.seats.O?.disconnectedAt).toBe(5_000);
    const back = reduce(gone, undefined, join('p2', 'Bob'), 6_000).room;
    expect(back.seats.O).toMatchObject({ connected: true, disconnectedAt: null });
  });
});

describe('claiming the win (opponent offline)', () => {
  /** Mid-game, with Bob (O) offline since t = 10_000. */
  function bobGone(): RoomState {
    const mid = reduce(seatedAt(0), 'p1', { type: 'move', board: 4, cell: 0 }, 1_000).room;
    return disconnect(mid, 'p2', 10_000).room;
  }
  const claim = { type: 'claim' } as const;

  it('advertises when the claim opens', () => {
    const sync = syncMessage(bobGone());
    if (sync.type !== 'sync') throw new Error('expected sync');
    expect(sync.claimableAt).toBe(10_000 + CLAIM_WIN_AFTER_MS);
    expect(sync.forfeit).toBeNull();
  });

  it('has nothing to claim while both are present, or both are gone', () => {
    const both = syncMessage(seated());
    const neither = syncMessage(disconnect(bobGone(), 'p1', 11_000).room);
    expect(both.type === 'sync' && both.claimableAt).toBeNull();
    expect(neither.type === 'sync' && neither.claimableAt).toBeNull();
  });

  it('rejects a claim before the grace period is over', () => {
    const r = reduce(bobGone(), 'p1', claim, 10_000 + CLAIM_WIN_AFTER_MS - 1);
    expect(r.reply[0]).toMatchObject({ type: 'error', code: 'cannot_claim' });
    expect(r.room.status).toBe('playing');
  });

  it('rejects a claim against an opponent who is connected', () => {
    const r = reduce(seated(), 'p1', claim, 10_000_000);
    expect(r.reply[0]).toMatchObject({ code: 'cannot_claim' });
  });

  it('ends the game as a forfeit once the grace period is over', () => {
    const r = reduce(bobGone(), 'p1', claim, 10_000 + CLAIM_WIN_AFTER_MS);
    expect(r.broadcast).toBe(true);
    expect(r.room.status).toBe('ended');
    expect(r.room.game.winner).toBe('X');
    expect(r.room.forfeit).toBe('O');
    expect(r.room.turnDeadline).toBeNull();
  });

  it('clears the forfeit when a rematch starts', () => {
    let room = reduce(bobGone(), 'p1', claim, 10_000 + CLAIM_WIN_AFTER_MS).room;
    room = reduce(room, undefined, join('p2', 'Bob'), 80_000).room; // Bob returns
    room = reduce(room, 'p1', { type: 'rematch' }, 81_000).room;
    room = reduce(room, 'p2', { type: 'rematch' }, 82_000).room;
    expect(room.forfeit).toBeNull();
    expect(room.status).toBe('playing');
  });
});
