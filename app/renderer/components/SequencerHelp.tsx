import { KeyboardIcon, QuestionIcon, XIcon } from "@phosphor-icons/react";
import React from "react";

import { usePopoverDismiss } from "./hooks/shared/usePopoverDismiss";

const isMac =
  typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
const UNDO = isMac ? "⌘Z" : "Ctrl+Z";
const REDO = isMac ? "⇧⌘Z" : "Ctrl+Y";
const ALT = isMac ? "⌥" : "Alt";

/** A key, drawn as a keycap. */
export const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[1.4em] h-[1.4em] px-1 rounded border border-border-default border-b-2 bg-surface-2 font-sans text-[10px] font-semibold leading-none text-text-secondary">
    {children}
  </kbd>
);

interface Shortcut {
  does: string;
  keys: string[];
}

/** Every sequencer shortcut, grouped. */
const ALL_SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: "Sequencer",
    items: [
      { does: "Show / hide the sequencer", keys: ["S"] },
      { does: "Play / stop", keys: ["Space"] },
      { does: "Move between steps", keys: ["←", "↑", "↓", "→"] },
      { does: "Toggle the step", keys: ["Enter"] },
      { does: "Step options (conditions, slice)", keys: ["C", "Right-click"] },
      { does: "Undo / redo", keys: [UNDO, REDO] },
      {
        does: "Close step options, then the slicer, then the kit",
        keys: ["Esc"],
      },
      { does: "These shortcuts", keys: ["?"] },
    ],
  },
  {
    group: "Slice rows",
    items: [
      { does: "Previous / next slice", keys: ["[", "]"] },
      { does: "Shorter / longer", keys: ["{", "}"] },
      { does: "Change slice (Shift: length)", keys: ["Scroll"] },
      { does: "Random slice each time", keys: ["R"] },
      { does: "Lock (rolls skip it)", keys: ["L"] },
      { does: "Roll the row", keys: ["D"] },
      { does: "Audition a span without assigning it", keys: [`${ALT} Drag`] },
    ],
  },
];

/** Opens the shortcut list. A palette secondary button, so it reads as a
 * control rather than another label. */
export const SequencerKeysButton: React.FC<{
  /** Size and shape; the look comes from the palette. */
  className?: string;
  onClick: () => void;
}> = ({ className = "h-7 px-2", onClick }) => (
  <button
    aria-label="Keyboard shortcuts"
    className={`btn-secondary text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary ${className}`}
    data-testid="sequencer-keys-button"
    onClick={onClick}
    title="Keyboard shortcuts (?)"
    type="button"
  >
    <KeyboardIcon size={14} weight="bold" />
    <span className="text-sm leading-none">?</span>
  </button>
);

/** The full shortcut list, over the sequencer. */
export const SequencerKeysOverlay: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  usePopoverDismiss(ref, onClose);
  React.useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      aria-label="Sequencer shortcuts"
      className="absolute right-4 bottom-4 z-40 w-[420px] max-w-[calc(100%-2rem)] rounded-lg border border-border-strong bg-surface-2 shadow-lg p-4 text-xs text-text-primary focus:outline-none"
      data-testid="sequencer-keys-overlay"
      // Keys pressed here are for the overlay, not the grid or the kit;
      // Escape still reaches the dismiss hook
      onKeyDown={(e) => {
        if (e.key === "?") {
          e.preventDefault();
          onClose();
        }
        if (e.key !== "Escape") e.stopPropagation();
      }}
      ref={ref}
      role="dialog"
      tabIndex={-1}
    >
      <div className="flex items-center mb-3">
        <QuestionIcon className="mr-1.5 text-text-tertiary" size={14} />
        <span className="font-semibold">Sequencer shortcuts</span>
        <span className="flex-1" />
        <button
          aria-label="Close shortcuts"
          className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-3"
          onClick={onClose}
          type="button"
        >
          <XIcon size={14} weight="bold" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {ALL_SHORTCUTS.map(({ group, items }) => (
          <div key={group}>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
              {group}
            </div>
            <ul className="flex flex-col gap-1.5">
              {items.map((s) => (
                <li className="flex items-start gap-2" key={s.does}>
                  <span className="flex gap-0.5 shrink-0">
                    {s.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                  <span className="text-text-secondary">{s.does}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
