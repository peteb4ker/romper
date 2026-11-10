import type { KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addSampleAction,
  reindexSamplesAction,
} from "../../../../../../tests/factories/undoAction.factory";
import { useSampleManagementOperations } from "../../sample-management/useSampleManagementOperations";
import { createSequenceEditAction } from "../sequenceUndo";
import { useRedoActionHandlers } from "../useRedoActionHandlers";
import { useUndoActionHandlers } from "../useUndoActionHandlers";
import { useUndoRedo } from "../useUndoRedo";
import { useUndoRedoState } from "../useUndoRedoState";

/** A promise the test settles, standing in for an IPC call still running */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const emptySequence = {
  sliceSteps: [],
  stepPattern: [],
  triggerConditions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// #887: stepping to another kit (the `.` key) while an edit, an undo or a
// redo is still running must not put it on the new kit's history, and an
// undo acts on the kit its entry was made in
describe("[UC-26] [Q-02] An undo entry belongs to the kit it was made in", () => {
  it("drops an add that finishes after you step to another kit", async () => {
    const add = deferred<{ data: { kit: KitWithRelations }; success: true }>();
    vi.mocked(globalThis.electronAPI.addSampleToSlot).mockReturnValueOnce(
      add.promise as never,
    );
    const { rerender, result } = renderHook(
      ({ kit }) => {
        const history = useUndoRedo(kit);
        const ops = useSampleManagementOperations({
          kitName: kit,
          onAddUndoAction: history.addAction,
          skipUndoRecording: false,
        });
        return { history, ops };
      },
      { initialProps: { kit: "A0" } },
    );

    let adding!: Promise<boolean>;
    act(() => {
      adding = result.current.ops.handleSampleAdd(1, 0, "/samples/kick.wav");
    });
    rerender({ kit: "B0" });
    await act(async () => {
      add.resolve({ data: { kit: {} as KitWithRelations }, success: true });
      await adding;
    });

    expect(globalThis.electronAPI.addSampleToSlot).toHaveBeenCalledWith(
      "A0",
      1,
      0,
      "/samples/kick.wav",
    );
    expect(result.current.history.undoCount).toBe(0);
  });

  it("drops an entry for another kit, whichever addAction it comes through", () => {
    const { rerender, result } = renderHook(
      ({ kit }) => useUndoRedoState({ kitName: kit }),
      { initialProps: { kit: "A0" } },
    );
    const addForA0 = result.current.addAction;
    rerender({ kit: "B0" });

    act(() => {
      addForA0(addSampleAction({ kitName: "A0" }));
      result.current.addAction(addSampleAction({ kitName: "A0" }));
    });
    expect(result.current.undoCount).toBe(0);

    act(() => {
      result.current.addAction(addSampleAction({ kitName: "B0" }));
    });
    expect(result.current.undoCount).toBe(1);
  });

  it("drops an entry made in the same kit name in another store", () => {
    const { rerender, result } = renderHook(
      ({ store }) => useUndoRedoState({ kitName: "A0", storePath: store }),
      { initialProps: { store: "/stores/one" } },
    );
    const addForStoreOne = result.current.addAction;
    rerender({ store: "/stores/two" });

    act(() => {
      addForStoreOne(addSampleAction({ kitName: "A0" }));
    });
    expect(result.current.undoCount).toBe(0);
  });

  it("doesn't put an undo that finishes after you step away on the new kit's redo history", async () => {
    const undoCall = deferred<{ success: true }>();
    vi.mocked(globalThis.electronAPI.deleteSampleFromSlot).mockReturnValueOnce(
      undoCall.promise as never,
    );
    const refreshes: unknown[] = [];
    const onRefresh = (e: Event) => refreshes.push((e as CustomEvent).detail);
    document.addEventListener("romper:refresh-samples", onRefresh);
    const { rerender, result } = renderHook(({ kit }) => useUndoRedo(kit), {
      initialProps: { kit: "A0" },
    });
    act(() => {
      result.current.addAction(addSampleAction({ kitName: "A0" }));
    });

    let undoing!: Promise<void>;
    act(() => {
      undoing = result.current.undo();
    });
    rerender({ kit: "B0" });
    await act(async () => {
      undoCall.resolve({ success: true });
      await undoing;
    });
    document.removeEventListener("romper:refresh-samples", onRefresh);

    expect(globalThis.electronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
      "A0",
      1,
      0,
    );
    expect(result.current.redoCount).toBe(0);
    expect(result.current.undoCount).toBe(0);
    // The kit the undo changed is reloaded, though it's no longer open
    expect(refreshes).toEqual([{ kitName: "A0", refreshAll: true }]);
  });

  it("doesn't put a redo that finishes after you step away on the new kit's undo history", async () => {
    const { rerender, result } = renderHook(({ kit }) => useUndoRedo(kit), {
      initialProps: { kit: "A0" },
    });
    act(() => {
      result.current.addAction(addSampleAction({ kitName: "A0" }));
    });
    await act(async () => {
      await result.current.undo();
    });
    expect(result.current.redoCount).toBe(1);

    const redoCall = deferred<{ success: true }>();
    vi.mocked(globalThis.electronAPI.addSampleToSlot).mockReturnValueOnce(
      redoCall.promise as never,
    );
    let redoing!: Promise<void>;
    act(() => {
      redoing = result.current.redo();
    });
    rerender({ kit: "B0" });
    await act(async () => {
      redoCall.resolve({ success: true });
      await redoing;
    });

    expect(result.current.undoCount).toBe(0);
    expect(result.current.redoCount).toBe(0);
  });

  it("undoes and redoes on the entry's kit, not the open one", async () => {
    const { result: undo } = renderHook(() => useUndoActionHandlers());
    const { result: redo } = renderHook(() => useRedoActionHandlers());
    const api = vi.mocked(globalThis.electronAPI);

    await undo.current.executeUndoAction(addSampleAction({ kitName: "A0" }));
    expect(api.deleteSampleFromSlot).toHaveBeenLastCalledWith("A0", 1, 0);

    await undo.current.executeUndoAction(
      reindexSamplesAction({ kitName: "A0" }),
    );
    expect(api.restoreKitVoices).toHaveBeenLastCalledWith("A0", []);

    const edit = createSequenceEditAction("A0", "Edit steps", emptySequence, {
      ...emptySequence,
      stepPattern: [[1]],
    });
    await undo.current.executeUndoAction(edit);
    expect(api.restoreKitSequence).toHaveBeenLastCalledWith("A0", {
      stepPattern: [],
    });

    await redo.current.executeRedoAction(addSampleAction({ kitName: "A0" }));
    expect(api.addSampleToSlot).toHaveBeenLastCalledWith(
      "A0",
      1,
      0,
      "/samples/kick.wav",
    );
    await redo.current.executeRedoAction(edit);
    expect(api.restoreKitSequence).toHaveBeenLastCalledWith("A0", {
      stepPattern: [[1]],
    });
  });
});
