// SPDX-License-Identifier: GPL-3.0-or-later

import { useState } from 'react';
import { isValidRoomCode, normalizeRoomCode } from '@mtt/protocol';
import { AuthChallenge, useSessionToken } from './AuthChallenge';
import { HelpButton } from '../components/HelpButton';

interface OnlineMenuProps {
  name: string;
  onChangeName: (name: string) => void;
  /** Generate a fresh room code and host a game. */
  onCreate: () => void;
  /** Join an existing room by its (normalised, valid) code. */
  onJoin: (code: string) => void;
  onBack: () => void;
}

export function OnlineMenu({ name, onChangeName, onCreate, onJoin, onBack }: OnlineMenuProps) {
  // Normalised as typed (upper-case, code alphabet only), so it's always a code prefix.
  const [joinCode, setJoinCode] = useState('');
  // Abuse gate: a session token must be minted (via Turnstile) before connecting.
  // It may already be cached from earlier this session, in which case skip the challenge.
  const [authReady, markAuthReady] = useSessionToken();

  const trimmedName = name.trim();
  const canPlay = trimmedName.length > 0 && authReady;
  const canJoin = canPlay && isValidRoomCode(joinCode);

  return (
    <main className="landing">
      <div className="landing__brand">
        <h1 className="landing__title">Play Online</h1>
        <p className="landing__tagline">
          Create a game and share the code, or join a friend with theirs.
        </p>
      </div>

      <div className="landing__actions">
        <label className="field">
          <span className="field__label">Your name</span>
          <input
            className="field__input"
            type="text"
            value={name}
            maxLength={20}
            placeholder="Player"
            onChange={(e) => onChangeName(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="btn btn--primary"
          disabled={!canPlay}
          onClick={onCreate}
        >
          Create game
        </button>

        <div className="field field--row">
          <input
            className="field__input"
            type="text"
            value={joinCode}
            placeholder="Enter code"
            aria-label="Room code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canJoin) onJoin(joinCode);
            }}
          />
          <button
            type="button"
            className="btn btn--secondary"
            disabled={!canJoin}
            onClick={() => onJoin(joinCode)}
          >
            Join game
          </button>
        </div>

        {/* Invisible/managed Turnstile challenge — only shows UI if interaction is needed. */}
        {!authReady && <AuthChallenge onReady={markAuthReady} />}
      </div>

      <p className="fine-print">Inactive rooms are freed after 6 hours.</p>

      <div className="landing__footer landing__footer--row">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          &larr; Back to menu
        </button>
        <HelpButton />
      </div>
    </main>
  );
}
