// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Client side of the online-play abuse gate (see `packages/party/src/auth.ts`) for mobile.
 *
 * Mirrors `web/src/online/auth.ts`: a Cloudflare Turnstile challenge is solved once (via the
 * `TurnstileModal` WebView), traded here for a short-lived *session* token at `POST /auth`,
 * cached in memory, and handed to the socket on every (re)connect — so reconnects never trigger
 * another challenge.
 *
 * Dev needs zero setup: the site key defaults to Turnstile's always-pass test key and the dev
 * Worker's connect gate is disabled (it returns a placeholder token).
 */
import { PARTYKIT_HOST } from './config';

/** Local hosts speak http; a deployed Worker speaks https. */
function authBaseUrl(): string {
  const isLocal = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|localhost|0\.0\.0\.0)/.test(
    PARTYKIT_HOST,
  );
  return `${isLocal ? 'http' : 'https'}://${PARTYKIT_HOST}`;
}

let cachedToken: string | null = null;
let cachedExpMs = 0;

/** Minimal base64 decoder (RN has no `atob` in its type lib) for reading the token payload. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decodeBase64(input: string): string {
  const str = input.replace(/=+$/, '');
  let output = '';
  let bc = 0;
  let bs = 0;
  for (let i = 0; i < str.length; i += 1) {
    const idx = B64.indexOf(str.charAt(i));
    if (idx === -1) continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
  }
  return output;
}

/** Best-effort read of the `{ exp }` (unix seconds) from a session token's payload. */
function decodeExpMs(token: string): number {
  try {
    const [payload] = token.split('.');
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const { exp } = JSON.parse(decodeBase64(padded)) as { exp?: number };
    return typeof exp === 'number' ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** True while a non-expired session token is cached (30s safety margin). */
export function hasSessionToken(): boolean {
  return cachedToken !== null && Date.now() < cachedExpMs - 30_000;
}

/**
 * Exchange a freshly solved Turnstile token for a session token and cache it.
 * Throws if the server rejects the challenge or is unreachable.
 */
export async function exchangeTurnstileToken(turnstileToken: string): Promise<void> {
  const res = await fetch(`${authBaseUrl()}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turnstileToken }),
  });
  if (!res.ok) throw new Error(`auth failed (${res.status})`);
  const { token } = (await res.json()) as { token?: string };
  if (!token) throw new Error('auth returned no token');
  cachedToken = token;
  // Real tokens carry an exp; the dev placeholder doesn't — fall back to ~1h.
  cachedExpMs = decodeExpMs(token) || Date.now() + 60 * 60 * 1000;
}

/**
 * The value PartySocket sends as `?token=` on each connection. Empty when no valid token is
 * cached (the online menu mints one before connecting, so this is normally populated).
 */
export function currentSessionToken(): string {
  return hasSessionToken() ? (cachedToken as string) : '';
}
