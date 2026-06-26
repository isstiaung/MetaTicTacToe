import { useState } from 'react';
import { RulesModal } from './RulesModal';

/**
 * A self-contained "?" button that opens the rules explainer. Drop it into any
 * top bar or footer — it manages its own modal open state.
 */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn btn--ghost help-btn"
        onClick={() => setOpen(true)}
        aria-label="How to play"
        title="How to play"
      >
        ?
      </button>
      {open && <RulesModal onClose={() => setOpen(false)} />}
    </>
  );
}
