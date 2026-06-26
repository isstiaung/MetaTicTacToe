import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  authorizeConnection,
  issueSessionToken,
  verifySessionToken,
  verifyTurnstile,
} from './auth';

const SECRET = 'test-hmac-secret';
const HOUR = 60 * 60 * 1000;

describe('session tokens', () => {
  it('round-trips a freshly issued token', async () => {
    const token = await issueSessionToken(SECRET, 3600);
    expect(await verifySessionToken(token, SECRET)).toBe(true);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await issueSessionToken(SECRET, 3600);
    expect(await verifySessionToken(token, 'other-secret')).toBe(false);
  });

  it('rejects a tampered payload', async () => {
    const token = await issueSessionToken(SECRET, 3600);
    const [, sig] = token.split('.');
    // Forge a far-future expiry but keep the original signature.
    const forgedPayload = btoa(JSON.stringify({ exp: 9999999999 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(await verifySessionToken(`${forgedPayload}.${sig}`, SECRET)).toBe(false);
  });

  it('rejects an expired token', async () => {
    const now = Date.now();
    const token = await issueSessionToken(SECRET, 3600, now);
    // Two hours later the one-hour token is stale.
    expect(await verifySessionToken(token, SECRET, now + 2 * HOUR)).toBe(false);
  });

  it('rejects malformed input without throwing', async () => {
    expect(await verifySessionToken('', SECRET)).toBe(false);
    expect(await verifySessionToken('not-a-token', SECRET)).toBe(false);
    expect(await verifySessionToken('a.b.c', SECRET)).toBe(false);
  });
});

describe('authorizeConnection', () => {
  it('is open when no auth secret is configured (dev)', async () => {
    expect(await authorizeConnection('wss://host/parties/main/ROOM', undefined)).toBe(true);
  });

  it('rejects a token-less connection when the gate is on', async () => {
    expect(await authorizeConnection('wss://host/parties/main/ROOM', SECRET)).toBe(false);
  });

  it('accepts a connection carrying a valid token', async () => {
    const token = await issueSessionToken(SECRET, 3600);
    const url = `wss://host/parties/main/ROOM?token=${encodeURIComponent(token)}`;
    expect(await authorizeConnection(url, SECRET)).toBe(true);
  });

  it('rejects a connection carrying a forged token', async () => {
    const token = await issueSessionToken('attacker-secret', 3600);
    const url = `wss://host/parties/main/ROOM?token=${encodeURIComponent(token)}`;
    expect(await authorizeConnection(url, SECRET)).toBe(false);
  });
});

describe('verifyTurnstile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when siteverify reports success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
    );
    expect(await verifyTurnstile('tok', 'secret')).toBe(true);
  });

  it('returns false when siteverify reports failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), {
            status: 200,
          }),
      ),
    );
    expect(await verifyTurnstile('tok', 'secret')).toBe(false);
  });

  it('returns false on an empty token without calling the network', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(await verifyTurnstile('', 'secret')).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns false when the network throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    expect(await verifyTurnstile('tok', 'secret')).toBe(false);
  });
});
