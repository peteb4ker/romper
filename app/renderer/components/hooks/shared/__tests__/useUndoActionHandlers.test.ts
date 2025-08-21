import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AddSampleAction,
  DeleteSampleAction,
  MoveSampleAction,
  MoveSampleBetweenKitsAction,
  ReindexSamplesAction,
  ReplaceSampleAction,
} from "@romper/shared/undoTypes";

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
          success: true,
          data: [],
        });
      }
      if (window.electronAPI.addSampleToSlot) {
        vi.mocked(window.electronAPI.addSampleToSlot).mockResolvedValue({ success: true });
      }
      if (window.electronAPI.deleteSampleFromSlot) {
        vi.mocked(window.electronAPI.deleteSampleFromSlot).mockResolvedValue({ success: true });
      }
      if (window.electronAPI.deleteSampleFromSlotWithoutReindexing) {
        vi.mocked(window.electronAPI.deleteSampleFromSlotWithoutReindexing).mockResolvedValue({ success: true });
      }
      if (window.electronAPI.replaceSampleInSlot) {
        vi.mocked(window.electronAPI.replaceSampleInSlot).mockResolvedValue({ success: true });
      }
      if (window.electronAPI.moveSampleBetweenKits) {
        vi.mocked(window.electronAPI.moveSampleBetweenKits).mockResolvedValue({ success: true });
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
      expect(result.current).toHaveProperty('executeUndoAction');
      expect(typeof result.current.executeUndoAction).toBe('function');
    });
  });

  describe("executeUndoAction", () => {
    describe("ADD_SAMPLE undo", () => {
      it("should delete sample when undoing ADD_SAMPLE", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        
        const action: AddSampleAction = {
          type: "ADD_SAMPLE",
          id: "test-id",
          timestamp: new Date(),
          description: "Add sample",
          data: {
            voice: 1,
            slot: 0,
            addedSample: {
              filename: "test.wav",
              is_stereo: false,
              source_path: "/path/to/test.wav",
            },
          },
        };

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
        
        await result.current.executeUndoAction(action);
        
        expect(window.electronAPI?.deleteSampleFromSlot).toHaveBeenCalledWith(
          "TestKit",
          1,
          0
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe("DELETE_SAMPLE undo", () => {
      it("should restore sample when undoing DELETE_SAMPLE", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        
        const action: DeleteSampleAction = {
          type: "DELETE_SAMPLE",
          id: "test-id",
          timestamp: new Date(),
          description: "Delete sample",
          data: {
            voice: 1,
            slot: 0,
            deletedSample: {
              filename: "test.wav",
              is_stereo: false,
              source_path: "/path/to/test.wav",
            },
          },
        };

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
        
        await result.current.executeUndoAction(action);
        
        expect(window.electronAPI?.addSampleToSlot).toHaveBeenCalledWith(
          "TestKit",
          1,
          0,
          "/path/to/test.wav",
          { forceMono: true }
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe("REPLACE_SAMPLE undo", () => {
      it("should restore old sample when undoing REPLACE_SAMPLE", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        
        const action: ReplaceSampleAction = {
          type: "REPLACE_SAMPLE",
          id: "test-id",
          timestamp: new Date(),
          description: "Replace sample",
          data: {
            voice: 1,
            slot: 0,
            oldSample: {
              filename: "old.wav",
              is_stereo: true,
              source_path: "/path/to/old.wav",
            },
            newSample: {
              filename: "new.wav",
              is_stereo: false,
              source_path: "/path/to/new.wav",
            },
          },
        };

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
        
        await result.current.executeUndoAction(action);
        
        expect(window.electronAPI?.replaceSampleInSlot).toHaveBeenCalledWith(
          "TestKit",
          1,
          0,
          "/path/to/old.wav",
          { forceMono: false } // stereo sample
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe("MOVE_SAMPLE undo", () => {
      it("should restore state using snapshot when available", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        
        const action: MoveSampleAction = {
          type: "MOVE_SAMPLE",
          id: "test-id",
          timestamp: new Date(),
          description: "Move sample",
          data: {
            fromVoice: 1,
            fromSlot: 0,
            toVoice: 2,
            toSlot: 1,
            movedSample: {
              filename: "moved.wav",
              is_stereo: false,
              source_path: "/path/to/moved.wav",
            },
            replacedSample: undefined,
            affectedSamples: [],
            stateSnapshot: [{
              voice: 1,
              slot: 0,
              sample: {
                filename: "original.wav",
                is_stereo: false,
                source_path: "/path/to/original.wav",
              },
            }],
          },
        };

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
        
        await result.current.executeUndoAction(action);
        
        // Should use snapshot-based restoration
        expect(consoleSpy).toHaveBeenCalledWith(
          "[UNDO] Using snapshot-based restoration, snapshot length:",
          1
        );
        
        consoleSpy.mockRestore();
      });

      it("should use legacy restoration when no snapshot available", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        
        const action: MoveSampleAction = {
          type: "MOVE_SAMPLE",
          id: "test-id",
          timestamp: new Date(),
          description: "Move sample",
          data: {
            fromVoice: 1,
            fromSlot: 0,
            toVoice: 2,
            toSlot: 1,
            movedSample: {
              filename: "moved.wav",
              is_stereo: false,
              source_path: "/path/to/moved.wav",
            },
            replacedSample: undefined,
            affectedSamples: [],
            stateSnapshot: [],
          },
        };

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
        
        const result_data = await result.current.executeUndoAction(action);
        
        expect(result_data).toEqual({ success: true });
        
        consoleSpy.mockRestore();
      });

      it("should handle errors during move undo", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        
        // Mock an error scenario
        if (window.electronAPI?.getAllSamplesForKit) {
          vi.mocked(window.electronAPI.getAllSamplesForKit).mockRejectedValue(new Error("API Error"));
        }
        
        const action: MoveSampleAction = {
          type: "MOVE_SAMPLE",
          id: "test-id",
          timestamp: new Date(),
          description: "Move sample",
          data: {
            fromVoice: 1,
            fromSlot: 0,
            toVoice: 2,
            toSlot: 1,
            movedSample: {
              filename: "moved.wav",
              is_stereo: false,
              source_path: "/path/to/moved.wav",
            },
            replacedSample: undefined,
            affectedSamples: [],
            stateSnapshot: [{
              voice: 1,
              slot: 0,
              sample: {
                filename: "original.wav",
                is_stereo: false,
                source_path: "/path/to/original.wav",
              },
            }],
          },
        };

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
        
        const result_data = await result.current.executeUndoAction(action);
        
        expect(result_data).toEqual({
          success: false,
          error: "API Error",
        });
        
        consoleSpy.mockRestore();
      });
    });

    describe("MOVE_SAMPLE_BETWEEN_KITS undo", () => {
      it("should move sample back between kits", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        
        const action: MoveSampleBetweenKitsAction = {
          type: "MOVE_SAMPLE_BETWEEN_KITS",
          id: "test-id",
          timestamp: new Date(),
          description: "Move sample between kits",
          data: {
            fromKit: "SourceKit",
            fromVoice: 1,
            fromSlot: 0,
            toKit: "TargetKit",
            toVoice: 2,
            toSlot: 1,
            mode: "insert",
            movedSample: {
              filename: "moved.wav",
              is_stereo: false,
              source_path: "/path/to/moved.wav",
            },
            replacedSample: undefined,
            affectedSamples: [],
          },
        };
        
        await result.current.executeUndoAction(action);
        
        expect(window.electronAPI?.moveSampleBetweenKits).toHaveBeenCalledWith(
          "TargetKit", // from
          2, // fromVoice
          1, // fromSlot
          "SourceKit", // to
          1, // toVoice
          0, // toSlot
          "insert"
        );
      });

      it("should restore replaced sample after moving back", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        
        const action: MoveSampleBetweenKitsAction = {
          type: "MOVE_SAMPLE_BETWEEN_KITS",
          id: "test-id",
          timestamp: new Date(),
          description: "Move sample between kits",
          data: {
            fromKit: "SourceKit",
            fromVoice: 1,
            fromSlot: 0,
            toKit: "TargetKit",
            toVoice: 2,
            toSlot: 1,
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
            affectedSamples: [],
          },
        };
        
        await result.current.executeUndoAction(action);
        
        expect(window.electronAPI?.addSampleToSlot).toHaveBeenCalledWith(
          "TargetKit",
          2,
          1,
          "/path/to/replaced.wav",
          { forceMono: false }
        );
      });

      it("should handle errors during cross-kit move undo", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        
        if (window.electronAPI?.moveSampleBetweenKits) {
          vi.mocked(window.electronAPI.moveSampleBetweenKits).mockRejectedValue(new Error("Cross-kit error"));
        }
        
        const action: MoveSampleBetweenKitsAction = {
          type: "MOVE_SAMPLE_BETWEEN_KITS",
          id: "test-id",
          timestamp: new Date(),
          description: "Move sample between kits",
          data: {
            fromKit: "SourceKit",
            fromVoice: 1,
            fromSlot: 0,
            toKit: "TargetKit",
            toVoice: 2,
            toSlot: 1,
            mode: "insert",
            movedSample: {
              filename: "moved.wav",
              is_stereo: false,
              source_path: "/path/to/moved.wav",
            },
            replacedSample: undefined,
            affectedSamples: [],
          },
        };
        
        const result_data = await result.current.executeUndoAction(action);
        
        expect(result_data).toEqual({
          success: false,
          error: "Cross-kit error",
        });
      });
    });

    describe("REINDEX_SAMPLES undo", () => {
      it("should restore pre-reindexing state", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        
        const action: ReindexSamplesAction = {
          type: "REINDEX_SAMPLES",
          id: "test-id",
          timestamp: new Date(),
          description: "Reindex samples",
          data: {
            voice: 1,
            deletedSlot: 0,
            deletedSample: {
              filename: "deleted.wav",
              is_stereo: false,
              source_path: "/path/to/deleted.wav",
            },
            affectedSamples: [{
              voice: 1,
              oldSlot: 1,
              newSlot: 0,
              sample: {
                filename: "affected.wav",
                is_stereo: true,
                source_path: "/path/to/affected.wav",
              },
            }],
          },
        };

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
        
        await result.current.executeUndoAction(action);
        
        // Should restore deleted sample
        expect(window.electronAPI?.addSampleToSlot).toHaveBeenCalledWith(
          "TestKit",
          1,
          0,
          "/path/to/deleted.wav",
          { forceMono: true }
        );
        
        // Should restore affected samples
        expect(window.electronAPI?.addSampleToSlot).toHaveBeenCalledWith(
          "TestKit",
          1,
          0, // newSlot from action data
          "/path/to/affected.wav",
          { forceMono: false }
        );
        
        consoleSpy.mockRestore();
      });

      it("should handle errors during reindex undo", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        
        if (window.electronAPI?.addSampleToSlot) {
          vi.mocked(window.electronAPI.addSampleToSlot).mockRejectedValue(new Error("Reindex error"));
        }
        
        const action: ReindexSamplesAction = {
          type: "REINDEX_SAMPLES",
          id: "test-id",
          timestamp: new Date(),
          description: "Reindex samples",
          data: {
            voice: 1,
            deletedSlot: 0,
            deletedSample: {
              filename: "deleted.wav",
              is_stereo: false,
              source_path: "/path/to/deleted.wav",
            },
            affectedSamples: [],
          },
        };

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
        
        const result_data = await result.current.executeUndoAction(action);
        
        expect(result_data).toEqual({
          success: false,
          error: "Reindex error",
        });
        
        consoleSpy.mockRestore();
      });
    });

    describe("unknown action type", () => {
      it("should throw error for unknown action type", async () => {
        const { result } = renderHook(() => useUndoActionHandlers(mockOptions));
        
        const unknownAction = {
          type: "UNKNOWN_ACTION",
          id: "test-id",
          timestamp: new Date(),
          description: "Unknown action",
          data: {},
        } as any;
        
        await expect(result.current.executeUndoAction(unknownAction)).rejects.toThrow(
          "Unknown action type: UNKNOWN_ACTION"
        );
      });
    });
  });
});
