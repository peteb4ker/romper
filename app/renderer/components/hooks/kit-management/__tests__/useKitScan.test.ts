import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import {
  describeScanTotals,
  EMPTY_SCAN_TOTALS,
  scanAllKits,
  scanSingleKit,
  useKitScan,
} from "../useKitScan";

const kit = (name: string) => ({ name }) as never;

describe("scanSingleKit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupElectronAPIMock();
  });

  it("delegates to the main-process rescan", async () => {
    vi.mocked(window.electronAPI.rescanKit).mockResolvedValue({
      data: { scannedSamples: 7, updatedVoices: 2 },
      success: true,
    });

    const result = await scanSingleKit({ kitName: "A1" });

    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith("A1");
    expect(result.success).toBe(true);
  });

  it("returns the rescan failure as-is", async () => {
    vi.mocked(window.electronAPI.rescanKit).mockResolvedValue({
      error: "Kit directory not found",
      success: false,
    });

    const result = await scanSingleKit({ kitName: "A1" });
    expect(result).toEqual({
      error: "Kit directory not found",
      success: false,
    });
  });

  it("fails cleanly when the rescan API is unavailable", async () => {
    delete (window.electronAPI as { rescanKit?: unknown }).rescanKit;

    const result = await scanSingleKit({ kitName: "A1" });
    expect(result.success).toBe(false);

    setupElectronAPIMock();
  });
});

describe("scanAllKits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupElectronAPIMock();
    vi.mocked(window.electronAPI.rescanKit).mockResolvedValue({
      data: { scannedSamples: 3, updatedVoices: 1 },
      success: true,
    });
  });

  it("rescans every kit and reports completion", async () => {
    const onProgress = vi.fn();
    const onRefreshKits = vi.fn();

    await scanAllKits({
      kits: [kit("A1"), kit("A2")],
      onProgress,
      onRefreshKits,
    });

    expect(window.electronAPI.rescanKit).toHaveBeenCalledTimes(2);
    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith("A1");
    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith("A2");
    expect(onProgress).toHaveBeenLastCalledWith({
      message: "All 2 kits scanned successfully (comprehensive).",
      status: "complete",
      successCount: 2,
    });
    expect(onRefreshKits).toHaveBeenCalledTimes(1);
  });

  it("adds up what the merge changed across kits", async () => {
    const base = {
      addedSamples: 0,
      locked: false,
      metadataUpdated: 0,
      missingSamples: [],
      scannedSamples: 3,
      skippedFiles: [],
      updatedVoices: 0,
    };
    vi.mocked(window.electronAPI.rescanKit)
      .mockResolvedValueOnce({
        data: {
          ...base,
          addedSamples: 2,
          skippedFiles: [
            { filename: "1 new.wav", reason: "kit_editable", voiceNumber: 1 },
          ],
        },
        success: true,
      })
      .mockResolvedValueOnce({
        data: {
          ...base,
          addedSamples: 1,
          missingSamples: [
            {
              filename: "a.wav",
              slotNumber: 0,
              sourcePath: "/x/a.wav",
              voiceNumber: 2,
            },
          ],
        },
        success: true,
      })
      .mockResolvedValueOnce({
        data: { ...base, locked: true },
        success: true,
      });
    const onProgress = vi.fn();

    await scanAllKits({
      kits: [kit("A1"), kit("A2"), kit("A3")],
      onProgress,
    });

    expect(onProgress).toHaveBeenLastCalledWith({
      message:
        "All 3 kits scanned successfully (comprehensive). 3 samples added, " +
        "1 sample missing on disk, 1 new file not added to editable kits, " +
        "1 locked kit left unchanged.",
      status: "complete",
      successCount: 3,
    });
  });

  it("counts failures and surfaces their errors", async () => {
    vi.mocked(window.electronAPI.rescanKit)
      .mockResolvedValueOnce({ data: { scannedSamples: 3 }, success: true })
      .mockResolvedValueOnce({ error: "boom", success: false });
    const onProgress = vi.fn();

    await scanAllKits({ kits: [kit("A1"), kit("A2")], onProgress });

    expect(onProgress).toHaveBeenLastCalledWith({
      message: expect.stringContaining("1 successful, 1 failed. A2: boom"),
      status: "complete",
      successCount: 1,
    });
  });

  it("reports an error when there are no kits", async () => {
    const onProgress = vi.fn();
    await scanAllKits({ kits: [], onProgress });

    expect(onProgress).toHaveBeenCalledWith({
      message: "No kits to scan",
      status: "error",
    });
    expect(window.electronAPI.rescanKit).not.toHaveBeenCalled();
  });
});

describe("useKitScan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupElectronAPIMock();
    vi.mocked(window.electronAPI.rescanKit).mockResolvedValue({
      data: { scannedSamples: 3, updatedVoices: 1 },
      success: true,
    });
  });

  it("tracks bulk scan progress through to completion", async () => {
    const onRefreshKits = vi.fn();
    const { result } = renderHook(() =>
      useKitScan({ kits: [kit("A1")], onRefreshKits }),
    );

    await act(async () => {
      await result.current.handleScanAllKits();
    });

    expect(result.current.bulkScanProgress).toEqual({
      message: "All 1 kits scanned successfully (comprehensive).",
      status: "complete",
      successCount: 1,
    });
    expect(onRefreshKits).toHaveBeenCalledTimes(1);
  });

  it("reports an error state when there are no kits", async () => {
    const { result } = renderHook(() =>
      useKitScan({ kits: [], onRefreshKits: vi.fn() }),
    );

    await act(async () => {
      await result.current.handleScanAllKits();
    });

    expect(result.current.bulkScanProgress).toEqual({
      message: "No kits to scan",
      status: "error",
    });
  });

  it("reports the final result to onFinished", async () => {
    const onFinished = vi.fn();
    const { result } = renderHook(() =>
      useKitScan({ kits: [kit("A1"), kit("B2")], onFinished }),
    );

    await act(async () => {
      await result.current.handleScanAllKits();
    });

    expect(window.electronAPI.rescanKit).toHaveBeenCalledTimes(2);
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ status: "complete", successCount: 2 }),
    );
  });
});

describe("describeScanTotals", () => {
  it("is empty when nothing changed", () => {
    expect(describeScanTotals(EMPTY_SCAN_TOTALS)).toBe("");
  });

  it("pluralises each part", () => {
    expect(
      describeScanTotals({
        added: 1,
        editableSkipped: 0,
        lockedKits: 2,
        missing: 3,
        voiceFullSkipped: 2,
      }),
    ).toBe(
      "1 sample added, 3 samples missing on disk, " +
        "2 files skipped (voice has 12 samples), 2 locked kits left unchanged",
    );
  });
});
