// SPDX-License-Identifier: MIT

/**
 * Client side of the online-play abuse gate (see `packages/party/src/auth.ts`).
 *
 * The browser solves a Cloudflare Turnstile challenge once (the `<Turnstile>` widget),
 * then trades that token here for a short-lived *session* token via `POST /auth`. The
 * session token is cached (in memory, mirrored to `sessionStorage` so a page refresh keeps it)
 * and handed to the socket on every (re)connect — so reconnects never trigger another challenge.
 *
 * Dev needs zero setup: the site key defaults to Turnstile's always-pass test key and the
 * dev Worker returns a placeholder token (its connect gate is disabled).
 */

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? '127.0.0.1:1999';

/**
 * Turnstile **site** key (public — safe to ship). Defaults to Cloudflare's documented
 * "always passes" test key so local dev works untouched. Set `VITE_TURNSTILE_SITE_KEY`
 * to your real key for production.
 */
export const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA';

/** Local hosts speak http; a deployed `*.workers.dev` speaks https. */
function authBaseUrl(): string {
  const isLocal = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|localhost|0\.0\.0\.0)/.test(
    PARTYKIT_HOST,
  );
  return `${isLocal ? 'http' : 'https'}://${PARTYKIT_HOST}`;
}

const STORAGE_KEY = 'mtt.session';

let cachedToken: string | null = null;
let cachedExpMs = 0;

// Restore a token minted earlier in this tab, so a refresh doesn't re-run the challenge.
try {
  const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as {
    token?: unknown;
    expMs?: unknown;
  } | null;
  if (typeof stored?.token === 'string' && typeof stored.expMs === 'number') {
    cachedToken = stored.token;
    cachedExpMs = stored.expMs;
  }
} catch {
  // Storage unavailable or corrupt — mint a fresh token instead.
}

/** Best-effort read of the `{ exp }` (unix seconds) from a session token's payload. */
function decodeExpMs(token: string): number {
  try {
    const [payload] = token.split('.');
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const { exp } = JSON.parse(atob(padded)) as { exp?: number };
    return typeof exp === 'number' ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** Tokens are treated as expired this long before their real expiry. */
const EXPIRY_MARGIN_MS = 30_000;

/** True while a non-expired session token is cached (30s safety margin). */
export function hasSessionToken(): boolean {
  return cachedToken !== null && Date.now() < sessionTokenExpiresAt();
}

/**
 * Epoch-ms at which the cached token stops counting as valid (0 if none) — when a fresh one
 * must be minted so later reconnects aren't rejected.
 */
export function sessionTokenExpiresAt(): number {
  return cachedToken === null ? 0 : cachedExpMs - EXPIRY_MARGIN_MS;
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
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expMs: cachedExpMs }));
  } catch {
    // Storage unavailable — the in-memory token still works until a refresh.
  }
}

/**
 * The value PartySocket sends as `?token=` on each connection. Empty when no valid token
 * is cached (the menu mints one before navigating, so this is normally populated).
 */
export function currentSessionToken(): string {
  return hasSessionToken() ? (cachedToken as string) : '';
}
