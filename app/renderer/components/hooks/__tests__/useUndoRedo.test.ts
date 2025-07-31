import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUndoRedo } from "../useUndoRedo";

// Mock electron API
const mockElectronAPI = {
  addSampleToSlot: vi.fn(),
  deleteSampleFromSlot: vi.fn(),
  deleteSampleFromSlotWithoutCompaction: vi.fn(),
  getAllSamplesForKit: vi.fn(),
};

// Setup window.electronAPI mock
beforeEach(() => {
  vi.clearAllMocks();
  (window as any).electronAPI = mockElectronAPI;

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
        type: "ADD_SAMPLE",
        data: {
          voice: 1,
          slot: 0,
          addedSample: {
            filename: "test.wav",
            source_path: "/path/to/test.wav",
            is_stereo: false,
          },
        },
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
        type: "ADD_SAMPLE",
        data: {
          voice: 1,
          slot: 2,
          addedSample: {
            filename: "test.wav",
            source_path: "/path/to/test.wav",
            is_stereo: false,
          },
        },
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
    const { result, rerender } = renderHook(
      ({ kitName }) => useUndoRedo(kitName),
      {
        initialProps: { kitName: "kit1" },
      },
    );

    // Add some actions
    act(() => {
      result.current.addAction({
        type: "ADD_SAMPLE",
        data: {
          voice: 1,
          slot: 0,
          addedSample: {
            filename: "test.wav",
            source_path: "/path/to/test.wav",
            is_stereo: false,
          },
        },
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
          voice: 1,
          slot: 1,
          sample: {
            filename: "sample1.wav",
            source_path: "/path/1.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 2,
          sample: {
            filename: "sample2.wav",
            source_path: "/path/2.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 3,
          sample: {
            filename: "sample3.wav",
            source_path: "/path/3.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 4,
          sample: {
            filename: "sample4.wav",
            source_path: "/path/4.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 5,
          sample: {
            filename: "sample5.wav",
            source_path: "/path/5.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 6,
          sample: {
            filename: "sample6.wav",
            source_path: "/path/6.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 7,
          sample: {
            filename: "sample7.wav",
            source_path: "/path/7.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 8,
          sample: {
            filename: "sample8.wav",
            source_path: "/path/8.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 9,
          sample: {
            filename: "sample9.wav",
            source_path: "/path/9.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 10,
          sample: {
            filename: "sample10.wav",
            source_path: "/path/10.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 11,
          sample: {
            filename: "sample11.wav",
            source_path: "/path/11.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 12,
          sample: {
            filename: "sample12.wav",
            source_path: "/path/12.wav",
            is_stereo: false,
          },
        },
      ];

      // Simulate the current state AFTER the move 1.12→1.9
      // sample12 moved to slot 9, samples 9-11 shifted right
      const currentStateAfterMove = [
        {
          voice_number: 1,
          slot_number: 1,
          filename: "sample1.wav",
          source_path: "/path/1.wav",
          is_stereo: false,
        },
        {
          voice_number: 1,
          slot_number: 2,
          filename: "sample2.wav",
          source_path: "/path/2.wav",
          is_stereo: false,
        },
        {
          voice_number: 1,
          slot_number: 3,
          filename: "sample3.wav",
          source_path: "/path/3.wav",
          is_stereo: false,
        },
        {
          voice_number: 1,
          slot_number: 4,
          filename: "sample4.wav",
          source_path: "/path/4.wav",
          is_stereo: false,
        },
        {
          voice_number: 1,
          slot_number: 5,
          filename: "sample5.wav",
          source_path: "/path/5.wav",
          is_stereo: false,
        },
        {
          voice_number: 1,
          slot_number: 6,
          filename: "sample6.wav",
          source_path: "/path/6.wav",
          is_stereo: false,
        },
        {
          voice_number: 1,
          slot_number: 7,
          filename: "sample7.wav",
          source_path: "/path/7.wav",
          is_stereo: false,
        },
        {
          voice_number: 1,
          slot_number: 8,
          filename: "sample8.wav",
          source_path: "/path/8.wav",
          is_stereo: false,
        },
        {
          voice_number: 1,
          slot_number: 9,
          filename: "sample12.wav",
          source_path: "/path/12.wav",
          is_stereo: false,
        }, // moved here
        {
          voice_number: 1,
          slot_number: 10,
          filename: "sample9.wav",
          source_path: "/path/9.wav",
          is_stereo: false,
        }, // shifted
        {
          voice_number: 1,
          slot_number: 11,
          filename: "sample10.wav",
          source_path: "/path/10.wav",
          is_stereo: false,
        }, // shifted
        {
          voice_number: 1,
          slot_number: 12,
          filename: "sample11.wav",
          source_path: "/path/11.wav",
          is_stereo: false,
        }, // shifted
      ];

      // Mock the getAllSamplesForKit call that happens during undo
      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        success: true,
        data: currentStateAfterMove,
      });

      // Mock successful delete and add operations
      mockElectronAPI.deleteSampleFromSlotWithoutCompaction.mockResolvedValue({
        success: true,
        data: { deletedSamples: [] },
      });

      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        success: true,
        data: { sampleId: 123 },
      });

      // Create the move action that would be recorded
      const moveAction = {
        id: "test-action",
        type: "MOVE_SAMPLE" as const,
        timestamp: new Date(),
        description: "Move sample from voice 1, slot 12 to voice 1, slot 9",
        data: {
          fromVoice: 1,
          fromSlot: 11, // 0-based
          toVoice: 1,
          toSlot: 8, // 0-based
          mode: "insert" as const,
          movedSample: {
            filename: "sample12.wav",
            source_path: "/path/12.wav",
            is_stereo: false,
          },
          affectedSamples: [
            {
              voice: 1,
              oldSlot: 9,
              newSlot: 10,
              sample: {
                filename: "sample9.wav",
                source_path: "/path/9.wav",
                is_stereo: false,
              },
            },
            {
              voice: 1,
              oldSlot: 10,
              newSlot: 11,
              sample: {
                filename: "sample10.wav",
                source_path: "/path/10.wav",
                is_stereo: false,
              },
            },
            {
              voice: 1,
              oldSlot: 11,
              newSlot: 12,
              sample: {
                filename: "sample11.wav",
                source_path: "/path/11.wav",
                is_stereo: false,
              },
            },
          ],
          stateSnapshot,
        },
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
        mockElectronAPI.deleteSampleFromSlotWithoutCompaction.mock.calls;
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
            call[2] === snapshotSample.slot - 1 && // slot matches (convert to 0-based)
            call[3] === snapshotSample.sample.source_path, // source_path matches
        );

        expect(correspondingAddCall).toBeDefined(
          `Sample ${snapshotSample.sample.filename} should be restored to voice ${snapshotSample.voice}, slot ${snapshotSample.slot}`,
        );
      });

      expect(result.current.error).toBe(null);
    });
  });
});
