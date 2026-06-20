/**
 * Cloudflare Workers adapter (via partyserver). One Durable Object instance == one match room.
 *
 * It stays intentionally thin: it parses messages, delegates every decision to the pure `reduce`
 * in `room.ts` (which reuses `@mtt/engine`), persists the room to DO storage so it survives
 * hibernation/eviction, and fans out replies/broadcasts. All testable logic lives in `room.ts`.
 *
 * The Durable Object binding is named `Main`, which partyserver maps to the default party "main"
 * that partysocket uses — so the web and mobile clients connect unchanged.
 */
import { Server, routePartykitRequest } from 'partyserver';
import type { Connection } from 'partyserver';
import type { ClientMessage } from '@mtt/protocol';
import { createRoom, disconnect, reduce, syncMessage, type RoomState } from './room';

interface Env {
  Main: DurableObjectNamespace;
}

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
      this.room = (await this.ctx.storage.get<RoomState>('room')) ?? createRoom(this.name);
    }
    return this.room;
  }

  private async persist(): Promise<void> {
    if (this.room) await this.ctx.storage.put('room', this.room);
  }

  async onConnect(conn: Connection<ConnState>) {
    const room = await this.getRoom();
    // Send the current shared state right away; the client then sends `join` to claim a seat.
    conn.send(JSON.stringify(syncMessage(room)));
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

    const result = reduce(room, connPlayerId, msg);
    this.room = result.room;

    // Bind the connection to its player id once a join is accepted (an `assigned` reply).
    if (msg.type === 'join' && result.reply.some((m) => m.type === 'assigned')) {
      sender.setState({ playerId: msg.playerId });
    }

    for (const m of result.reply) sender.send(JSON.stringify(m));
    if (result.broadcast) this.broadcast(JSON.stringify(syncMessage(this.room)));
    await this.persist();
  }

  async onClose(conn: Connection<ConnState>) {
    const playerId = conn.state?.playerId;
    if (!playerId) return;
    const room = await this.getRoom();
    const result = disconnect(room, playerId);
    this.room = result.room;
    if (result.broadcast) this.broadcast(JSON.stringify(syncMessage(this.room)));
    await this.persist();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routePartykitRequest(request, env)) || new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
