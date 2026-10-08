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
  restoreKitVoices: vi.fn(),
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

describe("[UC-26] useUndoRedo - Basic Tests", () => {
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

  it("[UC-06] undo changes nothing in another store's kit of the same name (#568)", async () => {
    const { rerender, result } = renderHook(
      ({ storePath }) => useUndoRedo("A0", undefined, storePath),
      { initialProps: { storePath: "/stores/one" } },
    );
    act(() => {
      result.current.addAction({
        data: {
          addedSample: {
            filename: "test.wav",
            source_path: "/stores/one/test.wav",
          },
          slot: 0,
          voice: 1,
        },
        type: "ADD_SAMPLE",
      });
    });

    rerender({ storePath: "/stores/two" });
    await act(async () => {
      await result.current.undo();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    for (const call of Object.values(mockElectronAPI)) {
      expect(call).not.toHaveBeenCalled();
    }
  });

  describe("[Q-02] Move undo restores the voice exactly", () => {
    it("move 1.12→1.9 then undo puts all twelve rows back, gain included, in one call", async () => {
      // Voice 1 before the move: full rows, as undo keeps them (RE-86)
      const voicesBefore = [
        {
          samples: Array.from({ length: 12 }, (_, slot) => ({
            filename: `sample${slot + 1}.wav`,
            gain_db: -slot,
            slot_number: slot,
            source_path: `/path/${slot + 1}.wav`,
            wav_bit_depth: 16,
            wav_bitrate: 705600,
            wav_channels: 1,
            wav_sample_rate: 44100,
          })),
          voice: 1,
        },
      ];
      const { result } = renderHook(() => useUndoRedo("test-kit"));

      act(() => {
        result.current.addAction({
          data: {
            affectedSamples: [],
            fromSlot: 11,
            fromVoice: 1,
            movedSample: {
              filename: "sample12.wav",
              source_path: "/path/12.wav",
            },
            toSlot: 8,
            toVoice: 1,
            voicesBefore,
          },
          type: "MOVE_SAMPLE",
        });
      });

      await act(async () => {
        await result.current.undo();
      });

      expect(mockElectronAPI.restoreKitVoices).toHaveBeenCalledTimes(1);
      expect(mockElectronAPI.restoreKitVoices).toHaveBeenCalledWith(
        "test-kit",
        voicesBefore,
      );
      expect(mockElectronAPI.addSampleToSlot).not.toHaveBeenCalled();
      expect(
        mockElectronAPI.deleteSampleFromSlotWithoutReindexing,
      ).not.toHaveBeenCalled();
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
