import type {
  AddSampleAction,
  DeleteSampleAction,
  MoveSampleAction,
  MoveSampleBetweenKitsAction,
  ReindexSamplesAction,
  ReplaceSampleAction,
} from "@romper/shared/undoTypes";

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUndoActionHandlers } from "../useUndoActionHandlers";

// Use centralized mocks from vitest.setup.ts

describe("useUndoActionHandlers", () => {
  const mockOptions = {
    kitName: "TestKit",
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
              is_stereo: false,
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
              is_stereo: false,
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
          { forceMono: true },
        );

        consoleSpy.mockRestore();
      });
    });

    describe("REPLACE_SAMPLE undo", () => {
      it("should restore old sample when undoing REPLACE_SAMPLE", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        const action: ReplaceSampleAction = {
          data: {
            newSample: {
              filename: "new.wav",
              is_stereo: false,
              source_path: "/path/to/new.wav",
            },
            oldSample: {
              filename: "old.wav",
              is_stereo: true,
              source_path: "/path/to/old.wav",
            },
            slot: 0,
            voice: 1,
          },
          description: "Replace sample",
          id: "test-id",
          timestamp: new Date(),
          type: "REPLACE_SAMPLE",
        };

        const consoleSpy = vi.spyOn(console, "log").mockImplementation();

        await result.current.executeUndoAction(action);

        expect(window.electronAPI?.replaceSampleInSlot).toHaveBeenCalledWith(
          "TestKit",
          1,
          0,
          "/path/to/old.wav",
          { forceMono: false }, // stereo sample
        );

        consoleSpy.mockRestore();
      });
    });

    describe("MOVE_SAMPLE undo", () => {
      it("should restore state using snapshot when available", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        const action: MoveSampleAction = {
          data: {
            affectedSamples: [],
            fromSlot: 0,
            fromVoice: 1,
            movedSample: {
              filename: "moved.wav",
              is_stereo: false,
              source_path: "/path/to/moved.wav",
            },
            replacedSample: undefined,
            stateSnapshot: [
              {
                sample: {
                  filename: "original.wav",
                  is_stereo: false,
                  source_path: "/path/to/original.wav",
                },
                slot: 0,
                voice: 1,
              },
            ],
            toSlot: 1,
            toVoice: 2,
          },
          description: "Move sample",
          id: "test-id",
          timestamp: new Date(),
          type: "MOVE_SAMPLE",
        };

        const consoleSpy = vi.spyOn(console, "log").mockImplementation();

        await result.current.executeUndoAction(action);

        // Should use snapshot-based restoration
        expect(consoleSpy).toHaveBeenCalledWith(
          "[UNDO] Using snapshot-based restoration, snapshot length:",
          1,
        );

        consoleSpy.mockRestore();
      });

      it("should use legacy restoration when no snapshot available", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        const action: MoveSampleAction = {
          data: {
            affectedSamples: [],
            fromSlot: 0,
            fromVoice: 1,
            movedSample: {
              filename: "moved.wav",
              is_stereo: false,
              source_path: "/path/to/moved.wav",
            },
            replacedSample: undefined,
            stateSnapshot: [],
            toSlot: 1,
            toVoice: 2,
          },
          description: "Move sample",
          id: "test-id",
          timestamp: new Date(),
          type: "MOVE_SAMPLE",
        };

        const consoleSpy = vi.spyOn(console, "log").mockImplementation();

        const result_data = await result.current.executeUndoAction(action);

        expect(result_data).toEqual({ success: true });

        consoleSpy.mockRestore();
      });

      it("should handle errors during move undo", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        // Mock an error scenario
        if (window.electronAPI?.getAllSamplesForKit) {
          vi.mocked(window.electronAPI.getAllSamplesForKit).mockRejectedValue(
            new Error("API Error"),
          );
        }

        const action: MoveSampleAction = {
          data: {
            affectedSamples: [],
            fromSlot: 0,
            fromVoice: 1,
            movedSample: {
              filename: "moved.wav",
              is_stereo: false,
              source_path: "/path/to/moved.wav",
            },
            replacedSample: undefined,
            stateSnapshot: [
              {
                sample: {
                  filename: "original.wav",
                  is_stereo: false,
                  source_path: "/path/to/original.wav",
                },
                slot: 0,
                voice: 1,
              },
            ],
            toSlot: 1,
            toVoice: 2,
          },
          description: "Move sample",
          id: "test-id",
          timestamp: new Date(),
          type: "MOVE_SAMPLE",
        };

        const consoleSpy = vi.spyOn(console, "log").mockImplementation();

        const result_data = await result.current.executeUndoAction(action);

        expect(result_data).toEqual({
          error: "API Error",
          success: false,
        });

        consoleSpy.mockRestore();
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
              is_stereo: false,
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
              is_stereo: false,
              source_path: "/path/to/moved.wav",
            },
            replacedSample: {
              filename: "replaced.wav",
              is_stereo: true,
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
          { forceMono: false },
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
              is_stereo: false,
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

    describe("REINDEX_SAMPLES undo", () => {
      it("should restore pre-reindexing state", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        const action: ReindexSamplesAction = {
          data: {
            affectedSamples: [
              {
                newSlot: 0,
                oldSlot: 1,
                sample: {
                  filename: "affected.wav",
                  is_stereo: true,
                  source_path: "/path/to/affected.wav",
                },
                voice: 1,
              },
            ],
            deletedSample: {
              filename: "deleted.wav",
              is_stereo: false,
              source_path: "/path/to/deleted.wav",
            },
            deletedSlot: 0,
            voice: 1,
          },
          description: "Reindex samples",
          id: "test-id",
          timestamp: new Date(),
          type: "REINDEX_SAMPLES",
        };

        const consoleSpy = vi.spyOn(console, "log").mockImplementation();

        await result.current.executeUndoAction(action);

        // Should restore deleted sample
        expect(window.electronAPI?.addSampleToSlot).toHaveBeenCalledWith(
          "TestKit",
          1,
          0,
          "/path/to/deleted.wav",
          { forceMono: true },
        );

        // Should restore affected samples
        expect(window.electronAPI?.addSampleToSlot).toHaveBeenCalledWith(
          "TestKit",
          1,
          0, // newSlot from action data
          "/path/to/affected.wav",
          { forceMono: false },
        );

        consoleSpy.mockRestore();
      });

      it("should handle errors during reindex undo", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));

        if (window.electronAPI?.addSampleToSlot) {
          vi.mocked(window.electronAPI.addSampleToSlot).mockRejectedValue(
            new Error("Reindex error"),
          );
        }

        const action: ReindexSamplesAction = {
          data: {
            affectedSamples: [],
            deletedSample: {
              filename: "deleted.wav",
              is_stereo: false,
              source_path: "/path/to/deleted.wav",
            },
            deletedSlot: 0,
            voice: 1,
          },
          description: "Reindex samples",
          id: "test-id",
          timestamp: new Date(),
          type: "REINDEX_SAMPLES",
        };

        const consoleSpy = vi.spyOn(console, "log").mockImplementation();

        const result_data = await result.current.executeUndoAction(action);

        expect(result_data).toEqual({
          error: "Reindex error",
          success: false,
        });

        consoleSpy.mockRestore();
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
});
