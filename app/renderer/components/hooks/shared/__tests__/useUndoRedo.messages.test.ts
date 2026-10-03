import type { AnyUndoAction } from "@romper/shared/undoTypes";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { undoFailureMessage, useUndoRedo } from "../useUndoRedo";

const addAction: AnyUndoAction = {
  data: {
    addedSample: { filename: "kick.wav", source_path: "/src/kick.wav" },
    slot: 2,
    voice: 1,
  },
  description: "Add sample to voice 1, slot 3",
  id: "a1",
  timestamp: new Date(),
  type: "ADD_SAMPLE",
};

function setup() {
  const onMessage = vi.fn();
  const hook = renderHook(() => useUndoRedo("A0", onMessage));
  act(() => hook.result.current.addAction(addAction));
  return { onMessage, result: hook.result };
}

describe("[UC-26] [UC-36] telling the user when undo or redo fails (RE-40)", () => {
  beforeEach(() => {
    vi.mocked(globalThis.electronAPI.deleteSampleFromSlot).mockResolvedValue({
      success: true,
    });
    vi.mocked(globalThis.electronAPI.addSampleToSlot).mockResolvedValue({
      data: { sampleId: 1 },
      success: true,
    });
  });

  it("names the change an undo couldn't reverse", async () => {
    vi.mocked(globalThis.electronAPI.deleteSampleFromSlot).mockResolvedValue({
      error: "SQLITE_BUSY: database is locked",
      success: false,
    });
    const { onMessage, result } = setup();

    await act(async () => {
      await result.current.undo();
    });

    expect(onMessage).toHaveBeenCalledWith(
      "Couldn't undo: add sample to voice 1, slot 3. Check the kit, then try again.",
      "error",
    );
    // The reason is kept for debugging, not shown
    expect(result.current.error).toBe("SQLITE_BUSY: database is locked");
    expect(result.current.canUndo).toBe(true);
  });

  it("reports an undo that throws", async () => {
    vi.mocked(globalThis.electronAPI.deleteSampleFromSlot).mockRejectedValue(
      new Error("IPC channel closed"),
    );
    const { onMessage, result } = setup();

    await act(async () => {
      await result.current.undo();
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][0]).toBe(
      "Couldn't undo: add sample to voice 1, slot 3. Check the kit, then try again.",
    );
  });

  it("reports a redo that fails", async () => {
    const { onMessage, result } = setup();
    await act(async () => {
      await result.current.undo();
    });
    expect(onMessage).not.toHaveBeenCalled();

    vi.mocked(globalThis.electronAPI.addSampleToSlot).mockResolvedValue({
      error: "Sample file not found",
      success: false,
    });
    await act(async () => {
      await result.current.redo();
    });

    expect(onMessage).toHaveBeenCalledWith(
      "Couldn't redo: add sample to voice 1, slot 3. Check the kit, then try again.",
      "error",
    );
    expect(result.current.canRedo).toBe(true);
  });

  it("reports a redo that throws", async () => {
    const { onMessage, result } = setup();
    await act(async () => {
      await result.current.undo();
    });

    vi.mocked(globalThis.electronAPI.addSampleToSlot).mockRejectedValue(
      new Error("IPC channel closed"),
    );
    await act(async () => {
      await result.current.redo();
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][0]).toMatch(/^Couldn't redo: /);
  });

  it("says nothing when undo works", async () => {
    const { onMessage, result } = setup();

    await act(async () => {
      await result.current.undo();
    });

    expect(onMessage).not.toHaveBeenCalled();
    expect(result.current.canRedo).toBe(true);
  });

  it("drops the reindexing note from a delete's description", () => {
    expect(
      undoFailureMessage(
        {
          ...addAction,
          description: "Delete sample from voice 2, slot 4 (with reindexing)",
        },
        "undo",
      ),
    ).toBe(
      "Couldn't undo: delete sample from voice 2, slot 4. Check the kit, then try again.",
    );
  });
});
