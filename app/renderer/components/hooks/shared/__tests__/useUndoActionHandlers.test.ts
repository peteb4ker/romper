import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUndoActionHandlers } from "../useUndoActionHandlers";

// Mock window.electronAPI
const mockElectronAPI = {
  addSampleToSlot: vi.fn(),
  deleteSampleFromSlot: vi.fn(),
  deleteSampleFromSlotWithoutCompaction: vi.fn(),
  getAllSamplesForKit: vi.fn(),
  moveSampleBetweenKits: vi.fn(),
  replaceSampleInSlot: vi.fn(),
};

// Ensure window is properly typed and electronAPI is available
(window as any).electronAPI = mockElectronAPI;

describe("useUndoActionHandlers", () => {
  const testKitName = "Test Kit";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    // Ensure electronAPI is always available
    (window as any).electronAPI = mockElectronAPI;
  });

  describe("executeUndoAction", () => {
    it("should handle ADD_SAMPLE undo action", async () => {
      const { result } = renderHook(() =>
        useUndoActionHandlers({ kitName: testKitName }),
      );

      const addAction = {
        data: { slot: 0, voice: 1 },
        type: "ADD_SAMPLE" as const,
      };

      mockElectronAPI.deleteSampleFromSlot.mockResolvedValue({
        success: true,
      });

      const undoResult = await result.current.executeUndoAction(addAction);

      expect(mockElectronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
        testKitName,
        1,
        0,
      );
      expect(undoResult).toEqual({ success: true });
    });

    it("should handle DELETE_SAMPLE undo action", async () => {
      const { result } = renderHook(() =>
        useUndoActionHandlers({ kitName: testKitName }),
      );

      const deleteAction = {
        data: {
          deletedSample: {
            is_stereo: false,
            source_path: "/path/to/sample.wav",
          },
          slot: 0,
          voice: 1,
        },
        type: "DELETE_SAMPLE" as const,
      };

      mockElectronAPI.addSampleToSlot.mockResolvedValue({ success: true });

      const undoResult = await result.current.executeUndoAction(deleteAction);

      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledWith(
        testKitName,
        1,
        0,
        "/path/to/sample.wav",
        { forceMono: true },
      );
      expect(undoResult).toEqual({ success: true });
    });

    it("should handle REPLACE_SAMPLE undo action", async () => {
      const { result } = renderHook(() =>
        useUndoActionHandlers({ kitName: testKitName }),
      );

      const replaceAction = {
        data: {
          oldSample: {
            is_stereo: true,
            source_path: "/path/to/old-sample.wav",
          },
          slot: 0,
          voice: 1,
        },
        type: "REPLACE_SAMPLE" as const,
      };

      mockElectronAPI.replaceSampleInSlot.mockResolvedValue({
        success: true,
      });

      const undoResult = await result.current.executeUndoAction(replaceAction);

      expect(mockElectronAPI.replaceSampleInSlot).toHaveBeenCalledWith(
        testKitName,
        1,
        0,
        "/path/to/old-sample.wav",
        { forceMono: false },
      );
      expect(undoResult).toEqual({ success: true });
    });

    it("should handle MOVE_SAMPLE undo action with snapshot", async () => {
      const { result } = renderHook(() =>
        useUndoActionHandlers({ kitName: testKitName }),
      );

      const moveAction = {
        data: {
          fromVoice: 1,
          stateSnapshot: [
            {
              sample: { is_stereo: false, source_path: "/path/sample1.wav" },
              slot: 1,
              voice: 1,
            },
            {
              sample: { is_stereo: true, source_path: "/path/sample2.wav" },
              slot: 2,
              voice: 2,
            },
          ],
          toVoice: 2,
        },
        type: "MOVE_SAMPLE" as const,
      };

      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        data: [
          { slot_number: 1, voice_number: 1 },
          { slot_number: 1, voice_number: 2 },
        ],
        success: true,
      });
      mockElectronAPI.deleteSampleFromSlotWithoutCompaction.mockResolvedValue({
        success: true,
      });
      mockElectronAPI.addSampleToSlot.mockResolvedValue({ success: true });

      const undoResult = await result.current.executeUndoAction(moveAction);

      expect(mockElectronAPI.getAllSamplesForKit).toHaveBeenCalledWith(
        testKitName,
      );
      expect(
        mockElectronAPI.deleteSampleFromSlotWithoutCompaction,
      ).toHaveBeenCalledTimes(2);
      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledTimes(2);
      expect(undoResult).toEqual({ success: true });
    });

    it("should handle MOVE_SAMPLE undo action without snapshot (legacy)", async () => {
      const { result } = renderHook(() =>
        useUndoActionHandlers({ kitName: testKitName }),
      );

      const moveAction = {
        data: {
          affectedSamples: [
            {
              newSlot: 2,
              oldSlot: 1,
              sample: { is_stereo: false, source_path: "/path/affected.wav" },
              voice: 1,
            },
          ],
          fromSlot: 0,
          fromVoice: 1,
          movedSample: {
            is_stereo: false,
            source_path: "/path/moved.wav",
          },
          replacedSample: null,
          stateSnapshot: [],
          toSlot: 1,
          toVoice: 2,
        },
        type: "MOVE_SAMPLE" as const,
      };

      mockElectronAPI.deleteSampleFromSlotWithoutCompaction.mockResolvedValue({
        success: true,
      });
      mockElectronAPI.addSampleToSlot.mockResolvedValue({ success: true });

      const undoResult = await result.current.executeUndoAction(moveAction);

      expect(
        mockElectronAPI.deleteSampleFromSlotWithoutCompaction,
      ).toHaveBeenCalledWith(testKitName, 2, 1);
      expect(
        mockElectronAPI.deleteSampleFromSlotWithoutCompaction,
      ).toHaveBeenCalledWith(testKitName, 1, 2);
      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledWith(
        testKitName,
        1,
        1,
        "/path/affected.wav",
        { forceMono: true },
      );
      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledWith(
        testKitName,
        1,
        0,
        "/path/moved.wav",
        { forceMono: true },
      );
      expect(undoResult).toEqual({ success: true });
    });

    it("should handle MOVE_SAMPLE_BETWEEN_KITS undo action", async () => {
      const { result } = renderHook(() =>
        useUndoActionHandlers({ kitName: testKitName }),
      );

      const moveAction = {
        data: {
          fromKit: "From Kit",
          fromSlot: 0,
          fromVoice: 1,
          mode: "overwrite",
          replacedSample: {
            is_stereo: true,
            source_path: "/path/replaced.wav",
          },
          toKit: "Test Kit",
          toSlot: 1,
          toVoice: 2,
        },
        type: "MOVE_SAMPLE_BETWEEN_KITS" as const,
      };

      mockElectronAPI.moveSampleBetweenKits.mockResolvedValue({
        success: true,
      });
      mockElectronAPI.addSampleToSlot.mockResolvedValue({ success: true });

      const undoResult = await result.current.executeUndoAction(moveAction);

      expect(mockElectronAPI.moveSampleBetweenKits).toHaveBeenCalledWith(
        "Test Kit",
        2,
        1,
        "From Kit",
        1,
        0,
        "overwrite",
      );
      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledWith(
        "Test Kit",
        2,
        1,
        "/path/replaced.wav",
        { forceMono: false },
      );
      expect(undoResult).toEqual({ success: true });
    });

    it("should handle COMPACT_SLOTS undo action", async () => {
      const { result } = renderHook(() =>
        useUndoActionHandlers({ kitName: testKitName }),
      );

      const compactAction = {
        data: {
          affectedSamples: [
            {
              newSlot: 1,
              sample: { is_stereo: false, source_path: "/path/affected.wav" },
              voice: 1,
            },
          ],
          deletedSample: {
            is_stereo: true,
            source_path: "/path/deleted.wav",
          },
          deletedSlot: 0,
          voice: 1,
        },
        type: "COMPACT_SLOTS" as const,
      };

      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        data: [{ slot_number: 2, voice_number: 1 }],
        success: true,
      });
      mockElectronAPI.deleteSampleFromSlotWithoutCompaction.mockResolvedValue({
        success: true,
      });
      mockElectronAPI.addSampleToSlot.mockResolvedValue({ success: true });

      const undoResult = await result.current.executeUndoAction(compactAction);

      expect(mockElectronAPI.getAllSamplesForKit).toHaveBeenCalledWith(
        testKitName,
      );
      expect(
        mockElectronAPI.deleteSampleFromSlotWithoutCompaction,
      ).toHaveBeenCalledWith(testKitName, 1, 1);
      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledWith(
        testKitName,
        1,
        0,
        "/path/deleted.wav",
        { forceMono: false },
      );
      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledWith(
        testKitName,
        1,
        1,
        "/path/affected.wav",
        { forceMono: true },
      );
      expect(undoResult).toEqual({ success: true });
    });

    it("should handle unknown action type", async () => {
      const { result } = renderHook(() =>
        useUndoActionHandlers({ kitName: testKitName }),
      );

      const unknownAction = {
        data: {},
        type: "UNKNOWN_ACTION" as any,
      };

      await expect(
        result.current.executeUndoAction(unknownAction),
      ).rejects.toThrow("Unknown action type: UNKNOWN_ACTION");
    });

    it("should handle errors in MOVE_SAMPLE action", async () => {
      const { result } = renderHook(() =>
        useUndoActionHandlers({ kitName: testKitName }),
      );

      const moveAction = {
        data: {
          affectedSamples: [],
          fromVoice: 1,
          stateSnapshot: [],
          toVoice: 2,
        },
        type: "MOVE_SAMPLE" as const,
      };

      mockElectronAPI.deleteSampleFromSlotWithoutCompaction.mockRejectedValue(
        new Error("Delete failed"),
      );

      const undoResult = await result.current.executeUndoAction(moveAction);

      expect(undoResult).toEqual({
        error: "Delete failed",
        success: false,
      });
    });

    it("should handle errors in MOVE_SAMPLE_BETWEEN_KITS action", async () => {
      const { result } = renderHook(() =>
        useUndoActionHandlers({ kitName: testKitName }),
      );

      const moveAction = {
        data: {
          fromKit: "From Kit",
          fromSlot: 0,
          fromVoice: 1,
          mode: "overwrite",
          toKit: "Test Kit",
          toSlot: 1,
          toVoice: 2,
        },
        type: "MOVE_SAMPLE_BETWEEN_KITS" as const,
      };

      mockElectronAPI.moveSampleBetweenKits.mockRejectedValue(
        new Error("Move failed"),
      );

      const undoResult = await result.current.executeUndoAction(moveAction);

      expect(undoResult).toEqual({
        error: "Move failed",
        success: false,
      });
    });

    it("should handle errors in COMPACT_SLOTS action", async () => {
      const { result } = renderHook(() =>
        useUndoActionHandlers({ kitName: testKitName }),
      );

      const compactAction = {
        data: {
          affectedSamples: [],
          deletedSample: {
            is_stereo: false,
            source_path: "/path/deleted.wav",
          },
          deletedSlot: 0,
          voice: 1,
        },
        type: "COMPACT_SLOTS" as const,
      };

      mockElectronAPI.getAllSamplesForKit.mockRejectedValue(
        new Error("Get samples failed"),
      );

      const undoResult = await result.current.executeUndoAction(compactAction);

      expect(undoResult).toEqual({
        error: "Get samples failed",
        success: false,
      });
    });
  });
});
