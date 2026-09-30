import type { SliceStep } from "@romper/shared/sliceTypes";

import React from "react";

import {
  nudgeLengthSlices,
  setStartSlice,
  toSliceView,
} from "./hooks/shared/sliceConstants";

interface SliceStepEditorProps {
  division: number;
  onChange: (edit: (step: SliceStep) => SliceStep) => void;
  step: SliceStep;
}

const smallButton =
  "w-5 h-5 flex items-center justify-center rounded border border-border-default bg-surface-2 hover:bg-surface-3 text-xs disabled:opacity-40";

/** Slice section of a step's right-click popover. */
const SliceStepEditor: React.FC<SliceStepEditorProps> = ({
  division,
  onChange,
  step,
}) => {
  const view = toSliceView(step, division);
  const maxLength = division - view.startSlice;

  return (
    <div
      className="px-3 py-1.5 flex flex-col gap-1.5 text-xs text-text-primary min-w-[180px]"
      data-testid="slice-step-editor"
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
        Slice
      </div>
      <label className="flex items-center justify-between gap-2">
        Plays slice
        <input
          aria-label="Slice number"
          className="w-14 h-5 px-1 rounded border border-border-default bg-surface-1 text-right"
          data-testid="slice-step-start"
          disabled={step.random}
          max={division}
          min={1}
          onChange={(e) => {
            const value = Number.parseInt(e.target.value, 10);
            if (Number.isNaN(value)) return;
            onChange((s) => setStartSlice(s, value - 1, division));
          }}
          type="number"
          value={view.startSlice + 1}
        />
      </label>
      <div className="flex items-center justify-between gap-2">
        <span>Length</span>
        <span className="flex items-center gap-1">
          <button
            aria-label="Shorter"
            className={smallButton}
            data-testid="slice-step-shorter"
            disabled={view.lengthSlices <= 1}
            onClick={() => onChange((s) => nudgeLengthSlices(s, -1, division))}
            type="button"
          >
            −
          </button>
          <span
            className="w-12 text-center tabular-nums"
            data-testid="slice-step-length"
          >
            {view.lengthSlices} {view.lengthSlices === 1 ? "slice" : "slices"}
          </span>
          <button
            aria-label="Longer"
            className={smallButton}
            data-testid="slice-step-longer"
            disabled={view.lengthSlices >= maxLength}
            onClick={() => onChange((s) => nudgeLengthSlices(s, 1, division))}
            type="button"
          >
            +
          </button>
        </span>
      </div>
      <label
        className="flex items-center gap-1.5"
        title="Pick a new random slice every time this step plays (R)"
      >
        <input
          checked={step.random}
          data-testid="slice-step-random"
          onChange={() => onChange((s) => ({ ...s, random: !s.random }))}
          type="checkbox"
        />
        Random slice each time
      </label>
      <label
        className="flex items-center gap-1.5"
        title="Rolls leave locked steps alone (L)"
      >
        <input
          checked={step.locked}
          data-testid="slice-step-lock"
          onChange={() => onChange((s) => ({ ...s, locked: !s.locked }))}
          type="checkbox"
        />
        Lock (rolls skip it)
      </label>
    </div>
  );
};

export default SliceStepEditor;
