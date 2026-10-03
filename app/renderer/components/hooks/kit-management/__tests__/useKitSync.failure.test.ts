import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKitSync } from "../useKitSync";

// With the real useSyncUpdate: the failure toast used to read the error
// from the render before the write, which was always null, so a failed
// write never showed one (RE-40)
describe("[UC-34] [UC-36] a failed write tells the user (RE-40)", () => {
  beforeEach(() => {
    vi.mocked(globalThis.electronAPI.readSettings).mockResolvedValue({});
  });

  it("shows a message the first time a write fails", async () => {
    vi.mocked(globalThis.electronAPI.startKitSync).mockResolvedValue({
      error:
        "Failed to sync kit: EACCES: permission denied, open '/Volumes/RAMPLE/A0'",
      success: false,
    });
    const onMessage = vi.fn();
    const { result } = renderHook(() => useKitSync({ onMessage }));

    await act(async () => {
      await result.current.handleConfirmSync({
        sdCardPath: "/Volumes/RAMPLE",
        skipInvalidFiles: false,
      });
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      "The write to the SD card didn't finish. The write panel says why; fix that, then write again.",
      "error",
    );
    // The reason goes to the write panel, not the toast
    expect(onMessage.mock.calls[0][0]).not.toMatch(/EACCES|Error:/);
    expect(result.current.syncError).toMatch(/EACCES/);
  });

  it("shows a message when the write throws", async () => {
    vi.mocked(globalThis.electronAPI.startKitSync).mockRejectedValue(
      new Error("IPC channel closed"),
    );
    const onMessage = vi.fn();
    const { result } = renderHook(() => useKitSync({ onMessage }));

    await act(async () => {
      await result.current.handleConfirmSync({
        sdCardPath: "/Volumes/RAMPLE",
        skipInvalidFiles: false,
      });
    });

    expect(onMessage).toHaveBeenCalledWith(
      expect.stringMatching(/^The write to the SD card didn't finish\./),
      "error",
    );
  });

  it("says nothing when the write works", async () => {
    vi.mocked(globalThis.electronAPI.startKitSync).mockResolvedValue({
      data: { syncedFiles: 3 },
      success: true,
    });
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useKitSync({ onMessage, onRefreshKits: vi.fn() }),
    );

    await act(async () => {
      await result.current.handleConfirmSync({
        sdCardPath: "/Volumes/RAMPLE",
        skipInvalidFiles: false,
      });
    });

    expect(onMessage).not.toHaveBeenCalled();
  });
});
