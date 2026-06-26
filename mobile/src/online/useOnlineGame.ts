/**
 * Online (internet PvP) game hook.
 *
 * Mirrors the web client's logic over the same `@mtt/protocol` wire format and the same
 * `partysocket` transport. The PartyKit server is AUTHORITATIVE: this hook never calls
 * `applyMove`. It renders whatever `sync.game` the server broadcasts and only sends intents
 * (`join` / `move` / `rematch` / `leave`).
 *
 * Reconnection: `partysocket` auto-reconnects, which covers the app being backgrounded. We
 * (re-)send `join {playerId, name}` on every `open`, so the server re-binds the socket to our
 * existing seat each time.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PartySocket } from 'partysocket';
import { createGame, type GameState } from '@mtt/engine';
import type {
  ClientMessage,
  RematchState,
  RoomPlayers,
  RoomStatus,
  Seat,
  ServerMessage,
} from '@mtt/protocol';
import { PARTYKIT_HOST } from './config';
import { loadName, loadPlayerId } from './identity';

export interface UseOnlineGame {
  /** Authoritative game state from the server (a fresh game until the first `sync`). */
  state: GameState;
  /** Room lifecycle status from the server. */
  status: RoomStatus;
  /** Which seat the server assigned us, once we've joined. */
  you: Seat | null;
  /** Both seats' names + connection flags. */
  players: RoomPlayers;
  /** Whether each seat has asked for a rematch. */
  rematch: RematchState;
  /** Whether the websocket is currently open. */
  connected: boolean;
  /** The room code (from the server's `assigned`, falling back to the one we connected with). */
  code: string;
  /** Epoch-ms deadline for the current move (server auto-plays on lapse), or null. */
  turnDeadline: number | null;
  /** A surfaced, human-readable error from the server, or null. */
  error: string | null;
  /** Send a move intent (server validates turn + legality). */
  sendMove: (board: number, cell: number) => void;
  /** Ask for a rematch. */
  sendRematch: () => void;
  /** Leave the room and tear down the socket. */
  leave: () => void;
}

const EMPTY_PLAYERS: RoomPlayers = {};
const NO_REMATCH: RematchState = { X: false, O: false };

export function useOnlineGame(code: string): UseOnlineGame {
  const [state, setState] = useState<GameState>(createGame);
  const [status, setStatus] = useState<RoomStatus>('waiting');
  const [you, setYou] = useState<Seat | null>(null);
  const [players, setPlayers] = useState<RoomPlayers>(EMPTY_PLAYERS);
  const [rematch, setRematch] = useState<RematchState>(NO_REMATCH);
  const [connected, setConnected] = useState(false);
  const [serverCode, setServerCode] = useState(code);
  const [turnDeadline, setTurnDeadline] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<PartySocket | null>(null);
  // Our identity, resolved async once and reused for every (re)join.
  const identityRef = useRef<{ playerId: string; name: string } | null>(null);

  const sendJoin = useCallback(() => {
    const socket = socketRef.current;
    const identity = identityRef.current;
    if (!socket || !identity) return;
    const msg: ClientMessage = {
      type: 'join',
      playerId: identity.playerId,
      name: identity.name,
    };
    socket.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket: PartySocket | null = null;

    const handleOpen = () => {
      if (cancelled) return;
      setConnected(true);
      setError(null);
      // (Re)claim our seat on every open — covers the initial connect AND every auto-reconnect.
      sendJoin();
    };

    const handleClose = () => {
      if (cancelled) return;
      setConnected(false);
    };

    const handleMessage = (event: MessageEvent) => {
      if (cancelled) return;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      switch (msg.type) {
        case 'assigned':
          setYou(msg.you);
          setServerCode(msg.code);
          setError(null);
          break;
        case 'sync':
          setState(msg.game);
          setStatus(msg.status);
          setPlayers(msg.players);
          setRematch(msg.rematch);
          setTurnDeadline(msg.turnDeadline);
          break;
        case 'error':
          if (msg.code === 'not_joined') {
            // Our seat binding was lost (e.g. reconnect race) — re-announce ourselves.
            sendJoin();
          } else {
            setError(msg.message);
          }
          break;
      }
    };

    // Resolve identity first (async), then open the socket. The host doesn't change for the
    // lifetime of this hook, so we connect once and let partysocket auto-reconnect.
    (async () => {
      const [playerId, name] = await Promise.all([loadPlayerId(), loadName()]);
      if (cancelled) return;
      identityRef.current = { playerId, name };

      socket = new PartySocket({ host: PARTYKIT_HOST, room: code });
      socketRef.current = socket;
      socket.addEventListener('open', handleOpen);
      socket.addEventListener('close', handleClose);
      socket.addEventListener('message', handleMessage);
    })();

    return () => {
      cancelled = true;
      const s = socket;
      if (s) {
        s.removeEventListener('open', handleOpen);
        s.removeEventListener('close', handleClose);
        s.removeEventListener('message', handleMessage);
        // Best-effort polite leave before closing.
        try {
          const leaveMsg: ClientMessage = { type: 'leave' };
          s.send(JSON.stringify(leaveMsg));
        } catch {
          // Socket may already be closed — ignore.
        }
        s.close();
      }
      socketRef.current = null;
    };
  }, [code, sendJoin]);

  const sendMove = useCallback((board: number, cell: number) => {
    const socket = socketRef.current;
    if (!socket) return;
    const msg: ClientMessage = { type: 'move', board, cell };
    socket.send(JSON.stringify(msg));
  }, []);

  const sendRematch = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const msg: ClientMessage = { type: 'rematch' };
    socket.send(JSON.stringify(msg));
  }, []);

  const leave = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    try {
      const msg: ClientMessage = { type: 'leave' };
      socket.send(JSON.stringify(msg));
    } catch {
      // Ignore.
    }
    socket.close();
  }, []);

  return {
    state,
    status,
    you,
    players,
    rematch,
    connected,
    code: serverCode,
    turnDeadline,
    error,
    sendMove,
    sendRematch,
    leave,
  };
}
