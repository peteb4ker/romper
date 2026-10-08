import type { SliceStep } from "@romper/shared/sliceTypes";

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { createEmptySliceSteps, makeSliceStep } from "../sliceConstants";
import {
  divisionNotSaved,
  SLICES_NOT_SAVED,
  useSliceSteps,
} from "../useSliceSteps";

describe("useSliceSteps", () => {
  let mockElectronAPI: ReturnType<typeof setupElectronAPIMock>;

  beforeEach(() => {
    mockElectronAPI = setupElectronAPIMock();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts empty at /16 when the kit has no slicer data", () => {
    const { result } = renderHook(() => useSliceSteps({ kitName: "A0" }));
    expect(result.current.sliceSteps).toEqual(createEmptySliceSteps());
    expect(result.current.slicerDivision).toBe(16);
  });

  it("loads stored slice data and division", () => {
    const stored = createEmptySliceSteps();
    stored[1][2] = makeSliceStep(3, 1, 16);
    const { result } = renderHook(() =>
      useSliceSteps({
        initialDivision: 32,
        initialSliceSteps: stored,
        kitName: "A0",
      }),
    );
    expect(result.current.sliceSteps[1][2]).toEqual(stored[1][2]);
    expect(result.current.slicerDivision).toBe(32);
  });

  it("ignores an invalid stored division", () => {
    const { result } = renderHook(() =>
      useSliceSteps({ initialDivision: 7, kitName: "A0" }),
    );
    expect(result.current.slicerDivision).toBe(16);
  });

  it("saves slice steps and reloads the kit after a pause", async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useSliceSteps({ kitName: "A0", onSaved }),
    );
    const next = createEmptySliceSteps();
    next[0][0] = makeSliceStep(4, 1, 16);

    await act(async () => {
      await result.current.setSliceSteps(next);
    });

    expect(mockElectronAPI.updateSliceSteps).toHaveBeenCalledWith("A0", next);
    expect(result.current.sliceSteps[0][0]).toEqual(next[0][0]);
    expect(onSaved).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("composes updater functions across rapid edits", async () => {
    const { result } = renderHook(() => useSliceSteps({ kitName: "A0" }));
    const place = (step: number) => (prev: (null | SliceStep)[][]) =>
      prev.map((row, v) =>
        v === 0
          ? row.map((c, s) => (s === step ? makeSliceStep(step, 1, 16) : c))
          : row,
      );

    await act(async () => {
      void result.current.setSliceSteps(place(0));
      await result.current.setSliceSteps(place(1));
    });

    expect(result.current.sliceSteps[0][0]).not.toBeNull();
    expect(result.current.sliceSteps[0][1]).not.toBeNull();
  });

  it("rolls back when the save fails", async () => {
    vi.mocked(mockElectronAPI.updateSliceSteps).mockResolvedValueOnce({
      error: "disk full",
      success: false,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSliceSteps({ kitName: "A0" }));
    const next = createEmptySliceSteps();
    next[2][5] = makeSliceStep(1, 1, 16);

    await act(async () => {
      await result.current.setSliceSteps(next);
    });

    expect(result.current.sliceSteps).toEqual(createEmptySliceSteps());
  });

  it("saves the division and rolls back on failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSliceSteps({ kitName: "A0" }));

    await act(async () => {
      await result.current.setSlicerDivision(8);
    });
    expect(mockElectronAPI.updateKitSlicerDivision).toHaveBeenCalledWith(
      "A0",
      8,
    );
    expect(result.current.slicerDivision).toBe(8);

    vi.mocked(mockElectronAPI.updateKitSlicerDivision).mockRejectedValueOnce(
      new Error("boom"),
    );
    await act(async () => {
      await result.current.setSlicerDivision(64);
    });
    expect(result.current.slicerDivision).toBe(8);
  });

  it("resets when the kit changes", () => {
    const stored = createEmptySliceSteps();
    stored[0][0] = makeSliceStep(2, 1, 16);
    const { rerender, result } = renderHook(
      ({ kitName }) =>
        useSliceSteps({
          initialDivision: 32,
          initialSliceSteps: stored,
          kitName,
        }),
      { initialProps: { kitName: "A0" } },
    );
    expect(result.current.sliceSteps[0][0]).not.toBeNull();

    rerender({ kitName: "A1" });
    expect(result.current.sliceSteps).toEqual(createEmptySliceSteps());
    expect(result.current.slicerDivision).toBe(16);
  });

  describe("[UC-33] [UC-36] a slice edit that isn't saved says so (#511)", () => {
    it("gives one message for a run of wheel nudges that all fail", async () => {
      vi.mocked(globalThis.electronAPI.updateSliceSteps).mockResolvedValue({
        error: "disk full",
        success: false,
      });
      const onMessage = vi.fn();
      const onSaved = vi.fn();
      const { result } = renderHook(() =>
        useSliceSteps({ kitName: "A0", onMessage, onSaved }),
      );
      const nudge = (start: number) => (prev: (null | SliceStep)[][]) =>
        prev.map((row, v) =>
          v === 0
            ? row.map((c, s) => (s === 0 ? makeSliceStep(start, 1, 16) : c))
            : row,
        );

      await act(async () => {
        await Promise.all([
          result.current.setSliceSteps(nudge(1)),
          result.current.setSliceSteps(nudge(2)),
          result.current.setSliceSteps(nudge(3)),
        ]);
        vi.runAllTimers();
      });

      expect(result.current.sliceSteps).toEqual(createEmptySliceSteps());
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(SLICES_NOT_SAVED, "error");
      expect(SLICES_NOT_SAVED).toBe(
        "Couldn't save the slices, so they're back as they were. Try again.",
      );
      expect(onSaved).not.toHaveBeenCalled();
    });

    it("says which division is back when the division isn't saved", async () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useSliceSteps({ initialDivision: 32, kitName: "A0", onMessage }),
      );
      vi.mocked(
        globalThis.electronAPI.updateKitSlicerDivision,
      ).mockResolvedValue({ error: "disk full", success: false });

      await act(async () => {
        await result.current.setSlicerDivision(64);
      });

      expect(result.current.slicerDivision).toBe(32);
      expect(onMessage).toHaveBeenCalledWith(
        "Couldn't save the slice division, so it's back to 32 slices. Try again.",
        "error",
      );
      expect(divisionNotSaved(32)).toBe(onMessage.mock.calls[0][0]);
    });

    it("says nothing when slices are saved", async () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useSliceSteps({ kitName: "A0", onMessage }),
      );
      const next = createEmptySliceSteps();
      next[0][0] = makeSliceStep(4, 1, 16);

      await act(async () => {
        await result.current.setSliceSteps(next);
        await result.current.setSlicerDivision(8);
      });

      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  // The sequencer's undo history keeps only saved edits (#570)
  it("[UC-26] resolves to whether the slices were saved", async () => {
    const { result } = renderHook(() =>
      useSliceSteps({ initialSliceSteps: null, kitName: "A0" }),
    );
    vi.mocked(globalThis.electronAPI.updateSliceSteps).mockResolvedValueOnce({
      success: true,
    });
    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.setSliceSteps(createEmptySliceSteps());
    });
    expect(saved).toBe(true);

    vi.mocked(globalThis.electronAPI.updateSliceSteps).mockResolvedValueOnce({
      error: "disk full",
      success: false,
    });
    await act(async () => {
      saved = await result.current.setSliceSteps(createEmptySliceSteps());
    });
    expect(saved).toBe(false);
  });
});
