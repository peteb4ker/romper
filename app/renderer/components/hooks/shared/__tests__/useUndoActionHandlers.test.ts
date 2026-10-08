import type {
  AddSampleAction,
  DeleteSampleAction,
  MoveSampleAction,
  MoveSampleBetweenKitsAction,
  ReindexSamplesAction,
  ReplaceSampleAction,
  VoiceSnapshot,
} from "@romper/shared/undoTypes";

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSequenceEditAction } from "../sequenceUndo";
import { useUndoActionHandlers } from "../useUndoActionHandlers";

// Use centralized mocks from vitest.setup.ts

describe("useUndoActionHandlers", () => {
  const mockOptions = {
    kitName: "TestKit",
  };
  /** Voice 1 as it was before an edit: full rows, gain included */
  const voiceOne: VoiceSnapshot = {
    samples: [
      {
        filename: "kick.wav",
        gain_db: -6,
        slot_number: 0,
        source_path: "/kick.wav",
        wav_bit_depth: 24,
        wav_bitrate: 2304000,
        wav_channels: 2,
        wav_sample_rate: 48000,
      },
    ],
    voice: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Use centralized mocks - they should be accessible via window.electronAPI
    if (window.electronAPI) {
      if (window.electronAPI.getAllSamplesForKit) {
        vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
          data: [],
          success: true,
        });
      }
      if (window.electronAPI.addSampleToSlot) {
        vi.mocked(window.electronAPI.addSampleToSlot).mockResolvedValue({
          success: true,
        });
      }
      if (window.electronAPI.deleteSampleFromSlot) {
        vi.mocked(window.electronAPI.deleteSampleFromSlot).mockResolvedValue({
          success: true,
        });
      }
      if (window.electronAPI.deleteSampleFromSlotWithoutReindexing) {
        vi.mocked(
          window.electronAPI.deleteSampleFromSlotWithoutReindexing,
        ).mockResolvedValue({ success: true });
      }
      if (window.electronAPI.replaceSampleInSlot) {
        vi.mocked(window.electronAPI.replaceSampleInSlot).mockResolvedValue({
          success: true,
        });
      }
      vi.mocked(window.electronAPI.restoreKitVoices).mockResolvedValue({
        success: true,
      });
      if (window.electronAPI.moveSampleBetweenKits) {
        vi.mocked(window.electronAPI.moveSampleBetweenKits).mockResolvedValue({
          success: true,
        });
      }
    }
  });

  describe("hook initialization", () => {
    it("should initialize without error", () => {
      const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
      expect(result.current).toBeDefined();
    });

    it("should provide executeUndoAction function", () => {
      const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
      expect(result.current).toHaveProperty("executeUndoAction");
      expect(typeof result.current.executeUndoAction).toBe("function");
    });
  });

  describe("executeUndoAction", () => {
    describe("ADD_SAMPLE undo", () => {
      it("should delete sample when undoing ADD_SAMPLE", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        const action: AddSampleAction = {
          data: {
            addedSample: {
              filename: "test.wav",
              source_path: "/path/to/test.wav",
            },
            slot: 0,
            voice: 1,
          },
          description: "Add sample",
          id: "test-id",
          timestamp: new Date(),
          type: "ADD_SAMPLE",
        };

        const consoleSpy = vi.spyOn(console, "log").mockImplementation();

        await result.current.executeUndoAction(action);

        expect(window.electronAPI?.deleteSampleFromSlot).toHaveBeenCalledWith(
          "TestKit",
          1,
          0,
        );

        consoleSpy.mockRestore();
      });
    });

    describe("DELETE_SAMPLE undo", () => {
      it("should restore sample when undoing DELETE_SAMPLE", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        const action: DeleteSampleAction = {
          data: {
            deletedSample: {
              filename: "test.wav",
              source_path: "/path/to/test.wav",
            },
            slot: 0,
            voice: 1,
          },
          description: "Delete sample",
          id: "test-id",
          timestamp: new Date(),
          type: "DELETE_SAMPLE",
        };

        const consoleSpy = vi.spyOn(console, "log").mockImplementation();

        await result.current.executeUndoAction(action);

        expect(window.electronAPI?.addSampleToSlot).toHaveBeenCalledWith(
          "TestKit",
          1,
          0,
          "/path/to/test.wav",
        );

        consoleSpy.mockRestore();
      });
    });

    describe("[Q-02] REPLACE_SAMPLE undo", () => {
      it("restores the voice's full rows, gain included, in one call", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        const action: ReplaceSampleAction = {
          data: {
            newSample: { filename: "new.wav", source_path: "/path/to/new.wav" },
            oldSample: { filename: "old.wav", source_path: "/path/to/old.wav" },
            slot: 0,
            voice: 1,
            voicesBefore: [voiceOne],
          },
          description: "Replace sample",
          id: "test-id",
          timestamp: new Date(),
          type: "REPLACE_SAMPLE",
        };

        const outcome = await result.current.executeUndoAction(action);

        expect(outcome).toEqual({ success: true });
        expect(window.electronAPI?.restoreKitVoices).toHaveBeenCalledTimes(1);
        expect(window.electronAPI?.restoreKitVoices).toHaveBeenCalledWith(
          "TestKit",
          [voiceOne],
        );
        expect(window.electronAPI?.replaceSampleInSlot).not.toHaveBeenCalled();
      });
    });

    describe("[Q-02] MOVE_SAMPLE undo", () => {
      const action: MoveSampleAction = {
        data: {
          affectedSamples: [],
          fromSlot: 0,
          fromVoice: 1,
          movedSample: { filename: "kick.wav", source_path: "/kick.wav" },
          toSlot: 0,
          toVoice: 2,
          voicesBefore: [voiceOne, { samples: [], voice: 2 }],
        },
        description: "Move sample",
        id: "test-id",
        timestamp: new Date(),
        type: "MOVE_SAMPLE",
      };

      it("restores both voices in one call", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        await result.current.executeUndoAction(action);

        expect(window.electronAPI?.restoreKitVoices).toHaveBeenCalledTimes(1);
        expect(window.electronAPI?.restoreKitVoices).toHaveBeenCalledWith(
          "TestKit",
          action.data.voicesBefore,
        );
        expect(window.electronAPI?.addSampleToSlot).not.toHaveBeenCalled();
      });

      it("passes a failed restore back", async () => {
        vi.mocked(window.electronAPI!.restoreKitVoices).mockResolvedValueOnce({
          error: "Database error",
          success: false,
        });
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        expect(await result.current.executeUndoAction(action)).toEqual({
          error: "Database error",
          success: false,
        });
      });
    });

    describe("MOVE_SAMPLE_BETWEEN_KITS undo", () => {
      it("should move sample back between kits", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        const action: MoveSampleBetweenKitsAction = {
          data: {
            affectedSamples: [],
            fromKit: "SourceKit",
            fromSlot: 0,
            fromVoice: 1,
            mode: "insert",
            movedSample: {
              filename: "moved.wav",
              source_path: "/path/to/moved.wav",
            },
            replacedSample: undefined,
            toKit: "TargetKit",
            toSlot: 1,
            toVoice: 2,
          },
          description: "Move sample between kits",
          id: "test-id",
          timestamp: new Date(),
          type: "MOVE_SAMPLE_BETWEEN_KITS",
        };

        await result.current.executeUndoAction(action);

        expect(window.electronAPI?.moveSampleBetweenKits).toHaveBeenCalledWith(
          "TargetKit", // from
          2, // fromVoice
          1, // fromSlot
          "SourceKit", // to
          1, // toVoice
          0, // toSlot
          "insert",
        );
      });

      it("should restore replaced sample after moving back", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        const action: MoveSampleBetweenKitsAction = {
          data: {
            affectedSamples: [],
            fromKit: "SourceKit",
            fromSlot: 0,
            fromVoice: 1,
            mode: "insert",
            movedSample: {
              filename: "moved.wav",
              source_path: "/path/to/moved.wav",
            },
            replacedSample: {
              filename: "replaced.wav",
              source_path: "/path/to/replaced.wav",
            },
            toKit: "TargetKit",
            toSlot: 1,
            toVoice: 2,
          },
          description: "Move sample between kits",
          id: "test-id",
          timestamp: new Date(),
          type: "MOVE_SAMPLE_BETWEEN_KITS",
        };

        await result.current.executeUndoAction(action);

        expect(window.electronAPI?.addSampleToSlot).toHaveBeenCalledWith(
          "TargetKit",
          2,
          1,
          "/path/to/replaced.wav",
        );
      });

      it("should handle errors during cross-kit move undo", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        if (window.electronAPI?.moveSampleBetweenKits) {
          vi.mocked(window.electronAPI.moveSampleBetweenKits).mockRejectedValue(
            new Error("Cross-kit error"),
          );
        }

        const action: MoveSampleBetweenKitsAction = {
          data: {
            affectedSamples: [],
            fromKit: "SourceKit",
            fromSlot: 0,
            fromVoice: 1,
            mode: "insert",
            movedSample: {
              filename: "moved.wav",
              source_path: "/path/to/moved.wav",
            },
            replacedSample: undefined,
            toKit: "TargetKit",
            toSlot: 1,
            toVoice: 2,
          },
          description: "Move sample between kits",
          id: "test-id",
          timestamp: new Date(),
          type: "MOVE_SAMPLE_BETWEEN_KITS",
        };

        const result_data = await result.current.executeUndoAction(action);

        expect(result_data).toEqual({
          error: "Cross-kit error",
          success: false,
        });
      });
    });

    describe("[Q-02] REINDEX_SAMPLES undo", () => {
      it("restores the voice as it was before the delete, in one call", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        const action: ReindexSamplesAction = {
          data: {
            affectedSamples: [],
            deletedSample: { filename: "kick.wav", source_path: "/kick.wav" },
            deletedSlot: 0,
            voice: 1,
            voicesBefore: [voiceOne],
          },
          description: "Delete sample",
          id: "test-id",
          timestamp: new Date(),
          type: "REINDEX_SAMPLES",
        };

        await result.current.executeUndoAction(action);

        expect(window.electronAPI?.restoreKitVoices).toHaveBeenCalledTimes(1);
        expect(window.electronAPI?.restoreKitVoices).toHaveBeenCalledWith(
          "TestKit",
          [voiceOne],
        );
        expect(window.electronAPI?.addSampleToSlot).not.toHaveBeenCalled();
      });
    });

    describe("unknown action type", () => {
      it("should throw error for unknown action type", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        const unknownAction = {
          data: {},
          description: "Unknown action",
          id: "test-id",
          timestamp: new Date(),
          type: "UNKNOWN_ACTION",
        } as unknown;

        await expect(
          result.current.executeUndoAction(unknownAction),
        ).rejects.toThrow("Unknown action type: UNKNOWN_ACTION");
      });
    });
  });

  describe("sequencer edits", () => {
    it("undo writes the before-state back", async () => {
      const before = {
        sliceSteps: [[null]],
        stepPattern: [[0]],
        triggerConditions: [[null]],
      };
      const after = { ...before, stepPattern: [[127]] };
      const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

      const outcome = await result.current.executeUndoAction(
        createSequenceEditAction("Turn step 1 on voice 1 on", before, after),
      );

      expect(outcome).toEqual({ success: true });
      expect(window.electronAPI.restoreKitSequence).toHaveBeenCalledWith(
        "TestKit",
        { stepPattern: [[0]] },
      );
    });
  });
});
