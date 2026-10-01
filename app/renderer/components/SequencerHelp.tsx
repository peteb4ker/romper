import { QuestionIcon, XIcon } from "@phosphor-icons/react";
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
  keys: React.ReactNode[];
}

const GENERAL: Shortcut[] = [
  { does: "play / stop", keys: ["Space"] },
  { does: "toggle step", keys: ["Enter"] },
  { does: "move", keys: ["←", "↑", "↓", "→"] },
  { does: "undo", keys: [UNDO] },
];

const SLICES: Shortcut[] = [
  { does: "slice", keys: ["[", "]"] },
  { does: "length", keys: ["{", "}"] },
  { does: "random", keys: ["R"] },
  { does: "lock", keys: ["L"] },
  { does: "roll", keys: ["D"] },
];

/** Every sequencer shortcut, grouped. */
const ALL_SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: "Sequencer",
    items: [
      { does: "Show / hide the sequencer", keys: ["S"] },
      { does: "Play / stop", keys: ["Space"] },
      { does: "Move between steps", keys: ["←", "↑", "↓", "→"] },
      { does: "Toggle the step", keys: ["Enter"] },
      { does: "Step options (conditions, slice)", keys: ["Right-click"] },
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

interface SequencerStatusLineProps {
  onShowKeys: () => void;
  /** The focused step is on a slice row: show the slicer keys. */
  sliceRow: boolean;
}

function ShortcutList({ items }: { items: Shortcut[] }) {
  return (
    <>
      {items.map((s) => (
        <span className="inline-flex items-center gap-1" key={s.does}>
          {s.keys.map((k) => (
            <Kbd key={String(k)}>{k}</Kbd>
          ))}
          <span>{s.does}</span>
        </span>
      ))}
    </>
  );
}

/** One line of the shortcuts that matter where focus is. */
export const SequencerStatusLine: React.FC<SequencerStatusLineProps> = ({
  onShowKeys,
  sliceRow,
}) => (
  <div
    className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-tertiary"
    data-testid="sequencer-status-line"
  >
    <ShortcutList items={sliceRow ? SLICES : GENERAL} />
    <span>Right-click a step for options</span>
    <button
      className="inline-flex items-center gap-1 rounded px-1 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
      data-testid="sequencer-keys-button"
      onClick={onShowKeys}
      title="All sequencer shortcuts (?)"
      type="button"
    >
      <Kbd>?</Kbd>
      <span>all keys</span>
    </button>
  </div>
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
                      <Kbd key={String(k)}>{k}</Kbd>
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
