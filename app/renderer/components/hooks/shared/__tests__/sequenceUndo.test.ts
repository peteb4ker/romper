import type { SequenceSnapshot } from "@romper/shared/undoTypes";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSequenceEditAction,
  mergeSequenceEdit,
  SEQUENCE_MERGE_WINDOW_MS,
  writeSequenceSnapshot,
} from "../sequenceUndo";

function snapshot(step = 0, condition: null | string = null): SequenceSnapshot {
  const stepPattern = Array.from({ length: 4 }, () => new Array(16).fill(0));
  stepPattern[0][0] = step;
  const triggerConditions = Array.from({ length: 4 }, () =>
    new Array(16).fill(null),
  );
  triggerConditions[0][0] = condition;
  const sliceSteps = Array.from({ length: 4 }, () => new Array(16).fill(null));
  return { sliceSteps, stepPattern, triggerConditions };
}

describe("mergeSequenceEdit", () => {
  const a = snapshot(0);
  const b = snapshot(127);
  const c = snapshot(127, "1:2");

  it("folds an edit with the same key into the previous one", () => {
    const first = createSequenceEditAction("Edit", a, b, "slice:0:0");
    const second = createSequenceEditAction("Edit", b, c, "slice:0:0");

    const merged = mergeSequenceEdit(first, second);

    expect(merged?.data.before).toBe(a);
    expect(merged?.data.after).toBe(c);
  });

  it("keeps edits apart without a key, with different keys, or too far apart", () => {
    const first = createSequenceEditAction("Edit", a, b, "slice:0:0");
    expect(
      mergeSequenceEdit(first, createSequenceEditAction("Edit", b, c)),
    ).toBeNull();
    expect(
      mergeSequenceEdit(
        first,
        createSequenceEditAction("Edit", b, c, "slice:0:1"),
      ),
    ).toBeNull();

    const late = createSequenceEditAction("Edit", b, c, "slice:0:0");
    late.timestamp = new Date(
      first.timestamp.getTime() + SEQUENCE_MERGE_WINDOW_MS + 1,
    );
    expect(mergeSequenceEdit(first, late)).toBeNull();
  });

  it("never merges into a sample action", () => {
    const sampleAction = {
      ...createSequenceEditAction("Edit", a, b, "k"),
      type: "ADD_SAMPLE",
    } as never;
    expect(
      mergeSequenceEdit(sampleAction, createSequenceEditAction("E", b, c, "k")),
    ).toBeNull();
  });
});

describe("writeSequenceSnapshot", () => {
  beforeEach(() => {
    vi.mocked(globalThis.electronAPI.updateStepPattern).mockResolvedValue({
      success: true,
    });
    vi.mocked(globalThis.electronAPI.updateTriggerConditions).mockResolvedValue(
      { success: true },
    );
    vi.mocked(globalThis.electronAPI.updateSliceSteps).mockResolvedValue({
      success: true,
    });
  });

  it("writes only the parts that change", async () => {
    const target = snapshot(127);

    const result = await writeSequenceSnapshot("A0", target, snapshot(0));

    expect(result).toEqual({ success: true });
    expect(globalThis.electronAPI.updateStepPattern).toHaveBeenCalledWith(
      "A0",
      target.stepPattern,
    );
    expect(
      globalThis.electronAPI.updateTriggerConditions,
    ).not.toHaveBeenCalled();
    expect(globalThis.electronAPI.updateSliceSteps).not.toHaveBeenCalled();
  });

  it("reports a failed write", async () => {
    vi.mocked(globalThis.electronAPI.updateTriggerConditions).mockResolvedValue(
      { error: "disk full", success: false },
    );

    const result = await writeSequenceSnapshot(
      "A0",
      snapshot(0, "1:2"),
      snapshot(0),
    );

    expect(result).toEqual({ error: "disk full", success: false });
  });
});
