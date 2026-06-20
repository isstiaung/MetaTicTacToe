/**
 * Online (internet PvP) game hook.
 *
 * Encapsulates the PartyKit connection lifecycle and the wire protocol so the UI
 * only sees plain React state. The server is authoritative: clients render the
 * `sync.game` it broadcasts and never call `applyMove` themselves.
 *
 * Flow:
 *  1. A stable `playerId` (persisted) identifies this player across reconnects so
 *     the server can re-seat them.
 *  2. On socket `open` we send `join {playerId, name}` — also on every automatic
 *     reconnect (partysocket reconnects for us).
 *  3. `assigned` stores our seat; `sync` drives game/status/players/rematch;
 *     `error` with `not_joined` triggers a re-join, everything else surfaces a note.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PartySocket } from 'partysocket';
import { createGame } from '@mtt/engine';
import type { GameState } from '@mtt/engine';
import type {
  ClientMessage,
  RematchState,
  RoomPlayers,
  RoomStatus,
  Seat,
  ServerMessage,
} from '@mtt/protocol';

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? '127.0.0.1:1999';

const PLAYER_ID_KEY = 'mtt.playerId';
const NAME_KEY = 'mtt.name';

/** Read (and lazily create) the stable player id persisted in localStorage. */
export function getPlayerId(): string {
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage disabled: fall back to an ephemeral id.
    return crypto.randomUUID();
  }
}

/** Read the persisted display name, defaulting to "Player". */
export function getStoredName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? 'Player';
  } catch {
    return 'Player';
  }
}

/** Persist the display name for future sessions. */
export function storeName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generate a short, human-friendly room code (no ambiguous 0/O/1/I). */
export function generateRoomCode(length = 4): string {
  let code = '';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i += 1) {
    code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

/** Normalise a user-typed code to the canonical room name (upper-case). */
export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

export interface OnlineGame {
  state: GameState;
  status: RoomStatus;
  you: Seat | null;
  players: RoomPlayers;
  rematch: RematchState;
  connected: boolean;
  code: string;
  /** A transient, human-readable error surfaced to the UI (e.g. illegal move). */
  error: string | null;
  sendMove: (board: number, cell: number) => void;
  sendRematch: () => void;
  leave: () => void;
}

/**
 * Connect to the room identified by `code`. Pass an empty `code` to stay
 * disconnected (used before the player has created/joined a room).
 */
export function useOnlineGame(code: string, name: string): OnlineGame {
  const [state, setState] = useState<GameState>(createGame);
  const [status, setStatus] = useState<RoomStatus>('waiting');
  const [you, setYou] = useState<Seat | null>(null);
  const [players, setPlayers] = useState<RoomPlayers>({});
  const [rematch, setRematch] = useState<RematchState>({ X: false, O: false });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<PartySocket | null>(null);
  // Keep the latest name in a ref so a reconnect always joins with the current
  // name without forcing the socket effect to tear down on each keystroke.
  const nameRef = useRef(name);
  nameRef.current = name;

  const send = useCallback((msg: ClientMessage) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }, []);

  const join = useCallback(() => {
    send({ type: 'join', playerId: getPlayerId(), name: nameRef.current });
  }, [send]);

  useEffect(() => {
    if (!code) {
      socketRef.current = null;
      return;
    }

    // Reset per-room view state when (re)connecting to a code.
    setYou(null);
    setError(null);
    setConnected(false);

    const socket = new PartySocket({ host: PARTYKIT_HOST, room: code });
    socketRef.current = socket;

    const onOpen = () => {
      setConnected(true);
      setError(null);
      // Claim (or reclaim) our seat — runs on first open and every reconnect.
      send({ type: 'join', playerId: getPlayerId(), name: nameRef.current });
    };

    const onMessage = (event: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      switch (msg.type) {
        case 'assigned':
          setYou(msg.you);
          break;
        case 'sync':
          setState(msg.game);
          setStatus(msg.status);
          setPlayers(msg.players);
          setRematch(msg.rematch);
          break;
        case 'error':
          if (msg.code === 'not_joined') {
            join();
          } else {
            setError(msg.message);
          }
          break;
      }
    };

    const onClose = () => setConnected(false);

    socket.addEventListener('open', onOpen);
    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onClose);

    return () => {
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('close', onClose);
      // Best-effort notify the server, then tear the socket down.
      try {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({ type: 'leave' } satisfies ClientMessage));
        }
      } catch {
        // ignore
      }
      socket.close();
      socketRef.current = null;
    };
    // Only re-establish the connection when the room code changes; name updates
    // ride along via nameRef without reconnecting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const sendMove = useCallback(
    (board: number, cell: number) => {
      setError(null);
      send({ type: 'move', board, cell });
    },
    [send],
  );

  const sendRematch = useCallback(() => {
    send({ type: 'rematch' });
  }, [send]);

  const leave = useCallback(() => {
    send({ type: 'leave' });
  }, [send]);

  return {
    state,
    status,
    you,
    players,
    rematch,
    connected,
    code,
    error,
    sendMove,
    sendRematch,
    leave,
  };
}
