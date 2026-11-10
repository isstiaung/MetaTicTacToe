// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from './roomCode';

describe('generateRoomCode', () => {
  it('produces a valid code from the default (Web Crypto) source', () => {
    for (let i = 0; i < 50; i += 1) expect(isValidRoomCode(generateRoomCode())).toBe(true);
  });

  it('maps injected random bytes onto the alphabet', () => {
    const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => i * 33); // 0, 33, 66, 99
    expect(generateRoomCode(bytes)).toBe(
      [0, 33, 66, 99].map((b) => ROOM_CODE_ALPHABET[b % 32]).join(''),
    );
  });
});

describe('normalizeRoomCode', () => {
  it('upper-cases and strips anything outside the alphabet', () => {
    expect(normalizeRoomCode(' k7-p2 ')).toBe('K7P2');
  });

  it('drops the ambiguous characters the generator never emits', () => {
    expect(normalizeRoomCode('HELLO')).toBe('HELL');
    expect(normalizeRoomCode('A0B1')).toBe('AB');
  });

  it('neutralises URL-significant characters', () => {
    expect(normalizeRoomCode('AB/../CD?x=1')).toBe('ABCD');
  });

  it('caps the result at the code length', () => {
    expect(normalizeRoomCode('ABCDEFGH')).toHaveLength(ROOM_CODE_LENGTH);
  });
});

describe('isValidRoomCode', () => {
  it('accepts only complete canonical codes', () => {
    expect(isValidRoomCode('K7P2')).toBe(true);
    expect(isValidRoomCode('k7p2')).toBe(false);
    expect(isValidRoomCode('K7P')).toBe(false);
    expect(isValidRoomCode('K7PO')).toBe(false);
  });
});
