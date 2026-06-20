import { useState } from 'react';

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
  const trimmedName = name.trim();
  const canPlay = trimmedName.length > 0;
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
      </div>

      <div className="landing__footer">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          &larr; Back to menu
        </button>
      </div>
    </main>
  );
}
