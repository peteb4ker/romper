import type { Sample } from "@romper/shared/db/schema.js";

import { createActionId } from "@romper/shared/undoTypes";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSampleManagementUndoActions } from "../useSampleManagementUndoActions";

// Mock the createActionId function
vi.mock("@romper/shared/undoTypes", () => ({
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
    id: 1,
    is_stereo: false,
    kit_name: "TestKit",
    slot_number: 0,
    source_path: "/path/to/test.wav",
    voice_number: 1,
    wav_bitrate: null,
    wav_sample_rate: null,
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

      const expectedMethods = [
        "createAddSampleAction",
        "createReindexSamplesAction",
        "createSameKitMoveAction",
        "createCrossKitMoveAction",
        "createReplaceSampleAction",
        "getOldSampleForUndo",
        "getSampleToDeleteForUndo",
      ];

      expectedMethods.forEach((method) => {
        expect(result.current).toHaveProperty(method);
        expect(typeof result.current[method]).toBe("function");
      });
    });
  });

  describe("getOldSampleForUndo", () => {
    it("should return null when skipUndoRecording is true", async () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions({
          ...mockOptions,
          skipUndoRecording: true,
        }),
      );

      const oldSample = await result.current.getOldSampleForUndo(1, 0);
      expect(oldSample).toBe(null);
      expect(window.electronAPI?.getAllSamplesForKit).not.toHaveBeenCalled();
    });

    it("should return sample when found", async () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const oldSample = await result.current.getOldSampleForUndo(1, 0);
      expect(oldSample).toEqual(mockSample);
      expect(window.electronAPI?.getAllSamplesForKit).toHaveBeenCalledWith(
        "TestKit",
      );
    });

    it("should return null when sample not found", async () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const oldSample = await result.current.getOldSampleForUndo(2, 5);
      expect(oldSample).toBe(null);
    });

    it("should return null when API call fails", async () => {
      if (window.electronAPI?.getAllSamplesForKit) {
        vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
          data: null,
          success: false,
        });
      }

      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const oldSample = await result.current.getOldSampleForUndo(1, 0);
      expect(oldSample).toBe(null);
    });
  });

  describe("getSampleToDeleteForUndo", () => {
    it("should return null when skipUndoRecording is true", async () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions({
          ...mockOptions,
          skipUndoRecording: true,
        }),
      );

      const sampleToDelete = await result.current.getSampleToDeleteForUndo(
        1,
        0,
      );
      expect(sampleToDelete).toBe(null);
      expect(window.electronAPI?.getAllSamplesForKit).not.toHaveBeenCalled();
    });

    it("should return sample when found", async () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const sampleToDelete = await result.current.getSampleToDeleteForUndo(
        1,
        0,
      );
      expect(sampleToDelete).toEqual(mockSample);
      expect(window.electronAPI?.getAllSamplesForKit).toHaveBeenCalledWith(
        "TestKit",
      );
    });

    it("should handle API errors gracefully", async () => {
      if (window.electronAPI?.getAllSamplesForKit) {
        vi.mocked(window.electronAPI.getAllSamplesForKit).mockRejectedValue(
          new Error("API Error"),
        );
      }
      const consoleSpy = vi.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const sampleToDelete = await result.current.getSampleToDeleteForUndo(
        1,
        0,
      );
      expect(sampleToDelete).toBe(null);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[SampleManagement] Failed to get sample data for undo recording:",
        expect.any(Error),
      );

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
            is_stereo: false,
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

    it("should handle force stereo option", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const action = result.current.createAddSampleAction(
        1,
        0,
        "/path/to/stereo.wav",
        { forceStereo: true },
      );

      expect(action.data.addedSample.is_stereo).toBe(true);
    });
  });

  describe("createReplaceSampleAction", () => {
    it("should create replace sample action with correct structure", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const action = result.current.createReplaceSampleAction(
        1,
        0,
        mockSample,
        "/path/to/new.wav",
      );

      expect(action).toEqual({
        data: {
          newSample: {
            filename: "new.wav",
            is_stereo: false,
            source_path: "/path/to/new.wav",
          },
          oldSample: {
            filename: "test.wav",
            is_stereo: false,
            source_path: "/path/to/test.wav",
          },
          slot: 0,
          voice: 1,
        },
        description: "Replace sample in voice 1, slot 1",
        id: "test-action-id",
        timestamp: expect.any(Date),
        type: "REPLACE_SAMPLE",
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
      );

      expect(action).toEqual({
        data: {
          affectedSamples: [
            {
              newSlot: -1,
              oldSlot: 0,
              sample: {
                filename: "test.wav",
                is_stereo: false,
                source_path: "/path/to/test.wav",
              },
              voice: 1,
            },
          ],
          deletedSample: {
            filename: "test.wav",
            is_stereo: false,
            source_path: "/path/to/test.wav",
          },
          deletedSlot: 0,
          voice: 1,
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

      const stateSnapshot = [
        {
          sample: {
            filename: "test.wav",
            is_stereo: false,
            source_path: "/path/to/test.wav",
          },
          slot: 0,
          voice: 1,
        },
      ];

      const action = result.current.createSameKitMoveAction({
        fromSlot: 0,
        fromVoice: 1,
        result: moveResult,
        stateSnapshot,
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
                is_stereo: false,
                source_path: "/path/to/test.wav",
              },
              voice: 1,
            },
          ],
          fromSlot: 0,
          fromVoice: 1,
          movedSample: {
            filename: "test.wav",
            is_stereo: false,
            source_path: "/path/to/test.wav",
          },
          replacedSample: undefined,
          stateSnapshot,
          toSlot: 1,
          toVoice: 2,
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
                is_stereo: false,
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
            is_stereo: false,
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
