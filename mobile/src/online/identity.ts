// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Persisted player identity for online play.
 *
 * - `playerId` is a stable, opaque id generated once per install. The server uses it to
 *   re-bind a reconnecting socket to the same seat (so backgrounding the app and coming
 *   back keeps your X/O), so it MUST survive restarts.
 * - `name` is the display name the player picked (editable on the Landing / Online menu).
 *
 * Both are stored via AsyncStorage. Reads are best-effort: if storage is unavailable we
 * still return a usable (in-memory) playerId so a match can start.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const PLAYER_ID_KEY = '@mtt/playerId';
const NAME_KEY = '@mtt/playerName';

/** A random fallback id if `expo-crypto` is somehow unavailable. */
function fallbackId(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `p_${rand()}${rand()}`;
}

function newPlayerId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return fallbackId();
  }
}

/** Load the stable player id, generating + persisting one the first time. */
export async function loadPlayerId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    const id = newPlayerId();
    await AsyncStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    // Storage failed — still hand back a usable (ephemeral) id.
    return newPlayerId();
  }
}

/** Load the saved display name, or an empty string if none has been set. */
export async function loadName(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(NAME_KEY)) ?? '';
  } catch {
    return '';
  }
}

/** Persist the display name (best-effort). */
export async function saveName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(NAME_KEY, name);
  } catch {
    // Ignore — name will just not persist across launches.
  }
}
