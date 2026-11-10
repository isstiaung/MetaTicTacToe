// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useState } from 'react';
import { Turnstile } from './Turnstile';
import {
  exchangeTurnstileToken,
  hasSessionToken,
  sessionTokenExpiresAt,
  TURNSTILE_SITE_KEY,
} from './auth';

/**
 * Whether a valid session token is cached. Flips back to `false` when the token expires, so the
 * caller re-renders an {@link AuthChallenge} and mints a fresh one before the next reconnect
 * needs it. The second value marks a token as freshly minted.
 */
export function useSessionToken(): [ready: boolean, markReady: () => void] {
  const [ready, setReady] = useState(hasSessionToken);

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setReady(false), Math.max(0, sessionTokenExpiresAt() - Date.now()));
    return () => clearTimeout(id);
  }, [ready]);

  const markReady = useCallback(() => setReady(hasSessionToken()), []);
  return [ready, markReady];
}

/** How long to wait for Turnstile before also offering a retry (it can stall without erroring). */
const STALL_MS = 30_000;

interface AuthChallengeProps {
  /** Called once a session token has been minted and cached. */
  onReady: () => void;
}

/**
 * The online abuse gate's client step: runs the (normally invisible) Turnstile challenge and
 * trades its token for a session token, offering a retry on failure. Render it only while a
 * token is needed.
 */
export function AuthChallenge({ onReady }: AuthChallengeProps) {
  const [failed, setFailed] = useState(false);
  // Still no token after STALL_MS: the widget stays up (it may yet succeed, or be awaiting a
  // click), but a retry is offered so the player is never stuck on "Verifying…".
  const [stalled, setStalled] = useState(false);
  // Bumping this remounts the widget to retry after a failure.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (failed) return;
    const id = setTimeout(() => setStalled(true), STALL_MS);
    return () => clearTimeout(id);
  }, [failed, attempt]);

  const handleVerify = useCallback(
    async (turnstileToken: string) => {
      try {
        await exchangeTurnstileToken(turnstileToken);
        onReady();
      } catch {
        setFailed(true);
      }
    },
    [onReady],
  );

  const retry = useCallback(() => {
    setFailed(false);
    setStalled(false);
    setAttempt((n) => n + 1);
  }, []);

  if (failed) {
    return (
      <div className="online-auth">
        <span className="status__hint" style={{ color: 'var(--mtt-danger)' }}>
          Verification failed.
        </span>
        <button type="button" className="btn btn--ghost" onClick={retry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="online-auth">
      <Turnstile
        key={attempt}
        siteKey={TURNSTILE_SITE_KEY}
        onVerify={handleVerify}
        onError={() => setFailed(true)}
      />
      <span className="status__hint">
        {stalled ? 'Verification is taking longer than usual.' : 'Verifying you’re human…'}
      </span>
      {stalled && (
        <button type="button" className="btn btn--ghost" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
