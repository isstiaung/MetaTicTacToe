// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Deep-link helpers for shared room links — the mobile counterpart of the web app's
 * `?room=CODE` URLs (see `web/src/online/useOnlineGame.ts`).
 *
 * Opening a link routes into the join flow (and the name-entry step if no name is saved).
 * Links use the app's custom scheme (`mttt://join?room=CODE`, set in `app.json`). If you also
 * serve the web app and configure universal/app links, set `expo.extra.webAppUrl` so shared
 * links open the web app for recipients who don't have the native app.
 */
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { isValidRoomCode, normalizeRoomCode } from '@mtt/protocol';

/** Optional public web-app origin (e.g. `https://mttt.example.com`) for shareable https links. */
const WEB_APP_URL: string =
  (Constants.expoConfig?.extra?.webAppUrl as string | undefined) ?? '';

/** Build a shareable link that opens the app (or web app) to join `code`. */
export function roomShareUrl(code: string): string {
  if (WEB_APP_URL) {
    const base = WEB_APP_URL.replace(/\/+$/, '');
    return `${base}/?room=${encodeURIComponent(code)}`;
  }
  try {
    return Linking.createURL('join', { queryParams: { room: code } });
  } catch {
    return code;
  }
}

/** A valid room code from `raw`, or '' if it isn't one. */
function validCode(raw: string): string {
  const code = normalizeRoomCode(raw);
  return isValidRoomCode(code) ? code : '';
}

/** Extract a valid room code from an incoming deep link, or '' if none is present. */
export function parseRoomFromUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parsed = Linking.parse(url);
    const fromQuery = parsed.queryParams?.room ?? parsed.queryParams?.code;
    if (fromQuery) return validCode(String(fromQuery));
    // Path-style fallback: mttt://join/CODE  ->  path "join/CODE".
    const path = parsed.path ?? '';
    const match = /(?:^|\/)join\/([^/?#]+)/.exec(path);
    return match ? validCode(match[1]) : '';
  } catch {
    return '';
  }
}
