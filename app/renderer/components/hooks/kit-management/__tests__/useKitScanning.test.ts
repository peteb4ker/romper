import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useKitScanning } from "../useKitScanning";

describe("useKitScanning", () => {
  const reloadKit = vi.fn().mockResolvedValue(undefined);
  const onRefreshKitMetadata = vi.fn().mockResolvedValue(undefined);
  const onRequestSamplesReload = vi.fn().mockResolvedValue(undefined);

  const defaultParams = {
    kitName: "A0",
    onRefreshKitMetadata,
    onRequestSamplesReload,
    reloadKit,
    // "kick" / "snare" infer voice types; voices 3 and 4 are empty
    samples: { 1: ["kick_01.wav"], 2: ["snare_01.wav"], 3: [], 4: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupElectronAPIMock();
    vi.mocked(window.electronAPI.updateVoiceAlias).mockResolvedValue({
      success: true,
    });
    reloadKit.mockResolvedValue(undefined);
    onRefreshKitMetadata.mockResolvedValue(undefined);
    onRequestSamplesReload.mockResolvedValue(undefined);
  });

  describe("handleInferVoiceNames", () => {
    it("infers and saves voice aliases for voices with samples", async () => {
      const { result } = renderHook(() => useKitScanning(defaultParams));

      await act(async () => {
        await result.current.handleInferVoiceNames();
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledTimes(2);
      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        "Kick",
      );
      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        2,
        "Snare",
      );
      expect(result.current.scanStatus).toEqual({
        sampleCount: 2,
        status: "success",
      });
      // Only the updated voices flash
      expect([...result.current.flashVoices]).toEqual([1, 2]);
    });

    it("prefers the targeted metadata refresh over a full reload", async () => {
      const { result } = renderHook(() => useKitScanning(defaultParams));

      await act(async () => {
        await result.current.handleInferVoiceNames();
      });

      expect(onRefreshKitMetadata).toHaveBeenCalledTimes(1);
      expect(reloadKit).not.toHaveBeenCalled();
    });

    it("falls back to reloadKit when no metadata refresh is provided", async () => {
      const { result } = renderHook(() =>
        useKitScanning({ ...defaultParams, onRefreshKitMetadata: undefined }),
      );

      await act(async () => {
        await result.current.handleInferVoiceNames();
      });

      expect(reloadKit).toHaveBeenCalledTimes(1);
    });

    it("reports an error status when saving an alias fails", async () => {
      vi.mocked(window.electronAPI.updateVoiceAlias).mockRejectedValue(
        new Error("Write failed"),
      );
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useKitScanning(defaultParams));

      await act(async () => {
        await result.current.handleInferVoiceNames();
      });

      expect(result.current.scanStatus).toEqual({
        message: "Write failed",
        status: "error",
      });
      expect(result.current.flashVoices.size).toBe(0);

      consoleErrorSpy.mockRestore();
    });

    it("succeeds with zero updates when no voice has samples", async () => {
      const { result } = renderHook(() =>
        useKitScanning({
          ...defaultParams,
          samples: { 1: [], 2: [], 3: [], 4: [] },
        }),
      );

      await act(async () => {
        await result.current.handleInferVoiceNames();
      });

      expect(window.electronAPI.updateVoiceAlias).not.toHaveBeenCalled();
      expect(result.current.scanStatus).toEqual({
        sampleCount: 0,
        status: "success",
      });
      expect(result.current.flashVoices.size).toBe(0);
    });

    it("does nothing without a kit name", async () => {
      const { result } = renderHook(() =>
        useKitScanning({ ...defaultParams, kitName: "" }),
      );

      await act(async () => {
        await result.current.handleInferVoiceNames();
      });

      expect(window.electronAPI.updateVoiceAlias).not.toHaveBeenCalled();
      expect(result.current.scanStatus).toEqual({ status: "idle" });
    });
  });

  describe("status and flash lifecycle", () => {
    it("clears the success status after the timeout", async () => {
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() => useKitScanning(defaultParams));

        await act(async () => {
          await result.current.handleInferVoiceNames();
        });
        expect(result.current.scanStatus.status).toBe("success");

        act(() => {
          vi.runAllTimers();
        });

        expect(result.current.scanStatus).toEqual({ status: "idle" });
        expect(result.current.flashVoices.size).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
