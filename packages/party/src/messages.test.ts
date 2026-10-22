// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { MAX_NAME_LENGTH, parseClientMessage, sanitizeName } from './messages';

const parse = (v: unknown) => parseClientMessage(JSON.stringify(v));

describe('parseClientMessage', () => {
  it('accepts well-formed messages', () => {
    expect(parse({ type: 'join', playerId: 'p1', name: 'Alice' })).toEqual({
      type: 'join',
      playerId: 'p1',
      name: 'Alice',
    });
    expect(parse({ type: 'move', board: 4, cell: 0 })).toEqual({ type: 'move', board: 4, cell: 0 });
    expect(parse({ type: 'rematch' })).toEqual({ type: 'rematch' });
    expect(parse({ type: 'claim' })).toEqual({ type: 'claim' });
    expect(parse({ type: 'leave' })).toEqual({ type: 'leave' });
  });

  it('drops unknown extra fields', () => {
    expect(parse({ type: 'rematch', evil: { deep: true } })).toEqual({ type: 'rematch' });
  });

  it('rejects malformed frames and unknown types', () => {
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage('null')).toBeNull();
    expect(parseClientMessage('42')).toBeNull();
    expect(parse({ type: 'bogus' })).toBeNull();
    expect(parse({})).toBeNull();
  });

  it('rejects a join whose name or playerId is not a string', () => {
    expect(parse({ type: 'join', playerId: 'p1', name: { evil: true } })).toBeNull();
    expect(parse({ type: 'join', playerId: 'p1', name: ['x'] })).toBeNull();
    expect(parse({ type: 'join', playerId: 7, name: 'Alice' })).toBeNull();
    expect(parse({ type: 'join', playerId: '', name: 'Alice' })).toBeNull();
    expect(parse({ type: 'join', playerId: 'p'.repeat(65), name: 'Alice' })).toBeNull();
  });

  it('treats a missing name as empty (the server then picks a default)', () => {
    expect(parse({ type: 'join', playerId: 'p1' })).toEqual({ type: 'join', playerId: 'p1', name: '' });
  });

  it('caps oversized names instead of storing them', () => {
    const msg = parse({ type: 'join', playerId: 'p1', name: 'x'.repeat(500_000) });
    expect(msg?.type === 'join' && msg.name.length).toBe(MAX_NAME_LENGTH);
  });

  it('rejects moves that are not whole numbers in 0..8', () => {
    expect(parse({ type: 'move', board: '4', cell: 0 })).toBeNull();
    expect(parse({ type: 'move', board: 4.5, cell: 0 })).toBeNull();
    expect(parse({ type: 'move', board: 9, cell: 0 })).toBeNull();
    expect(parse({ type: 'move', board: 0, cell: -1 })).toBeNull();
    expect(parse({ type: 'move', board: 0 })).toBeNull();
  });
});

describe('sanitizeName', () => {
  it('trims and strips control characters', () => {
    expect(sanitizeName('  Al\u0000ice\n ')).toBe('Alice');
  });

  it('counts emoji as single characters when capping', () => {
    expect(Array.from(sanitizeName('😀'.repeat(30)))).toHaveLength(MAX_NAME_LENGTH);
  });
});
