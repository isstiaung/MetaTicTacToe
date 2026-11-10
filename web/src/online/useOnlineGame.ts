// SPDX-License-Identifier: MIT

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
 *  3. `assigned` stores our seat (re-sent when seats swap on a rematch); `sync` drives
 *     game/status/players/rematch/claim; `error` with `not_joined` triggers a re-join,
 *     everything else surfaces a note.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PartySocket } from 'partysocket';
import { createGame } from '@mtt/engine';
import { isValidRoomCode, normalizeRoomCode } from '@mtt/protocol';
import { currentSessionToken } from './auth';
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

/** Whether the player has ever set a display name (vs. the "Player" default). */
export function hasStoredName(): boolean {
  try {
    return (localStorage.getItem(NAME_KEY) ?? '').trim().length > 0;
  } catch {
    return false;
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

const ROOM_PARAM = 'room';

/** Read a valid room code from the current URL (`?room=CODE`), or '' if there is none. */
export function getRoomFromUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = normalizeRoomCode(params.get(ROOM_PARAM) ?? '');
    return isValidRoomCode(code) ? code : '';
  } catch {
    return '';
  }
}

/** Build a shareable absolute URL that auto-joins the given room code. */
export function roomShareUrl(code: string): string {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(ROOM_PARAM, code);
    url.hash = '';
    return url.toString();
  } catch {
    return code;
  }
}

/**
 * Reflect the active room in the address bar (`?room=CODE`) without adding a
 * history entry, so a refresh rejoins and the link is always shareable. Pass
 * `null` to clear it (e.g. on leaving the room).
 */
export function setRoomInUrl(code: string | null): void {
  try {
    const url = new URL(window.location.href);
    if (code) url.searchParams.set(ROOM_PARAM, code);
    else url.searchParams.delete(ROOM_PARAM);
    window.history.replaceState(null, '', url.toString());
  } catch {
    // History/URL unavailable — auto-join via link simply won't persist.
  }
}

export interface OnlineGame {
  state: GameState;
  status: RoomStatus;
  you: Seat | null;
  players: RoomPlayers;
  rematch: RematchState;
  connected: boolean;
  code: string;
  /** Epoch-ms deadline for the current move (server auto-plays on lapse), or null. */
  turnDeadline: number | null;
  /** Epoch-ms from which we may claim the win (opponent offline that long), or null. */
  claimableAt: number | null;
  /** The seat that lost by forfeit, or null. */
  forfeit: Seat | null;
  /** A transient, human-readable error surfaced to the UI (e.g. illegal move). */
  error: string | null;
  sendMove: (board: number, cell: number) => void;
  sendRematch: () => void;
  sendClaim: () => void;
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
  const [turnDeadline, setTurnDeadline] = useState<number | null>(null);
  const [claimableAt, setClaimableAt] = useState<number | null>(null);
  const [forfeit, setForfeit] = useState<Seat | null>(null);
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

    // `query` runs on every (re)connect: attach the cached session token so the
    // server's connect gate lets us through. The token is minted on the online menu.
    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: code,
      query: async () => ({ token: currentSessionToken() }),
    });
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
          setTurnDeadline(msg.turnDeadline);
          setClaimableAt(msg.claimableAt);
          setForfeit(msg.forfeit);
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
    setError(null);
    send({ type: 'rematch' });
  }, [send]);

  const sendClaim = useCallback(() => {
    setError(null);
    send({ type: 'claim' });
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
    turnDeadline,
    claimableAt,
    forfeit,
    error,
    sendMove,
    sendRematch,
    sendClaim,
    leave,
  };
}
