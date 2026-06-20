/**
 * PartyKit adapter. One instance of this class == one match room (a Durable Object).
 *
 * It is intentionally thin: it parses messages, delegates all decisions to the pure `reduce`
 * in `room.ts` (which reuses `@mtt/engine`), persists the room so it survives brief eviction,
 * and fans out replies/broadcasts. All the testable logic lives in `room.ts`.
 */
import type * as Party from 'partykit/server';
import type { ClientMessage } from '@mtt/protocol';
import { createRoom, disconnect, reduce, syncMessage, type RoomState } from './room';

export default class GameServer implements Party.Server {
  private room: RoomState;
  /** Maps an open connection to the player id it joined with. */
  private playerIdByConn = new Map<string, string>();

  constructor(readonly party: Party.Room) {
    this.room = createRoom(party.id);
  }

  async onStart() {
    const saved = await this.party.storage.get<RoomState>('room');
    if (saved) this.room = saved;
  }

  onConnect(conn: Party.Connection) {
    // Send the current shared state right away; the client then sends `join` to claim a seat.
    conn.send(JSON.stringify(syncMessage(this.room)));
  }

  async onMessage(raw: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      sender.send(
        JSON.stringify({ type: 'error', code: 'bad_message', message: 'Malformed message.' }),
      );
      return;
    }

    const connPlayerId =
      msg.type === 'join' ? msg.playerId : this.playerIdByConn.get(sender.id);

    const result = reduce(this.room, connPlayerId, msg);
    this.room = result.room;

    // Bind the connection to its player id once a join is accepted (an `assigned` reply).
    if (msg.type === 'join' && result.reply.some((m) => m.type === 'assigned')) {
      this.playerIdByConn.set(sender.id, msg.playerId);
    }

    for (const m of result.reply) sender.send(JSON.stringify(m));
    if (result.broadcast) this.party.broadcast(JSON.stringify(syncMessage(this.room)));
    await this.persist();
  }

  async onClose(conn: Party.Connection) {
    const playerId = this.playerIdByConn.get(conn.id);
    this.playerIdByConn.delete(conn.id);
    if (!playerId) return;
    const result = disconnect(this.room, playerId);
    this.room = result.room;
    if (result.broadcast) this.party.broadcast(JSON.stringify(syncMessage(this.room)));
    await this.persist();
  }

  private async persist() {
    await this.party.storage.put('room', this.room);
  }
}
