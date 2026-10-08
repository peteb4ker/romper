import type { Sample } from "@romper/shared/db/schema.js";
import type { VoiceSnapshot } from "@romper/shared/undoTypes";

import { createActionId } from "@romper/shared/undoTypes";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSampleManagementUndoActions } from "../useSampleManagementUndoActions";

// Mock the createActionId function
vi.mock("@romper/shared/undoTypes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@romper/shared/undoTypes")>()),
  createActionId: vi.fn(),
}));

// Use centralized mocks from vitest.setup.ts

describe("useSampleManagementUndoActions", () => {
  const mockOptions = {
    kitName: "TestKit",
    skipUndoRecording: false,
  };

  const mockSample: Sample = {
    filename: "test.wav",
    gain_db: -6,
    id: 1,
    kit_name: "TestKit",
    slot_number: 0,
    source_path: "/path/to/test.wav",
    source_status: null,
    voice_number: 1,
    wav_bit_depth: 24,
    wav_bitrate: null,
    wav_channels: 2,
    wav_sample_rate: null,
  };
  /** mockSample's voice as undo snapshots it: the full row, gain included */
  const voiceOne: VoiceSnapshot = {
    samples: [
      {
        filename: "test.wav",
        gain_db: -6,
        slot_number: 0,
        source_path: "/path/to/test.wav",
        source_status: null,
        wav_bit_depth: 24,
        wav_bitrate: null,
        wav_channels: 2,
        wav_sample_rate: null,
      },
    ],
    voice: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createActionId).mockReturnValue("test-action-id");
    // Use centralized mocks - they should be accessible via window.electronAPI
    if (window.electronAPI?.getAllSamplesForKit) {
      vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
        data: [mockSample],
        success: true,
      });
    }
  });

  describe("hook initialization", () => {
    it("should initialize without error", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );
      expect(result.current).toBeDefined();
    });

    it("should provide all expected action creator functions", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const expectedMethods: (keyof typeof result.current)[] = [
        "createAddSampleAction",
        "createReindexSamplesAction",
        "createSameKitMoveAction",
        "createCrossKitMoveAction",
        "snapshotForUndo",
      ];

      expectedMethods.forEach((method) => {
        expect(result.current).toHaveProperty(method);
        expect(typeof result.current[method]).toBe("function");
      });
    });
  });

  describe("[Q-02] snapshotForUndo", () => {
    it("returns null when skipUndoRecording is true", async () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions({
          ...mockOptions,
          skipUndoRecording: true,
        }),
      );

      expect(await result.current.snapshotForUndo(1, 0)).toBeNull();
      expect(window.electronAPI?.getAllSamplesForKit).not.toHaveBeenCalled();
    });

    it("returns the slot's row and the voice's full rows", async () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      expect(await result.current.snapshotForUndo(1, 0)).toEqual({
        sample: mockSample,
        voicesBefore: [voiceOne],
      });
    });

    it("snapshots every voice asked for, empty ones included", async () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const snapshot = await result.current.snapshotForUndo(1, 0, [2, 1]);

      expect(snapshot?.voicesBefore).toEqual([
        voiceOne,
        { samples: [], voice: 2 },
      ]);
    });

    it("returns no sample for an empty slot", async () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      expect((await result.current.snapshotForUndo(1, 5))?.sample).toBeNull();
    });

    it("returns null when the kit can't be read", async () => {
      vi.mocked(window.electronAPI!.getAllSamplesForKit).mockResolvedValue({
        error: "API error",
        success: false,
      });
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      expect(await result.current.snapshotForUndo(1, 0)).toBeNull();
    });

    it("returns null when the call throws", async () => {
      vi.mocked(window.electronAPI!.getAllSamplesForKit).mockRejectedValue(
        new Error("API error"),
      );
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      expect(await result.current.snapshotForUndo(1, 0)).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe("createAddSampleAction", () => {
    it("should create add sample action with correct structure", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const action = result.current.createAddSampleAction(
        1,
        0,
        "/path/to/new.wav",
      );

      expect(action).toEqual({
        data: {
          addedSample: {
            filename: "new.wav",
            source_path: "/path/to/new.wav",
          },
          slot: 0,
          voice: 1,
        },
        description: "Add sample to voice 1, slot 1",
        id: "test-action-id",
        timestamp: expect.any(Date),
        type: "ADD_SAMPLE",
      });
    });
  });

  describe("createReindexSamplesAction", () => {
    it("should create reindex samples action with correct structure", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const reindexResult = {
        data: {
          affectedSamples: [mockSample],
        },
        success: true,
      };

      const action = result.current.createReindexSamplesAction(
        1,
        0,
        mockSample,
        reindexResult,
        [voiceOne],
      );

      expect(action).toEqual({
        data: {
          affectedSamples: [
            {
              newSlot: -1,
              oldSlot: 0,
              sample: {
                filename: "test.wav",
                source_path: "/path/to/test.wav",
              },
              voice: 1,
            },
          ],
          deletedSample: {
            filename: "test.wav",
            source_path: "/path/to/test.wav",
          },
          deletedSlot: 0,
          voice: 1,
          voicesBefore: [voiceOne],
        },
        description: "Delete sample from voice 1, slot 1 (with reindexing)",
        id: "test-action-id",
        timestamp: expect.any(Date),
        type: "REINDEX_SAMPLES",
      });
    });
  });

  describe("createSameKitMoveAction", () => {
    it("should create same kit move action with correct structure", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const moveResult = {
        data: {
          affectedSamples: [mockSample],
          movedSample: mockSample,
          replacedSample: undefined,
        },
        success: true,
      };

      const voicesBefore = [voiceOne, { samples: [], voice: 2 }];

      const action = result.current.createSameKitMoveAction({
        fromSlot: 0,
        fromVoice: 1,
        result: moveResult,
        toSlot: 1,
        toVoice: 2,
        voicesBefore,
      });

      expect(action).toEqual({
        data: {
          affectedSamples: [
            {
              newSlot: 0,
              oldSlot: 0,
              sample: {
                filename: "test.wav",
                source_path: "/path/to/test.wav",
              },
              voice: 1,
            },
          ],
          fromSlot: 0,
          fromVoice: 1,
          movedSample: {
            filename: "test.wav",
            source_path: "/path/to/test.wav",
          },
          replacedSample: undefined,
          toSlot: 1,
          toVoice: 2,
          voicesBefore,
        },
        description: "Move sample from voice 1, slot 1 to voice 2, slot 2",
        id: "test-action-id",
        timestamp: expect.any(Date),
        type: "MOVE_SAMPLE",
      });
    });
  });

  describe("createCrossKitMoveAction", () => {
    it("should create cross kit move action with correct structure", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const moveResult = {
        data: {
          affectedSamples: [{ ...mockSample, original_slot_number: 0 }],
          movedSample: { ...mockSample, original_slot_number: 0 },
          replacedSample: undefined,
        },
        success: true,
      };

      const action = result.current.createCrossKitMoveAction({
        fromSlot: 0,
        fromVoice: 1,
        result: moveResult,
        targetKit: "TargetKit",
        toSlot: 1,
        toVoice: 2,
      });

      expect(action).toEqual({
        data: {
          affectedSamples: [
            {
              newSlot: 0,
              oldSlot: 0,
              sample: {
                filename: "test.wav",
                source_path: "/path/to/test.wav",
              },
              voice: 1,
            },
          ],
          fromKit: "TestKit",
          fromSlot: 0,
          fromVoice: 1,
          mode: "insert",
          movedSample: {
            filename: "test.wav",
            source_path: "/path/to/test.wav",
          },
          replacedSample: undefined,
          toKit: "TargetKit",
          toSlot: 1,
          toVoice: 2,
        },
        description:
          "Move sample from TestKit voice 1, slot 1 to TargetKit voice 2, slot 2",
        id: "test-action-id",
        timestamp: expect.any(Date),
        type: "MOVE_SAMPLE_BETWEEN_KITS",
      });
    });
  });
});
