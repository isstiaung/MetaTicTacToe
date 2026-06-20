import { describe, it, expect } from 'vitest';
import { createRoom, reduce, disconnect, syncMessage, type RoomState } from './room';
import type { ClientMessage } from '@mtt/protocol';

const join = (playerId: string, name: string): ClientMessage => ({ type: 'join', playerId, name });

/** A room with both seats filled (X = p1/Alice, O = p2/Bob), status 'playing'. */
function seated(): RoomState {
  let room = createRoom('ABCD');
  room = reduce(room, undefined, join('p1', 'Alice')).room;
  room = reduce(room, undefined, join('p2', 'Bob')).room;
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
