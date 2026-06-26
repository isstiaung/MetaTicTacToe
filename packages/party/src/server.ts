/**
 * Cloudflare Workers adapter (via partyserver). One Durable Object instance == one match room.
 *
 * It stays intentionally thin: it parses messages, delegates every decision to the pure `reduce`
 * in `room.ts` (which reuses `@mtt/engine`), persists the room to DO storage so it survives
 * hibernation/eviction, and fans out replies/broadcasts. All testable logic lives in `room.ts`.
 *
 * The Durable Object binding is named `Main`, which partyserver maps to the default party "main"
 * that partysocket uses — so the web and mobile clients connect unchanged.
 *
 * Abuse prevention (see `auth.ts`): the `fetch` handler exposes a `/auth` endpoint that trades a
 * Cloudflare Turnstile solve for a short-lived session token, and `onBeforeConnect` rejects any
 * socket that doesn't carry a valid one — before a Durable Object is created. Both the `/auth`
 * mint and the connection are rate-limited per IP. The gate is active only when its secrets are
 * configured, so local `wrangler dev` stays open and zero-config.
 */
import { Server, routePartykitRequest } from 'partyserver';
import type { Connection } from 'partyserver';
import type { ClientMessage } from '@mtt/protocol';
import {
  applyTimeout,
  createRoom,
  disconnect,
  reduce,
  ROOM_TTL_MS,
  syncMessage,
  type RoomState,
} from './room';
import { authorizeConnection, issueSessionToken, verifyTurnstile } from './auth';

/** Cloudflare's rate-limit binding surface (configured under `ratelimits` in wrangler.jsonc). */
interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  Main: DurableObjectNamespace;
  /** Per-IP cap on session-token minting (the expensive, abuse-prone path). */
  AUTH_LIMITER?: RateLimit;
  /** Per-IP cap on socket connections (blunts connection floods). */
  CONNECT_LIMITER?: RateLimit;
  /** Turnstile secret key (set via `wrangler secret put`). Unset → challenge check skipped (dev). */
  TURNSTILE_SECRET?: string;
  /** HMAC secret for session tokens (set via `wrangler secret put`). Unset → gate disabled (dev). */
  AUTH_SECRET?: string;
  /** Allowed browser origin for `/auth` CORS. Defaults to `*`. */
  WEB_ORIGIN?: string;
}

/** Session tokens last long enough to outlive any single match, so reconnects never re-challenge. */
const SESSION_TTL_SECONDS = 12 * 60 * 60;

/** Per-connection state (survives WebSocket hibernation). */
interface ConnState {
  playerId?: string;
}

export class GameServer extends Server<Env> {
  // Hibernate idle rooms so two players thinking between moves cost ~nothing.
  static options = { hibernate: true };

  private room?: RoomState;

  private async getRoom(): Promise<RoomState> {
    if (!this.room) {
      const stored = await this.ctx.storage.get<RoomState>('room');
      // Coalesce `turnDeadline` so rooms persisted before the move clock existed
      // load with a defined (null) value rather than `undefined`.
      this.room = stored
        ? { ...stored, turnDeadline: stored.turnDeadline ?? null }
        : createRoom(this.name);
    }
    return this.room;
  }

  private async persist(): Promise<void> {
    if (this.room) await this.ctx.storage.put('room', this.room);
  }

  /** True while at least one seat is connected — the move clock only runs then. */
  private someoneConnected(room: RoomState): boolean {
    return Boolean(room.seats.X?.connected || room.seats.O?.connected);
  }

  /** When the move clock is live, the absolute time it lapses; else null. */
  private moveDeadline(room: RoomState): number | null {
    return room.status === 'playing' && room.turnDeadline !== null && this.someoneConnected(room)
      ? room.turnDeadline
      : null;
  }

  /**
   * Keep the single Durable Object alarm in lockstep with the room. Two timers
   * share it: the per-move clock (when a game is live with someone watching) and
   * the idle-room cleanup ({@link ROOM_TTL_MS} after the last action). We always
   * have a cleanup alarm pending, and arm for the earliest of the two.
   */
  private async syncAlarm(): Promise<void> {
    const room = this.room;
    if (!room) return;
    const cleanupAt = room.lastActivityAt + ROOM_TTL_MS;
    const move = this.moveDeadline(room);
    const next = move !== null ? Math.min(move, cleanupAt) : cleanupAt;
    const existing = await this.ctx.storage.getAlarm();
    if (existing !== next) await this.ctx.storage.setAlarm(next);
  }

  /**
   * Fired by the runtime for whichever shared deadline came due:
   *
   * 1. **Cleanup** — the room has been idle for {@link ROOM_TTL_MS}: wipe its
   *    storage (which clears the alarm too) so the code is reusable, and stop.
   * 2. **Move clock** — the current player ran out of time: auto-play an `easy`
   *    move, broadcast it, and re-arm for the next turn.
   *
   * The `+1_000` slack absorbs the runtime firing a hair early; if neither
   * deadline is actually due we just re-arm via `syncAlarm`.
   */
  async onAlarm(): Promise<void> {
    const room = await this.getRoom();
    const now = Date.now();

    if (now + 1_000 >= room.lastActivityAt + ROOM_TTL_MS) {
      // Idle too long — free the room. `deleteAll` also removes the alarm.
      await this.ctx.storage.deleteAll();
      this.room = undefined;
      return;
    }

    const move = this.moveDeadline(room);
    if (move !== null && now + 1_000 >= move) {
      const result = applyTimeout(room, now);
      this.room = result.room;
      if (result.broadcast) this.broadcast(JSON.stringify(syncMessage(this.room)));
      await this.persist();
    }

    await this.syncAlarm();
  }

  async onConnect(conn: Connection<ConnState>) {
    const room = await this.getRoom();
    // Send the current shared state right away; the client then sends `join` to claim a seat.
    conn.send(JSON.stringify(syncMessage(room)));
    // Ensure a cleanup alarm exists even for a connect-only room (no join yet).
    await this.syncAlarm();
  }

  async onMessage(sender: Connection<ConnState>, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string') return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      sender.send(
        JSON.stringify({ type: 'error', code: 'bad_message', message: 'Malformed message.' }),
      );
      return;
    }

    const room = await this.getRoom();
    const connPlayerId = msg.type === 'join' ? msg.playerId : sender.state?.playerId;

    const result = reduce(room, connPlayerId, msg, Date.now());
    this.room = result.room;

    // Bind the connection to its player id once a join is accepted (an `assigned` reply).
    if (msg.type === 'join' && result.reply.some((m) => m.type === 'assigned')) {
      sender.setState({ playerId: msg.playerId });
    }

    for (const m of result.reply) sender.send(JSON.stringify(m));
    if (result.broadcast) this.broadcast(JSON.stringify(syncMessage(this.room)));
    await this.persist();
    await this.syncAlarm();
  }

  async onClose(conn: Connection<ConnState>) {
    const playerId = conn.state?.playerId;
    if (!playerId) return;
    const room = await this.getRoom();
    const result = disconnect(room, playerId);
    this.room = result.room;
    if (result.broadcast) this.broadcast(JSON.stringify(syncMessage(this.room)));
    await this.persist();
    // If that was the last connection, syncAlarm pauses the clock; otherwise it
    // keeps running so the remaining player still gets an auto-move on timeout.
    await this.syncAlarm();
  }
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.WEB_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/**
 * `POST /auth` — trade a Turnstile token for a session token. Rate-limited per IP. In production
 * the Turnstile check runs; in dev (no secret) it's skipped and a placeholder token is returned
 * (the connect gate is also disabled there, so any value passes).
 */
async function handleAuth(request: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, cors);
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const limited = await env.AUTH_LIMITER?.limit({ key: ip });
  if (limited && !limited.success) return json({ error: 'rate_limited' }, 429, cors);

  let turnstileToken = '';
  try {
    const body = (await request.json()) as { turnstileToken?: string };
    turnstileToken = body.turnstileToken ?? '';
  } catch {
    // Missing/invalid body — falls through; rejected below if Turnstile is required.
  }

  if (env.TURNSTILE_SECRET) {
    const human = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, ip);
    if (!human) return json({ error: 'challenge_failed' }, 403, cors);
  }

  const token = env.AUTH_SECRET
    ? await issueSessionToken(env.AUTH_SECRET, SESSION_TTL_SECONDS)
    : 'dev';
  return json({ token }, 200, cors);
}

/** Reject the socket upgrade (pre-Durable-Object) unless it's under the rate cap and authorized. */
async function gateConnection(request: Request, env: Env): Promise<Response | void> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const limited = await env.CONNECT_LIMITER?.limit({ key: ip });
  if (limited && !limited.success) return new Response('rate limited', { status: 429 });

  const ok = await authorizeConnection(request.url, env.AUTH_SECRET);
  if (!ok) return new Response('unauthorized', { status: 401 });
  // returning void lets routePartykitRequest establish the connection
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/auth') return handleAuth(request, env);
    return (
      (await routePartykitRequest(request, env, {
        onBeforeConnect: (req) => gateConnection(req, env),
      })) || new Response('Not Found', { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
