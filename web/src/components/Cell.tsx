import { memo } from 'react';
import type { Cell as CellValue } from '@mtt/engine';
import { cn } from '../theme';

interface CellProps {
  value: CellValue;
  playable: boolean;
  isLast: boolean;
  /** Accessible label, e.g. "Board 1, cell 5, empty". */
  label: string;
  onPlay: () => void;
}

function CellBase({ value, playable, isLast, label, onPlay }: CellProps) {
  return (
    <button
      type="button"
      className={cn(
        'cell',
        value === 'X' && 'cell--X',
        value === 'O' && 'cell--O',
        playable && 'cell--playable',
        isLast && 'cell--last',
      )}
      // Disabled cells stay in the tab order would be noisy; only playable cells
      // are real controls. Filled/blocked cells are inert and unfocusable.
      disabled={!playable}
      aria-label={label}
      onClick={playable ? onPlay : undefined}
    >
      {value && <span className="cell__mark">{value}</span>}
    </button>
  );
}

export const Cell = memo(CellBase);
