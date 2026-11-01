import type { AnyUndoAction } from "@romper/shared/undoTypes";

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addSampleAction,
  deleteSampleAction,
  moveSampleAction,
  moveSampleBetweenKitsAction,
  reindexSamplesAction,
} from "../../../../../../tests/factories/undoAction.factory";
import { useRedoActionHandlers } from "../useRedoActionHandlers";

// Use centralized mock from vitest.setup.ts

// An action from outside AnyUndoAction, to reach the handler's defensive
// default branch: the type mismatch is what the test is about.
function unknownAction(): AnyUndoAction {
  return {
    ...addSampleAction(),
    type: "UNKNOWN_ACTION",
  } as unknown as AnyUndoAction;
}

describe("useRedoActionHandlers", () => {
  const testKitName = "Test Kit";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("executeRedoAction", () => {
    it("[UC-05] redoes REMOVE_MISSING_SAMPLES by removing the action's kit's missing samples again, keeping what this removal returned for the next undo (#822)", async () => {
      const voicesBefore = [{ samples: [], voice: 2 }];
      vi.mocked(globalThis.electronAPI.removeMissingSamples).mockResolvedValue({
        data: { samples: 3, voicesBefore },
        success: true,
      });
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );
      const action: AnyUndoAction = {
        data: { kitName: "B0", samples: 1, voicesBefore: [] },
        description: "Remove 1 missing sample from B0",
        id: "remove-id",
        timestamp: new Date(),
        type: "REMOVE_MISSING_SAMPLES",
      };

      const redone = await result.current.executeRedoAction(action);

      expect(redone).toMatchObject({ success: true });
      expect(globalThis.electronAPI.removeMissingSamples).toHaveBeenCalledWith(
        "B0",
      );
      expect(action.data).toEqual({ kitName: "B0", samples: 3, voicesBefore });
    });

    it("should handle ADD_SAMPLE redo action", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const addAction = addSampleAction({
        addedSample: {
          filename: "sample.wav",
          source_path: "/path/to/sample.wav",
        },
        slot: 0,
        voice: 1,
      });

      vi.mocked(globalThis.electronAPI.addSampleToSlot).mockResolvedValue({
        success: true,
      });

      const redoResult = await result.current.executeRedoAction(addAction);

      expect(globalThis.electronAPI.addSampleToSlot).toHaveBeenCalledWith(
        testKitName,
        1,
        0,
        "/path/to/sample.wav",
      );
      expect(redoResult).toEqual({ success: true });
    });

    it("should handle DELETE_SAMPLE redo action", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const deleteAction = deleteSampleAction({ slot: 0, voice: 1 });

      vi.mocked(globalThis.electronAPI.deleteSampleFromSlot).mockResolvedValue({
        success: true,
      });

      const redoResult = await result.current.executeRedoAction(deleteAction);

      expect(globalThis.electronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
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

      const reindexAction = reindexSamplesAction({ deletedSlot: 2, voice: 1 });

      vi.mocked(globalThis.electronAPI.deleteSampleFromSlot).mockResolvedValue({
        success: true,
      });

      const redoResult = await result.current.executeRedoAction(reindexAction);

      expect(globalThis.electronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
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

      const moveAction = moveSampleAction({
        fromSlot: 0,
        fromVoice: 1,
        mode: "insert",
        toSlot: 1,
        toVoice: 2,
      });

      vi.mocked(globalThis.electronAPI.moveSampleInKit).mockResolvedValue({
        success: true,
      });

      const redoResult = await result.current.executeRedoAction(moveAction);

      expect(globalThis.electronAPI.moveSampleInKit).toHaveBeenCalledWith(
        testKitName,
        1,
        0,
        2,
        1,
      );
      expect(redoResult).toEqual({ success: true });
    });

    it("should handle MOVE_SAMPLE_BETWEEN_KITS redo action", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const moveAction = moveSampleBetweenKitsAction({
        fromKit: "From Kit",
        fromSlot: 0,
        fromVoice: 1,
        mode: "insert",
        toKit: "To Kit",
        toSlot: 1,
        toVoice: 2,
      });

      vi.mocked(globalThis.electronAPI.moveSampleBetweenKits).mockResolvedValue(
        {
          success: true,
        },
      );

      const redoResult = await result.current.executeRedoAction(moveAction);

      expect(globalThis.electronAPI.moveSampleBetweenKits).toHaveBeenCalledWith(
        "From Kit",
        1,
        0,
        "To Kit",
        2,
        1,
        "insert",
      );
      expect(redoResult).toEqual({ success: true });
    });

    it("should handle unknown action type", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      await expect(
        result.current.executeRedoAction(unknownAction()),
      ).rejects.toThrow("Unknown action type: UNKNOWN_ACTION");
    });

    it("should handle missing electronAPI gracefully", async () => {
      vi.stubGlobal("electronAPI", undefined);

      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const addAction = addSampleAction({
        addedSample: {
          filename: "sample.wav",
          source_path: "/path/to/sample.wav",
        },
        slot: 0,
        voice: 1,
      });

      const redoResult = await result.current.executeRedoAction(addAction);

      expect(redoResult).toBeUndefined();
    });

    it("should handle missing specific API method", async () => {
      vi.stubGlobal("electronAPI", {
        ...globalThis.electronAPI,
        addSampleToSlot: undefined,
      }); // Missing addSampleToSlot

      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const addAction = addSampleAction({
        addedSample: {
          filename: "sample.wav",
          source_path: "/path/to/sample.wav",
        },
        slot: 0,
        voice: 1,
      });

      const redoResult = await result.current.executeRedoAction(addAction);

      expect(redoResult).toBeUndefined();
    });

    it("should handle API call failures", async () => {
      const { result } = renderHook(() =>
        useRedoActionHandlers({ kitName: testKitName }),
      );

      const deleteAction = deleteSampleAction({ slot: 0, voice: 1 });

      vi.mocked(globalThis.electronAPI.deleteSampleFromSlot).mockResolvedValue({
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

      const moveAction = moveSampleAction({
        fromSlot: 0,
        fromVoice: 1,
        mode: "insert",
        toSlot: 1,
        toVoice: 2,
      });

      vi.mocked(globalThis.electronAPI.moveSampleInKit).mockRejectedValue(
        new Error("Network error"),
      );

      await expect(
        result.current.executeRedoAction(moveAction),
      ).rejects.toThrow("Network error");
    });
  });
});
