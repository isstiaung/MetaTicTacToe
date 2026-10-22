// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Runtime validation of inbound client messages.
 *
 * The socket is reachable by any client, not just ours, so nothing that arrives on it can be
 * trusted to match the `ClientMessage` type. Everything is parsed here into a well-formed
 * message (or rejected) before it reaches the reducer — in particular display names, which are
 * stored and broadcast to the opponent's UI.
 */
import type { ClientMessage } from '@mtt/protocol';

/** Longest display name accepted (the clients' input `maxLength`). Longer names are cut. */
export const MAX_NAME_LENGTH = 20;

/** Longest player id accepted. Clients send a UUID (36 chars). */
export const MAX_PLAYER_ID_LENGTH = 64;

const isIndex = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 8;

/** Trim, drop control characters, and cap a display name at {@link MAX_NAME_LENGTH} characters. */
export function sanitizeName(name: string): string {
  const clean = name.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
  return Array.from(clean).slice(0, MAX_NAME_LENGTH).join('').trim();
}

/** Parse a raw socket frame into a well-formed `ClientMessage`, or `null` if it isn't one. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as Record<string, unknown>;

  switch (msg.type) {
    case 'join': {
      const { playerId, name } = msg;
      if (typeof playerId !== 'string' || playerId.length === 0) return null;
      if (playerId.length > MAX_PLAYER_ID_LENGTH) return null;
      if (name !== undefined && typeof name !== 'string') return null;
      return { type: 'join', playerId, name: sanitizeName(name ?? '') };
    }
    case 'move':
      return isIndex(msg.board) && isIndex(msg.cell)
        ? { type: 'move', board: msg.board, cell: msg.cell }
        : null;
    case 'rematch':
    case 'claim':
    case 'leave':
      return { type: msg.type };
    default:
      return null;
  }
}
