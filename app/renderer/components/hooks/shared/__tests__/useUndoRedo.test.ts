import { dbSlotToUiSlot } from "@romper/shared/slotUtils";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUndoRedo } from "../useUndoRedo";

// Mock electron API
const mockElectronAPI = {
  addSampleToSlot: vi.fn(),
  deleteSampleFromSlot: vi.fn(),
  deleteSampleFromSlotWithoutReindexing: vi.fn(),
  getAllSamplesForKit: vi.fn(),
  moveSampleBetweenKits: vi.fn(),
  moveSampleInKit: vi.fn(),
  replaceSampleInSlot: vi.fn(),
};

// Setup window.electronAPI mock
beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown).electronAPI = mockElectronAPI;

  // Reset all mocks to return success by default
  Object.values(mockElectronAPI).forEach((mock) => {
    mock.mockResolvedValue({ success: true });
  });
});

describe("useUndoRedo - Basic Tests", () => {
  it("should initialize with empty stacks", () => {
    const { result } = renderHook(() => useUndoRedo("test-kit"));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoCount).toBe(0);
    expect(result.current.redoCount).toBe(0);
    expect(result.current.error).toBe(null);
  });

  it("should add actions to undo stack", () => {
    const { result } = renderHook(() => useUndoRedo("test-kit"));

    act(() => {
      result.current.addAction({
        data: {
          addedSample: {
            filename: "test.wav",
            is_stereo: false,
            source_path: "/path/to/test.wav",
          },
          slot: 0,
          voice: 1,
        },
        type: "ADD_SAMPLE",
      });
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoCount).toBe(1);
    expect(result.current.undoDescription).toBe(
      "Undo add sample to voice 1, slot 1",
    );
  });

  it("should perform basic undo operation", async () => {
    const { result } = renderHook(() => useUndoRedo("test-kit"));

    act(() => {
      result.current.addAction({
        data: {
          addedSample: {
            filename: "test.wav",
            is_stereo: false,
            source_path: "/path/to/test.wav",
          },
          slot: 2,
          voice: 1,
        },
        type: "ADD_SAMPLE",
      });
    });

    await act(async () => {
      await result.current.undo();
    });

    expect(mockElectronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
      "test-kit",
      1,
      2,
    );
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("should clear stacks when kit changes", () => {
    const { rerender, result } = renderHook(
      ({ kitName }) => useUndoRedo(kitName),
      {
        initialProps: { kitName: "kit1" },
      },
    );

    // Add some actions
    act(() => {
      result.current.addAction({
        data: {
          addedSample: {
            filename: "test.wav",
            is_stereo: false,
            source_path: "/path/to/test.wav",
          },
          slot: 0,
          voice: 1,
        },
        type: "ADD_SAMPLE",
      });
    });

    expect(result.current.undoCount).toBe(1);

    // Change kit
    rerender({ kitName: "kit2" });

    expect(result.current.undoCount).toBe(0);
    expect(result.current.redoCount).toBe(0);
  });

  describe("Move-Undo Gap Bug Fix", () => {
    it("should fix the gap bug: move 1.12→1.9 then undo restores perfectly", async () => {
      // Test the specific bug fix for move-undo operations leaving gaps

      // Create the state snapshot that would be captured before the move
      const stateSnapshot = [
        {
          sample: {
            filename: "sample1.wav",
            is_stereo: false,
            source_path: "/path/1.wav",
          },
          slot: 0,
          voice: 1,
        },
        {
          sample: {
            filename: "sample2.wav",
            is_stereo: false,
            source_path: "/path/2.wav",
          },
          slot: 1,
          voice: 1,
        },
        {
          sample: {
            filename: "sample3.wav",
            is_stereo: false,
            source_path: "/path/3.wav",
          },
          slot: 2,
          voice: 1,
        },
        {
          sample: {
            filename: "sample4.wav",
            is_stereo: false,
            source_path: "/path/4.wav",
          },
          slot: 3,
          voice: 1,
        },
        {
          sample: {
            filename: "sample5.wav",
            is_stereo: false,
            source_path: "/path/5.wav",
          },
          slot: 4,
          voice: 1,
        },
        {
          sample: {
            filename: "sample6.wav",
            is_stereo: false,
            source_path: "/path/6.wav",
          },
          slot: 5,
          voice: 1,
        },
        {
          sample: {
            filename: "sample7.wav",
            is_stereo: false,
            source_path: "/path/7.wav",
          },
          slot: 6,
          voice: 1,
        },
        {
          sample: {
            filename: "sample8.wav",
            is_stereo: false,
            source_path: "/path/8.wav",
          },
          slot: 7,
          voice: 1,
        },
        {
          sample: {
            filename: "sample9.wav",
            is_stereo: false,
            source_path: "/path/9.wav",
          },
          slot: 8,
          voice: 1,
        },
        {
          sample: {
            filename: "sample10.wav",
            is_stereo: false,
            source_path: "/path/10.wav",
          },
          slot: 9,
          voice: 1,
        },
        {
          sample: {
            filename: "sample11.wav",
            is_stereo: false,
            source_path: "/path/11.wav",
          },
          slot: 10,
          voice: 1,
        },
        {
          sample: {
            filename: "sample12.wav",
            is_stereo: false,
            source_path: "/path/12.wav",
          },
          slot: 11,
          voice: 1,
        },
      ];

      // Simulate the current state AFTER the move 1.12→1.9
      // sample12 moved to slot 9, samples 9-11 shifted right
      const currentStateAfterMove = [
        {
          filename: "sample1.wav",
          is_stereo: false,
          slot_number: 0,
          source_path: "/path/1.wav",
          voice_number: 1,
        },
        {
          filename: "sample2.wav",
          is_stereo: false,
          slot_number: 1,
          source_path: "/path/2.wav",
          voice_number: 1,
        },
        {
          filename: "sample3.wav",
          is_stereo: false,
          slot_number: 2,
          source_path: "/path/3.wav",
          voice_number: 1,
        },
        {
          filename: "sample4.wav",
          is_stereo: false,
          slot_number: 3,
          source_path: "/path/4.wav",
          voice_number: 1,
        },
        {
          filename: "sample5.wav",
          is_stereo: false,
          slot_number: 4,
          source_path: "/path/5.wav",
          voice_number: 1,
        },
        {
          filename: "sample6.wav",
          is_stereo: false,
          slot_number: 5,
          source_path: "/path/6.wav",
          voice_number: 1,
        },
        {
          filename: "sample7.wav",
          is_stereo: false,
          slot_number: 6,
          source_path: "/path/7.wav",
          voice_number: 1,
        },
        {
          filename: "sample8.wav",
          is_stereo: false,
          slot_number: 7,
          source_path: "/path/8.wav",
          voice_number: 1,
        },
        {
          filename: "sample12.wav",
          is_stereo: false,
          slot_number: 8,
          source_path: "/path/12.wav",
          voice_number: 1,
        }, // moved here
        {
          filename: "sample9.wav",
          is_stereo: false,
          slot_number: 9,
          source_path: "/path/9.wav",
          voice_number: 1,
        }, // shifted
        {
          filename: "sample10.wav",
          is_stereo: false,
          slot_number: 10,
          source_path: "/path/10.wav",
          voice_number: 1,
        }, // shifted
        {
          filename: "sample11.wav",
          is_stereo: false,
          slot_number: 11,
          source_path: "/path/11.wav",
          voice_number: 1,
        }, // shifted
      ];

      // Mock the getAllSamplesForKit call that happens during undo
      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        data: currentStateAfterMove,
        success: true,
      });

      // Mock successful delete and add operations
      mockElectronAPI.deleteSampleFromSlotWithoutReindexing.mockResolvedValue({
        data: { deletedSamples: [] },
        success: true,
      });

      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        data: { sampleId: 123 },
        success: true,
      });

      // Create the move action that would be recorded
      const moveAction = {
        data: {
          affectedSamples: [
            {
              newSlot: 10,
              oldSlot: 9,
              sample: {
                filename: "sample9.wav",
                is_stereo: false,
                source_path: "/path/9.wav",
              },
              voice: 1,
            },
            {
              newSlot: 11,
              oldSlot: 10,
              sample: {
                filename: "sample10.wav",
                is_stereo: false,
                source_path: "/path/10.wav",
              },
              voice: 1,
            },
            {
              newSlot: 12,
              oldSlot: 11,
              sample: {
                filename: "sample11.wav",
                is_stereo: false,
                source_path: "/path/11.wav",
              },
              voice: 1,
            },
          ],
          fromSlot: 11, // 0-based
          fromVoice: 1,
          mode: "insert" as const,
          movedSample: {
            filename: "sample12.wav",
            is_stereo: false,
            source_path: "/path/12.wav",
          },
          stateSnapshot,
          toSlot: 8, // 0-based
          toVoice: 1,
        },
        description: "Move sample from voice 1, slot 12 to voice 1, slot 9",
        id: "test-action",
        timestamp: new Date(),
        type: "MOVE_SAMPLE" as const,
      };

      // Create undo hook and add the action
      const { result } = renderHook(() => useUndoRedo("TestKit"));

      act(() => {
        result.current.addAction(moveAction);
      });

      expect(result.current.undoCount).toBe(1);
      expect(result.current.canUndo).toBe(true);

      // Perform the undo
      await act(async () => {
        await result.current.undo();
      });

      // Verify the fix: should delete ALL current samples from voice 1, then restore from snapshot
      const deleteCalls =
        mockElectronAPI.deleteSampleFromSlotWithoutReindexing.mock.calls;
      const addCalls = mockElectronAPI.addSampleToSlot.mock.calls;

      // Should delete all 12 current samples
      expect(deleteCalls.length).toBe(12);

      // Should restore all 12 samples from snapshot
      expect(addCalls.length).toBe(12);

      // Verify all current samples are deleted (0-based slots)
      const expectedDeleteSlots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const actualDeleteSlots = deleteCalls
        .map((call) => call[2])
        .sort((a, b) => a - b);
      expect(actualDeleteSlots).toEqual(expectedDeleteSlots);

      // Verify all snapshot samples are restored to correct positions (0-based)
      stateSnapshot.forEach((snapshotSample) => {
        const correspondingAddCall = addCalls.find(
          (call) =>
            call[1] === snapshotSample.voice && // voice matches
            call[2] === dbSlotToUiSlot(snapshotSample.slot) - 1 && // slot matches (convert db slot to 0-based display slot)
            call[3] === snapshotSample.sample.source_path, // source_path matches
        );

        expect(correspondingAddCall).toBeDefined(
          `Sample ${snapshotSample.sample.filename} should be restored to voice ${snapshotSample.voice}, slot ${snapshotSample.slot}`,
        );
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe("Redo Operations", () => {
    it("should perform basic redo operation", async () => {
      const { result } = renderHook(() => useUndoRedo("test-kit"));

      // Add action
      act(() => {
        result.current.addAction({
          data: {
            addedSample: {
              filename: "test.wav",
              is_stereo: false,
              source_path: "/path/to/test.wav",
            },
            slot: 0,
            voice: 1,
          },
          type: "ADD_SAMPLE",
        });
      });

      // Undo it
      await act(async () => {
        await result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);
      expect(result.current.redoCount).toBe(1);
      expect(result.current.redoDescription).toBe(
        "Undo add sample to voice 1, slot 1",
      );

      // Now redo
      await act(async () => {
        await result.current.redo();
      });

      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledWith(
        "test-kit",
        1,
        0,
        "/path/to/test.wav",
        { forceMono: true },
      );
      expect(result.current.canRedo).toBe(false);
      expect(result.current.canUndo).toBe(true);
    });

    it("should handle redo for DELETE_SAMPLE action", async () => {
      const { result } = renderHook(() => useUndoRedo("test-kit"));

      act(() => {
        result.current.addAction({
          data: {
            deletedSample: {
              filename: "deleted.wav",
              is_stereo: true,
              source_path: "/path/to/deleted.wav",
            },
            slot: 1,
            voice: 2,
          },
          type: "DELETE_SAMPLE",
        });
      });

      await act(async () => {
        await result.current.undo();
      });

      await act(async () => {
        await result.current.redo();
      });

      expect(mockElectronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
        "test-kit",
        2,
        1,
      );
    });

    it("should handle redo failure gracefully", async () => {
      const { result } = renderHook(() => useUndoRedo("test-kit"));

      act(() => {
        result.current.addAction({
          data: {
            addedSample: {
              filename: "test.wav",
              is_stereo: false,
              source_path: "/path/to/test.wav",
            },
            slot: 0,
            voice: 1,
          },
          type: "ADD_SAMPLE",
        });
      });

      await act(async () => {
        await result.current.undo();
      });

      // Mock failure
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        error: "Redo failed",
        success: false,
      });

      await act(async () => {
        await result.current.redo();
      });

      expect(result.current.error).toBe("Redo failed");
      expect(result.current.canRedo).toBe(true); // Should still have redo action
    });
  });

  describe("DELETE_SAMPLE Undo Operations", () => {
    it("should undo DELETE_SAMPLE by restoring the sample", async () => {
      const { result } = renderHook(() => useUndoRedo("test-kit"));

      act(() => {
        result.current.addAction({
          data: {
            deletedSample: {
              filename: "deleted.wav",
              is_stereo: true,
              source_path: "/path/to/deleted.wav",
            },
            slot: 3,
            voice: 2,
          },
          type: "DELETE_SAMPLE",
        });
      });

      await act(async () => {
        await result.current.undo();
      });

      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledWith(
        "test-kit",
        2,
        3,
        "/path/to/deleted.wav",
        { forceMono: false }, // stereo sample
      );
    });
  });

  describe("REPLACE_SAMPLE Undo Operations", () => {
    it("should undo REPLACE_SAMPLE by restoring old sample", async () => {
      const { result } = renderHook(() => useUndoRedo("test-kit"));

      act(() => {
        result.current.addAction({
          data: {
            newSample: {
              filename: "new.wav",
              is_stereo: true,
              source_path: "/path/to/new.wav",
            },
            oldSample: {
              filename: "old.wav",
              is_stereo: false,
              source_path: "/path/to/old.wav",
            },
            slot: 1,
            voice: 1,
          },
          type: "REPLACE_SAMPLE",
        });
      });

      await act(async () => {
        await result.current.undo();
      });

      expect(mockElectronAPI.replaceSampleInSlot).toHaveBeenCalledWith(
        "test-kit",
        1,
        1,
        "/path/to/old.wav",
        { forceMono: true }, // old sample was mono
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle unknown action type in undo", async () => {
      const { result } = renderHook(() => useUndoRedo("test-kit"));

      act(() => {
        result.current.addAction({
          data: {},
          type: "UNKNOWN_ACTION" as unknown,
        });
      });

      await act(async () => {
        await result.current.undo();
      });

      expect(result.current.error).toContain("Unknown action type");
    });

    it("should clear error when clearError is called", async () => {
      const { result } = renderHook(() => useUndoRedo("test-kit"));

      // Trigger an error by adding action with unknown type and undoing
      act(() => {
        result.current.addAction({
          data: {},
          type: "UNKNOWN_ACTION" as unknown,
        });
      });

      await act(async () => {
        await result.current.undo();
      });

      expect(result.current.error).toBeTruthy();

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });

    it("should not undo when already undoing", async () => {
      const { result } = renderHook(() => useUndoRedo("test-kit"));

      act(() => {
        result.current.addAction({
          data: {
            addedSample: {
              filename: "test.wav",
              is_stereo: false,
              source_path: "/path/to/test.wav",
            },
            slot: 0,
            voice: 1,
          },
          type: "ADD_SAMPLE",
        });
      });

      // Start undo but don't await
      act(() => {
        result.current.undo();
      });

      expect(result.current.isUndoing).toBe(true);

      // Try to undo again while already undoing - should be ignored
      await act(async () => {
        await result.current.undo();
      });

      // Should only be called once
      expect(mockElectronAPI.deleteSampleFromSlot).toHaveBeenCalledTimes(1);
    });

    it("should not redo when already redoing", async () => {
      const { result } = renderHook(() => useUndoRedo("test-kit"));

      act(() => {
        result.current.addAction({
          data: {
            addedSample: {
              filename: "test.wav",
              is_stereo: false,
              source_path: "/path/to/test.wav",
            },
            slot: 0,
            voice: 1,
          },
          type: "ADD_SAMPLE",
        });
      });

      await act(async () => {
        await result.current.undo();
      });

      // Clear mocks to count fresh calls
      vi.clearAllMocks();

      // Start redo but don't await
      act(() => {
        result.current.redo();
      });

      expect(result.current.isRedoing).toBe(true);

      // Try to redo again while already redoing - should be ignored
      await act(async () => {
        await result.current.redo();
      });

      // Should only be called once
      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledTimes(1);
    });

    it("should emit refresh event after successful operations", async () => {
      const { result } = renderHook(() => useUndoRedo("test-kit"));

      const eventListener = vi.fn();
      document.addEventListener("romper:refresh-samples", eventListener);

      act(() => {
        result.current.addAction({
          data: {
            addedSample: {
              filename: "test.wav",
              is_stereo: false,
              source_path: "/path/to/test.wav",
            },
            slot: 0,
            voice: 1,
          },
          type: "ADD_SAMPLE",
        });
      });

      await act(async () => {
        await result.current.undo();
      });

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { kitName: "test-kit" },
        }),
      );

      document.removeEventListener("romper:refresh-samples", eventListener);
    });
  });
});
