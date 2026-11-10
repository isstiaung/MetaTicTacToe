// SPDX-License-Identifier: MIT

/**
 * Adapter tests for `server.ts`: the parts that depend on live connections (which socket is bound
 * to which player) and therefore can't be covered by the pure `room.ts` reducer tests.
 * `partyserver` is replaced by a minimal in-memory stand-in; storage is a Map.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ServerMessage } from '@mtt/protocol';

vi.mock('partyserver', () => {
  class Server {
    static options = {};
    name = 'ABCD';
    /** Open connections by id — the test harness adds and removes them. */
    connections = new Map<string, unknown>();
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
    getConnections() {
      return this.connections.values();
    }
    broadcast(msg: string) {
      for (const c of this.connections.values()) (c as { send: (m: string) => void }).send(msg);
    }
  }
  return { Server, routePartykitRequest: vi.fn(async () => null) };
});

const { GameServer, default: worker } = await import('./server');

type Conn = Parameters<InstanceType<typeof GameServer>['onClose']>[0];

class FakeConnection {
  state: { playerId?: string } | undefined;
  sent: ServerMessage[] = [];
  constructor(public id: string) {}
  send(msg: string) {
    this.sent.push(JSON.parse(msg) as ServerMessage);
  }
  setState(state: { playerId?: string }) {
    this.state = state;
  }
  lastSync() {
    const sync = [...this.sent].reverse().find((m) => m.type === 'sync');
    if (sync?.type !== 'sync') throw new Error('no sync received');
    return sync;
  }
  seats() {
    return this.sent.flatMap((m) => (m.type === 'assigned' ? [m.you] : []));
  }
  errors() {
    return this.sent.flatMap((m) => (m.type === 'error' ? [m.code] : []));
  }
}

function fakeStorage() {
  const data = new Map<string, unknown>();
  let alarm: number | null = null;
  return {
    get: async (key: string) => structuredClone(data.get(key)),
    put: async (key: string, value: unknown) => void data.set(key, structuredClone(value)),
    deleteAll: async () => {
      data.clear();
      alarm = null;
    },
    getAlarm: async () => alarm,
    setAlarm: async (at: number) => void (alarm = at),
  };
}

function harness() {
  const server = new GameServer({ storage: fakeStorage() } as never, {} as never);
  const live = (server as unknown as { connections: Map<string, FakeConnection> }).connections;
  let nextId = 0;
  return {
    async open() {
      const conn = new FakeConnection(`c${(nextId += 1)}`);
      live.set(conn.id, conn);
      await server.onConnect(conn as unknown as Conn);
      return conn;
    },
    /** Close as the runtime does: the handler runs, then the socket is gone. */
    async close(conn: FakeConnection) {
      await server.onClose(conn as unknown as Conn);
      live.delete(conn.id);
    },
    send(conn: FakeConnection, msg: unknown) {
      return server.onMessage(conn as unknown as Conn, typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  };
}

const join = (playerId: string, name: string) => ({ type: 'join', playerId, name });

describe('message validation', () => {
  it('rejects malformed frames and unknown types with bad_message', async () => {
    const h = harness();
    const a = await h.open();
    await h.send(a, 'not json');
    await h.send(a, { type: 'bogus' });
    await h.send(a, null);
    expect(a.errors()).toEqual(['bad_message', 'bad_message', 'bad_message']);
  });

  it('never stores or broadcasts a non-string name', async () => {
    const h = harness();
    const a = await h.open();
    const b = await h.open();
    await h.send(a, { type: 'join', playerId: 'p1', name: { evil: true } });
    expect(a.errors()).toEqual(['bad_message']);
    await h.send(b, join('p2', 'Bob'));
    expect(b.lastSync().players).toEqual({ X: { name: 'Bob', connected: true } });
  });
});

describe('connection-aware presence', () => {
  it('keeps a reconnected player online when the stale socket closes late', async () => {
    const h = harness();
    const alice = await h.open();
    const bob = await h.open();
    await h.send(alice, join('p1', 'Alice'));
    await h.send(bob, join('p2', 'Bob'));

    // Bob's phone switches networks: a new socket rejoins before the old one is noticed dead.
    const bobAgain = await h.open();
    await h.send(bobAgain, join('p2', 'Bob'));
    await h.close(bob);

    expect(alice.lastSync().players.O?.connected).toBe(true);
    expect(alice.lastSync().claimableAt).toBeNull();
  });

  it('marks a player offline when their last connection closes', async () => {
    const h = harness();
    const alice = await h.open();
    const bob = await h.open();
    await h.send(alice, join('p1', 'Alice'));
    await h.send(bob, join('p2', 'Bob'));
    await h.close(bob);
    expect(alice.lastSync().players.O?.connected).toBe(false);
    expect(alice.lastSync().claimableAt).not.toBeNull();
  });

  it('ignores a leave from one of two open tabs', async () => {
    const h = harness();
    const alice = await h.open();
    const bobTab1 = await h.open();
    const bobTab2 = await h.open();
    await h.send(alice, join('p1', 'Alice'));
    await h.send(bobTab1, join('p2', 'Bob'));
    await h.send(bobTab2, join('p2', 'Bob'));

    await h.send(bobTab1, { type: 'leave' });
    await h.close(bobTab1);
    expect(alice.lastSync().players.O?.connected).toBe(true);

    await h.send(bobTab2, { type: 'leave' });
    expect(alice.lastSync().players.O?.connected).toBe(false);
  });

  it('does not let one socket hold both seats', async () => {
    const h = harness();
    const a = await h.open();
    await h.send(a, join('p1', 'Alice'));
    await h.send(a, join('p1-alt', 'Alice'));
    expect(a.errors()).toEqual(['bad_message']);

    const friend = await h.open();
    await h.send(friend, join('p2', 'Bob'));
    expect(friend.seats()).toEqual(['O']);
  });
});

describe('rematch', () => {
  it('re-sends each player their swapped seat', async () => {
    const h = harness();
    const alice = await h.open();
    const bob = await h.open();
    await h.send(alice, join('p1', 'Alice'));
    await h.send(bob, join('p2', 'Bob'));

    // End the game quickly: Bob drops, and Alice claims once the grace period is over.
    await h.close(bob);
    vi.useFakeTimers({ now: Date.now() + 61_000 });
    try {
      await h.send(alice, { type: 'claim' });
    } finally {
      vi.useRealTimers();
    }
    expect(alice.lastSync()).toMatchObject({ status: 'ended', forfeit: 'O' });

    const bobBack = await h.open();
    await h.send(bobBack, join('p2', 'Bob'));
    await h.send(alice, { type: 'rematch' });
    await h.send(bobBack, { type: 'rematch' });

    expect(alice.seats().at(-1)).toBe('O');
    expect(bobBack.seats().at(-1)).toBe('X');
    expect(alice.lastSync()).toMatchObject({ status: 'playing', forfeit: null });
    expect(alice.lastSync().players).toMatchObject({ X: { name: 'Bob' }, O: { name: 'Alice' } });
  });
});

describe('POST /auth', () => {
  const post = (env: Record<string, string>) =>
    worker.fetch(
      new Request('https://party.example/auth', { method: 'POST', body: '{}' }),
      env as never,
    );

  it('returns a placeholder token in dev (no secrets)', async () => {
    const res = await post({});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: 'dev' });
  });

  it('refuses to mint tokens when AUTH_SECRET is set without TURNSTILE_SECRET', async () => {
    const res = await post({ AUTH_SECRET: 'secret' });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'turnstile_not_configured' });
  });
});
