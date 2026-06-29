// SPDX-License-Identifier: GPL-3.0-or-later

import type { GameState } from '@mtt/engine';
import { boardScore } from '@mtt/engine';

interface ScoreProps {
  state: GameState;
}

/**
 * A subtle readout of how many sub-boards each player has won (the meta-board
 * score). X is shown in the indigo accent, O in emerald — matching the marks
 * used elsewhere. Recomputes from `state` each render, so it stays live as
 * boards are claimed. Shared by the local and online game headers.
 */
export function Score({ state }: ScoreProps) {
  const score = boardScore(state);
  return (
    <span className="score" aria-label={`Boards won — X ${score.X}, O ${score.O}`}>
      <span className="score__side score__side--X">
        <span className="score__mark">X</span>
        <span className="score__num">{score.X}</span>
      </span>
      <span className="score__sep" aria-hidden="true">
        ·
      </span>
      <span className="score__side score__side--O">
        <span className="score__mark">O</span>
        <span className="score__num">{score.O}</span>
      </span>
    </span>
  );
}
