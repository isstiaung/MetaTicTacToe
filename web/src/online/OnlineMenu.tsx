// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useState } from 'react';
import { Turnstile } from './Turnstile';
import { HelpButton } from '../components/HelpButton';
import { exchangeTurnstileToken, hasSessionToken, TURNSTILE_SITE_KEY } from './auth';

interface OnlineMenuProps {
  name: string;
  onChangeName: (name: string) => void;
  /** Generate a fresh room code and host a game. */
  onCreate: () => void;
  /** Join an existing room by its (already-normalised) code. */
  onJoin: (code: string) => void;
  onBack: () => void;
}

export function OnlineMenu({ name, onChangeName, onCreate, onJoin, onBack }: OnlineMenuProps) {
  const [joinCode, setJoinCode] = useState('');
  // Abuse gate: a session token must be minted (via Turnstile) before connecting.
  // It may already be cached from earlier this session, in which case skip the challenge.
  const [authReady, setAuthReady] = useState(hasSessionToken);
  const [authError, setAuthError] = useState(false);
  // Bumping this remounts the widget to retry after a failure.
  const [turnstileKey, setTurnstileKey] = useState(0);

  const handleVerify = useCallback(async (turnstileToken: string) => {
    try {
      await exchangeTurnstileToken(turnstileToken);
      setAuthError(false);
      setAuthReady(true);
    } catch {
      setAuthError(true);
    }
  }, []);

  const retryAuth = useCallback(() => {
    setAuthError(false);
    setTurnstileKey((k) => k + 1);
  }, []);

  const trimmedName = name.trim();
  const canPlay = trimmedName.length > 0 && authReady;
  const canJoin = canPlay && joinCode.trim().length >= 3;

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
            maxLength={8}
            placeholder="Enter code"
            aria-label="Room code"
            autoCapitalize="characters"
            spellCheck={false}
            style={{ textTransform: 'uppercase' }}
            onChange={(e) => setJoinCode(e.target.value)}
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
        {!authReady && !authError && (
          <div className="online-auth">
            <Turnstile
              key={turnstileKey}
              siteKey={TURNSTILE_SITE_KEY}
              onVerify={handleVerify}
              onError={() => setAuthError(true)}
            />
            <span className="status__hint">Verifying you’re human…</span>
          </div>
        )}
        {authError && (
          <div className="online-auth">
            <span className="status__hint" style={{ color: 'var(--mtt-danger)' }}>
              Verification failed.
            </span>
            <button type="button" className="btn btn--ghost" onClick={retryAuth}>
              Retry
            </button>
          </div>
        )}
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
