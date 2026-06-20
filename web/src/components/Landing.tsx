import type { Difficulty } from '@mtt/engine';
import { cn } from '../theme';

const RULES_URL = 'https://isstiaung.me/meta-tictactoe-rules-6ac9bc68d079';

interface LandingProps {
  difficulty: Difficulty;
  onChangeDifficulty: (d: Difficulty) => void;
  onStartTwoPlayer: () => void;
  onStartVsComputer: () => void;
  /** Persisted display name used for online play. */
  name: string;
  onChangeName: (name: string) => void;
  /** Open the online (internet PvP) menu. */
  onPlayOnline: () => void;
}

export function Landing({
  difficulty,
  onChangeDifficulty,
  onStartTwoPlayer,
  onStartVsComputer,
  name,
  onChangeName,
  onPlayOnline,
}: LandingProps) {
  return (
    <main className="landing">
      <div className="landing__brand">
        <h1 className="landing__title">
          Meta<b>Tic</b>Tac<i>Toe</i>
        </h1>
        <p className="landing__tagline">
          Nine boards inside one. Win the small games to claim a square — line up three squares to
          win it all. Every move sends your opponent somewhere new.
        </p>
      </div>

      <div className="landing__actions">
        <button type="button" className="btn btn--primary" onClick={onStartTwoPlayer}>
          2 Players
        </button>
        <button type="button" className="btn btn--secondary" onClick={onStartVsComputer}>
          vs Computer
        </button>

        <label className="field">
          <span className="field__label">Your name (for online play)</span>
          <input
            className="field__input"
            type="text"
            value={name}
            maxLength={20}
            placeholder="Player"
            onChange={(e) => onChangeName(e.target.value)}
          />
        </label>

        <button type="button" className="btn btn--secondary" onClick={onPlayOnline}>
          Play Online
        </button>

        <div className="toggle" aria-label="Computer difficulty">
          <span className="toggle__label" id="difficulty-label">
            Computer difficulty
          </span>
          <div className="segmented" role="group" aria-labelledby="difficulty-label">
            {(['easy', 'hard'] as const).map((level) => (
              <button
                key={level}
                type="button"
                className={cn('segmented__btn')}
                aria-pressed={difficulty === level}
                onClick={() => onChangeDifficulty(level)}
              >
                {level === 'easy' ? 'Easy' : 'Hard'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="landing__footer">
        <a className="rules-link" href={RULES_URL} target="_blank" rel="noopener noreferrer">
          How to play (Rules)
        </a>
      </div>
    </main>
  );
}
