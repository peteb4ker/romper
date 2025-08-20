import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRedoActionHandlers } from "../useRedoActionHandlers";

// Use centralized mock from vitest.setup.ts
// No need to define local mockElectronAPI - use window.electronAPI from centralized mocks

describe("useRedoActionHandlers", () => {
  const testKitName = "Test Kit";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe("executeRedoAction", () => {
    it("should handle ADD_SAMPLE redo action", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const addAction = {
        data: {
          addedSample: {
            is_stereo: false,
            source_path: "/path/to/sample.wav",
          },
          slot: 0,
          voice: 1,
        },
        type: "ADD_SAMPLE" as const,
      };

      vi.mocked(window.electronAPI.addSampleToSlot).mockResolvedValue({
        success: true,
      });

      const redoResult = await result.current.executeRedoAction(addAction);

      expect(window.electronAPI.addSampleToSlot).toHaveBeenCalledWith(
        testKitName,
        1,
        0,
        "/path/to/sample.wav",
        { forceMono: true },
      );
      expect(redoResult).toEqual({ success: true });
    });

    it("should handle ADD_SAMPLE with stereo sample", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const addAction = {
        data: {
          addedSample: {
            is_stereo: true,
            source_path: "/path/to/stereo.wav",
          },
          slot: 1,
          voice: 2,
        },
        type: "ADD_SAMPLE" as const,
      };

      vi.mocked(window.electronAPI.addSampleToSlot).mockResolvedValue({
        success: true,
      });

      await result.current.executeRedoAction(addAction);

      expect(window.electronAPI.addSampleToSlot).toHaveBeenCalledWith(
        testKitName,
        2,
        1,
        "/path/to/stereo.wav",
        { forceMono: false },
      );
    });

    it("should handle DELETE_SAMPLE redo action", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const deleteAction = {
        data: {
          slot: 0,
          voice: 1,
        },
        type: "DELETE_SAMPLE" as const,
      };

      vi.mocked(window.electronAPI.deleteSampleFromSlot).mockResolvedValue({
        success: true,
      });

      const redoResult = await result.current.executeRedoAction(deleteAction);

      expect(window.electronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
        testKitName,
        1,
        0,
      );
      expect(redoResult).toEqual({ success: true });
    });

    it("should handle REINDEX_SAMPLES redo action", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const reindexAction = {
        data: {
          deletedSlot: 2,
          voice: 1,
        },
        type: "REINDEX_SAMPLES" as const,
      };

      vi.mocked(window.electronAPI.deleteSampleFromSlot).mockResolvedValue({
        success: true,
      });

      const redoResult = await result.current.executeRedoAction(reindexAction);

      expect(window.electronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
        testKitName,
        1,
        2,
      );
      expect(redoResult).toEqual({ success: true });
    });

    it("should handle MOVE_SAMPLE redo action", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const moveAction = {
        data: {
          fromSlot: 0,
          fromVoice: 1,
          mode: "insert",
          toSlot: 1,
          toVoice: 2,
        },
        type: "MOVE_SAMPLE" as const,
      };

      vi.mocked(window.electronAPI.moveSampleInKit).mockResolvedValue({
        success: true,
      });

      const redoResult = await result.current.executeRedoAction(moveAction);

      expect(window.electronAPI.moveSampleInKit).toHaveBeenCalledWith(
        testKitName,
        1,
        0,
        2,
        1,
        "insert",
      );
      expect(redoResult).toEqual({ success: true });
    });

    it("should handle MOVE_SAMPLE_BETWEEN_KITS redo action", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const moveAction = {
        data: {
          fromKit: "From Kit",
          fromSlot: 0,
          fromVoice: 1,
          mode: "overwrite",
          toKit: "To Kit",
          toSlot: 1,
          toVoice: 2,
        },
        type: "MOVE_SAMPLE_BETWEEN_KITS" as const,
      };

      vi.mocked(window.electronAPI.moveSampleBetweenKits).mockResolvedValue({
        success: true,
      });

      const redoResult = await result.current.executeRedoAction(moveAction);

      expect(window.electronAPI.moveSampleBetweenKits).toHaveBeenCalledWith(
        "From Kit",
        1,
        0,
        "To Kit",
        2,
        1,
        "overwrite",
      );
      expect(redoResult).toEqual({ success: true });
    });

    it("should handle REPLACE_SAMPLE redo action", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const replaceAction = {
        data: {
          newSample: {
            is_stereo: true,
            source_path: "/path/to/new.wav",
          },
          slot: 0,
          voice: 1,
        },
        type: "REPLACE_SAMPLE" as const,
      };

      vi.mocked(window.electronAPI.replaceSampleInSlot).mockResolvedValue({
        success: true,
      });

      const redoResult = await result.current.executeRedoAction(replaceAction);

      expect(window.electronAPI.replaceSampleInSlot).toHaveBeenCalledWith(
        testKitName,
        1,
        0,
        "/path/to/new.wav",
        { forceMono: false },
      );
      expect(redoResult).toEqual({ success: true });
    });

    it("should handle unknown action type", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const unknownAction = {
        data: {},
        type: "UNKNOWN_ACTION" as unknown,
      };

      await expect(
        result.current.executeRedoAction(unknownAction),
      ).rejects.toThrow("Unknown action type: UNKNOWN_ACTION");
    });

    it("should handle missing electronAPI gracefully", async () => {
      const originalAPI = (window as unknown).electronAPI;
      (window as unknown).electronAPI = undefined;

      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const addAction = {
        data: {
          addedSample: {
            is_stereo: false,
            source_path: "/path/to/sample.wav",
          },
          slot: 0,
          voice: 1,
        },
        type: "ADD_SAMPLE" as const,
      };

      const redoResult = await result.current.executeRedoAction(addAction);

      expect(redoResult).toBeUndefined();

      // Restore
      (window as unknown).electronAPI = originalAPI;
    });

    it("should handle missing specific API method", async () => {
      const originalAPI = (window as unknown).electronAPI;
      (window as unknown).electronAPI = {}; // Missing addSampleToSlot

      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const addAction = {
        data: {
          addedSample: {
            is_stereo: false,
            source_path: "/path/to/sample.wav",
          },
          slot: 0,
          voice: 1,
        },
        type: "ADD_SAMPLE" as const,
      };

      const redoResult = await result.current.executeRedoAction(addAction);

      expect(redoResult).toBeUndefined();

      // Restore
      (window as unknown).electronAPI = originalAPI;
    });

    it("should handle API call failures", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const deleteAction = {
        data: {
          slot: 0,
          voice: 1,
        },
        type: "DELETE_SAMPLE" as const,
      };

      vi.mocked(window.electronAPI.deleteSampleFromSlot).mockResolvedValue({
        error: "Delete failed",
        success: false,
      });

      const redoResult = await result.current.executeRedoAction(deleteAction);

      expect(redoResult).toEqual({
        error: "Delete failed",
        success: false,
      });
    });

    it("should handle API call exceptions", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const moveAction = {
        data: {
          fromSlot: 0,
          fromVoice: 1,
          mode: "insert",
          toSlot: 1,
          toVoice: 2,
        },
        type: "MOVE_SAMPLE" as const,
      };

      vi.mocked(window.electronAPI.moveSampleInKit).mockRejectedValue(
        new Error("Network error"),
      );

      await expect(
        result.current.executeRedoAction(moveAction),
      ).rejects.toThrow("Network error");
    });
  });
});
