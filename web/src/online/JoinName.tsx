// SPDX-License-Identifier: GPL-3.0-or-later

import { HelpButton } from '../components/HelpButton';

interface JoinNameProps {
  /** The room code being joined (from the shared link). */
  code: string;
  name: string;
  onChangeName: (name: string) => void;
  /** Proceed into the room once a name is set. */
  onJoin: () => void;
  /** Abandon the join and go home. */
  onBack: () => void;
}

/**
 * Name-entry step shown when arriving via a shared `?room=` link with no saved
 * name — so a first-time joiner can introduce themselves before the board opens.
 */
export function JoinName({ code, name, onChangeName, onJoin, onBack }: JoinNameProps) {
  const canJoin = name.trim().length > 0;

  return (
    <main className="landing">
      <div className="landing__brand">
        <h1 className="landing__title">Join game</h1>
        <p className="landing__tagline">
          You’re joining room <b>{code}</b>. Pick a name so your opponent knows who you are.
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
            autoFocus
            onChange={(e) => onChangeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canJoin) onJoin();
            }}
          />
        </label>

        <button type="button" className="btn btn--primary" disabled={!canJoin} onClick={onJoin}>
          Join game
        </button>
      </div>

      <div className="landing__footer landing__footer--row">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          &larr; Cancel
        </button>
        <HelpButton />
      </div>
    </main>
  );
}
