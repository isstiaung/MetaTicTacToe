/**
 * Connection auth for the online server — abuse prevention for an anonymous game.
 *
 * There are no accounts, so this is *not* identity auth. It proves two things at the
 * gate, before a Durable Object is ever spun up:
 *   1. a real browser session recently passed a Cloudflare Turnstile challenge, and
 *   2. (in `server.ts`) the source IP is under a per-IP rate cap.
 *
 * The flow is a two-step exchange, because Turnstile tokens are single-use and expire
 * in ~5 minutes while `partysocket` reconnects freely (backgrounded phones, flaky wifi):
 *
 *   - The browser solves Turnstile once and POSTs the token to `/auth`.
 *   - The Worker verifies it with Cloudflare (`verifyTurnstile`) and mints a short-lived
 *     HMAC-signed *session* token (`issueSessionToken`).
 *   - The socket carries that session token on every (re)connect; the gate verifies it
 *     with `verifySessionToken` — a fast local HMAC check, no network, reconnect-safe.
 *
 * Everything here is framework-agnostic and uses only Web Crypto / `fetch` (available in
 * Workers and in vitest/Node), so the token logic is unit-tested without a live server.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/** base64url (no padding) — URL/query-safe and the standard for compact tokens. */
function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4));
  const bin = atob(norm + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Mint a signed session token: `base64url(payload).base64url(hmac)`, where the payload
 * is `{ exp }` (unix seconds). Opaque to the client — it just echoes it back on connect.
 */
export async function issueSessionToken(
  secret: string,
  ttlSeconds: number,
  now: number = Date.now(),
): Promise<string> {
  const payload = { exp: Math.floor(now / 1000) + ttlSeconds };
  const payloadB64 = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64)));
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

/** True iff `token` carries our valid, unexpired signature. Never throws. */
export async function verifySessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlDecode(sigB64),
      enc.encode(payloadB64),
    );
    if (!valid) return false;
    const payload = JSON.parse(dec.decode(b64urlDecode(payloadB64))) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 > now;
  } catch {
    return false;
  }
}

/**
 * Verify a Cloudflare Turnstile token server-side (siteverify). Single-use: once verified
 * a token is spent, which is exactly why we exchange it for a session token rather than
 * re-checking it on each connect.
 */
export async function verifyTurnstile(
  token: string,
  secret: string,
  remoteip?: string,
): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteip) body.append('remoteip', remoteip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * The connect-gate decision. `authSecret` unset (local dev) disables the gate entirely so
 * `wrangler dev` and mobile-against-dev keep working with no setup. In production the
 * secret is set, so a valid session token in the URL's `?token=` is required.
 */
export async function authorizeConnection(
  requestUrl: string,
  authSecret: string | undefined,
  now: number = Date.now(),
): Promise<boolean> {
  if (!authSecret) return true; // dev: gate disabled
  const token = new URL(requestUrl).searchParams.get('token');
  if (!token) return false;
  return verifySessionToken(token, authSecret, now);
}
