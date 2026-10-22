// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Room codes — the short, shareable names of online match rooms.
 *
 * Shared by both clients so a code generated on one platform is typed, parsed and
 * normalised identically on the other (and in shared links).
 */

/** Code alphabet: A–Z and 2–9 minus the ambiguous O/I/0/1. 32 symbols, so `byte % 32` is unbiased. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Every room code is exactly this many characters. */
export const ROOM_CODE_LENGTH = 4;

type RandomBytes = (count: number) => Uint8Array;

/** Web Crypto when the runtime has it (browsers, Workers, Node); otherwise `Math.random`. */
const defaultRandomBytes: RandomBytes = (count) => {
  const bytes = new Uint8Array(count);
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (webCrypto?.getRandomValues) return webCrypto.getRandomValues(bytes);
  for (let i = 0; i < count; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
};

/**
 * Generate a fresh room code (e.g. "K7P2"). `randomBytes` is injectable for runtimes without
 * Web Crypto (React Native passes expo-crypto's `getRandomBytes`) and for tests.
 */
export function generateRoomCode(randomBytes: RandomBytes = defaultRandomBytes): string {
  const bytes = randomBytes(ROOM_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Normalise user input to a canonical code: upper-case, drop anything outside the alphabet
 * (spaces, dashes, URL junk), and cap at {@link ROOM_CODE_LENGTH}. The result may still be
 * too short — check it with {@link isValidRoomCode}.
 */
export function normalizeRoomCode(raw: string): string {
  let out = '';
  for (const ch of raw.toUpperCase()) {
    if (ROOM_CODE_ALPHABET.includes(ch)) out += ch;
    if (out.length === ROOM_CODE_LENGTH) break;
  }
  return out;
}

/** True iff `code` is a complete, canonical room code. */
export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && normalizeRoomCode(code) === code;
}
