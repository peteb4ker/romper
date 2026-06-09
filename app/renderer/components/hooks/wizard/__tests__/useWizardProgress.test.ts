import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useWizardProgress } from "../useWizardProgress";

describe("useWizardProgress", () => {
  it("fans progress out to wizard state and the external callback", () => {
    const setProgress = vi.fn();
    const onProgress = vi.fn();
    const { result } = renderHook(() =>
      useWizardProgress(setProgress, onProgress),
    );

    result.current.reportProgress({ percent: 42, phase: "Copying" });

    expect(setProgress).toHaveBeenCalledWith({ percent: 42, phase: "Copying" });
    expect(onProgress).toHaveBeenCalledWith({ percent: 42, phase: "Copying" });
  });

  it("works without an external callback", () => {
    const setProgress = vi.fn();
    const { result } = renderHook(() => useWizardProgress(setProgress));

    result.current.reportProgress({ percent: 1, phase: "x" });
    expect(setProgress).toHaveBeenCalledWith({ percent: 1, phase: "x" });
  });

  it("reports sequential per-item progress and a final 100%", async () => {
    const setProgress = vi.fn();
    const seen: Array<{ idx: number; item: string }> = [];
    const { result } = renderHook(() => useWizardProgress(setProgress));

    await result.current.reportStepProgress({
      items: ["a", "b"],
      onStep: async (item, idx) => {
        seen.push({ idx, item });
      },
      phase: "Scanning",
    });

    expect(seen).toEqual([
      { idx: 0, item: "a" },
      { idx: 1, item: "b" },
    ]);
    expect(setProgress).toHaveBeenNthCalledWith(1, {
      currentKit: 1,
      file: "a",
      kitName: "a",
      percent: 50,
      phase: "Scanning",
      totalKits: 2,
    });
    expect(setProgress).toHaveBeenNthCalledWith(2, {
      currentKit: 2,
      file: "b",
      kitName: "b",
      percent: 100,
      phase: "Scanning",
      totalKits: 2,
    });
    expect(setProgress).toHaveBeenLastCalledWith({
      percent: 100,
      phase: "Scanning",
    });
  });

  it("does not emit a completion event for an empty item list", async () => {
    const setProgress = vi.fn();
    const { result } = renderHook(() => useWizardProgress(setProgress));

    await result.current.reportStepProgress({
      items: [],
      onStep: async () => {},
      phase: "Scanning",
    });

    expect(setProgress).not.toHaveBeenCalled();
  });
});
