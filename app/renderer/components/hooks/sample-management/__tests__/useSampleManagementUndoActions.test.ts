import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Sample } from "@romper/shared/db/schema.js";
import { createActionId } from "@romper/shared/undoTypes";

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
    id: 1,
    kit_name: "TestKit",
    voice_number: 1,
    slot_number: 0,
    filename: "test.wav",
    is_stereo: false,
    source_path: "/path/to/test.wav",
    wav_bitrate: null,
    wav_sample_rate: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createActionId).mockReturnValue("test-action-id");
    // Use centralized mocks - they should be accessible via window.electronAPI
    if (window.electronAPI?.getAllSamplesForKit) {
      vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
        success: true,
        data: [mockSample],
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
        'createAddSampleAction',
        'createReindexSamplesAction', 
        'createSameKitMoveAction',
        'createCrossKitMoveAction',
        'createReplaceSampleAction',
        'getOldSampleForUndo',
        'getSampleToDeleteForUndo',
      ];

      expectedMethods.forEach(method => {
        expect(result.current).toHaveProperty(method);
        expect(typeof result.current[method]).toBe('function');
      });
    });
  });

  describe("getOldSampleForUndo", () => {
    it("should return null when skipUndoRecording is true", async () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions({ ...mockOptions, skipUndoRecording: true }),
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
      expect(window.electronAPI?.getAllSamplesForKit).toHaveBeenCalledWith("TestKit");
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
          success: false,
          data: null,
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
        useSampleManagementUndoActions({ ...mockOptions, skipUndoRecording: true }),
      );

      const sampleToDelete = await result.current.getSampleToDeleteForUndo(1, 0);
      expect(sampleToDelete).toBe(null);
      expect(window.electronAPI?.getAllSamplesForKit).not.toHaveBeenCalled();
    });

    it("should return sample when found", async () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const sampleToDelete = await result.current.getSampleToDeleteForUndo(1, 0);
      expect(sampleToDelete).toEqual(mockSample);
      expect(window.electronAPI?.getAllSamplesForKit).toHaveBeenCalledWith("TestKit");
    });

    it("should handle API errors gracefully", async () => {
      if (window.electronAPI?.getAllSamplesForKit) {
        vi.mocked(window.electronAPI.getAllSamplesForKit).mockRejectedValue(new Error("API Error"));
      }
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const sampleToDelete = await result.current.getSampleToDeleteForUndo(1, 0);
      expect(sampleToDelete).toBe(null);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[SampleManagement] Failed to get sample data for undo recording:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("createAddSampleAction", () => {
    it("should create add sample action with correct structure", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const action = result.current.createAddSampleAction(1, 0, "/path/to/new.wav");

      expect(action).toEqual({
        type: "ADD_SAMPLE",
        id: "test-action-id",
        timestamp: expect.any(Date),
        description: "Add sample to voice 1, slot 1",
        data: {
          voice: 1,
          slot: 0,
          addedSample: {
            filename: "new.wav",
            is_stereo: false,
            source_path: "/path/to/new.wav",
          },
        },
      });
    });

    it("should handle force stereo option", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const action = result.current.createAddSampleAction(1, 0, "/path/to/stereo.wav", { forceStereo: true });

      expect(action.data.addedSample.is_stereo).toBe(true);
    });
  });

  describe("createReplaceSampleAction", () => {
    it("should create replace sample action with correct structure", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const action = result.current.createReplaceSampleAction(1, 0, mockSample, "/path/to/new.wav");

      expect(action).toEqual({
        type: "REPLACE_SAMPLE",
        id: "test-action-id",
        timestamp: expect.any(Date),
        description: "Replace sample in voice 1, slot 1",
        data: {
          voice: 1,
          slot: 0,
          oldSample: {
            filename: "test.wav",
            is_stereo: false,
            source_path: "/path/to/test.wav",
          },
          newSample: {
            filename: "new.wav",
            is_stereo: false,
            source_path: "/path/to/new.wav",
          },
        },
      });
    });
  });

  describe("createReindexSamplesAction", () => {
    it("should create reindex samples action with correct structure", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const reindexResult = {
        success: true,
        data: {
          affectedSamples: [mockSample],
        },
      };

      const action = result.current.createReindexSamplesAction(1, 0, mockSample, reindexResult);

      expect(action).toEqual({
        type: "REINDEX_SAMPLES",
        id: "test-action-id",
        timestamp: expect.any(Date),
        description: "Delete sample from voice 1, slot 1 (with reindexing)",
        data: {
          voice: 1,
          deletedSlot: 0,
          deletedSample: {
            filename: "test.wav",
            is_stereo: false,
            source_path: "/path/to/test.wav",
          },
          affectedSamples: [{
            voice: 1,
            oldSlot: 0,
            newSlot: -1,
            sample: {
              filename: "test.wav",
              is_stereo: false,
              source_path: "/path/to/test.wav",
            },
          }],
        },
      });
    });
  });

  describe("createSameKitMoveAction", () => {
    it("should create same kit move action with correct structure", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const moveResult = {
        success: true,
        data: {
          movedSample: mockSample,
          affectedSamples: [mockSample],
          replacedSample: undefined,
        },
      };

      const stateSnapshot = [{
        voice: 1,
        slot: 0,
        sample: {
          filename: "test.wav",
          is_stereo: false,
          source_path: "/path/to/test.wav",
        },
      }];

      const action = result.current.createSameKitMoveAction({
        fromVoice: 1,
        fromSlot: 0,
        toVoice: 2,
        toSlot: 1,
        result: moveResult,
        stateSnapshot,
      });

      expect(action).toEqual({
        type: "MOVE_SAMPLE",
        id: "test-action-id",
        timestamp: expect.any(Date),
        description: "Move sample from voice 1, slot 1 to voice 2, slot 2",
        data: {
          fromVoice: 1,
          fromSlot: 0,
          toVoice: 2,
          toSlot: 1,
          movedSample: {
            filename: "test.wav",
            is_stereo: false,
            source_path: "/path/to/test.wav",
          },
          replacedSample: undefined,
          stateSnapshot,
          affectedSamples: [{
            voice: 1,
            oldSlot: 0,
            newSlot: 0,
            sample: {
              filename: "test.wav",
              is_stereo: false,
              source_path: "/path/to/test.wav",
            },
          }],
        },
      });
    });
  });

  describe("createCrossKitMoveAction", () => {
    it("should create cross kit move action with correct structure", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const moveResult = {
        success: true,
        data: {
          movedSample: { ...mockSample, original_slot_number: 0 },
          affectedSamples: [{ ...mockSample, original_slot_number: 0 }],
          replacedSample: undefined,
        },
      };

      const action = result.current.createCrossKitMoveAction({
        fromVoice: 1,
        fromSlot: 0,
        toVoice: 2,
        toSlot: 1,
        targetKit: "TargetKit",
        result: moveResult,
      });

      expect(action).toEqual({
        type: "MOVE_SAMPLE_BETWEEN_KITS",
        id: "test-action-id",
        timestamp: expect.any(Date),
        description: "Move sample from TestKit voice 1, slot 1 to TargetKit voice 2, slot 2",
        data: {
          fromKit: "TestKit",
          fromVoice: 1,
          fromSlot: 0,
          toKit: "TargetKit",
          toVoice: 2,
          toSlot: 1,
          mode: "insert",
          movedSample: {
            filename: "test.wav",
            is_stereo: false,
            source_path: "/path/to/test.wav",
          },
          replacedSample: undefined,
          affectedSamples: [{
            voice: 1,
            oldSlot: 0,
            newSlot: 0,
            sample: {
              filename: "test.wav",
              is_stereo: false,
              source_path: "/path/to/test.wav",
            },
          }],
        },
      });
    });
  });
});
