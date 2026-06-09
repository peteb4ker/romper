import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { scanAllKits, scanSingleKit, useKitScan } from "../useKitScan";

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
});
