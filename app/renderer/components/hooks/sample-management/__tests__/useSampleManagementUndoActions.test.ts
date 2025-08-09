import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSampleManagementUndoActions } from "../useSampleManagementUndoActions";

// Mock window.electronAPI
const mockElectronAPI = {
  getAllSamplesForKit: vi.fn(),
};

// Ensure window is properly typed and electronAPI is available
(window as any).electronAPI = mockElectronAPI;

describe("useSampleManagementUndoActions", () => {
  const mockOptions = {
    kitName: "Test Kit",
    skipUndoRecording: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    // Ensure electronAPI is always available
    (window as any).electronAPI = mockElectronAPI;
  });

  describe("getOldSampleForUndo", () => {
    it("should return old sample when found", async () => {
      const mockSamples = [
        {
          filename: "test.wav",
          slot_number: 1,
          source_path: "/path/to/test.wav",
          voice_number: 1,
        },
        {
          filename: "other.wav",
          slot_number: 2,
          source_path: "/path/to/other.wav",
          voice_number: 1,
        },
      ];

      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        data: mockSamples,
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const oldSample = await result.current.getOldSampleForUndo(1, 0); // slotIndex 0 = slot_number 1

      expect(mockElectronAPI.getAllSamplesForKit).toHaveBeenCalledWith(
        "Test Kit",
      );
      expect(oldSample).toEqual(mockSamples[0]);
    });

    it("should return null when sample not found", async () => {
      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        data: [],
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const oldSample = await result.current.getOldSampleForUndo(1, 0);

      expect(oldSample).toBeNull();
    });

    it("should return null when skipUndoRecording is true", async () => {
      const optionsWithSkip = { ...mockOptions, skipUndoRecording: true };
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(optionsWithSkip),
      );

      const oldSample = await result.current.getOldSampleForUndo(1, 0);

      expect(mockElectronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
      expect(oldSample).toBeNull();
    });

    it("should handle API failure gracefully", async () => {
      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        error: "API error",
        success: false,
      });

      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const oldSample = await result.current.getOldSampleForUndo(1, 0);

      expect(oldSample).toBeNull();
    });
  });

  describe("getSampleToDeleteForUndo", () => {
    it("should return sample to delete when found", async () => {
      const mockSamples = [
        {
          filename: "delete-me.wav",
          slot_number: 2,
          source_path: "/path/to/delete-me.wav",
          voice_number: 2,
        },
      ];

      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        data: mockSamples,
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const sampleToDelete = await result.current.getSampleToDeleteForUndo(
        2,
        1,
      ); // slotIndex 1 = slot_number 2

      expect(sampleToDelete).toEqual(mockSamples[0]);
    });

    it("should return null when skipUndoRecording is true", async () => {
      const optionsWithSkip = { ...mockOptions, skipUndoRecording: true };
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(optionsWithSkip),
      );

      const sampleToDelete = await result.current.getSampleToDeleteForUndo(
        1,
        0,
      );

      expect(mockElectronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
      expect(sampleToDelete).toBeNull();
    });

    it("should handle exceptions gracefully", async () => {
      mockElectronAPI.getAllSamplesForKit.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const sampleToDelete = await result.current.getSampleToDeleteForUndo(
        1,
        0,
      );

      expect(sampleToDelete).toBeNull();
    });
  });

  describe("createAddSampleAction", () => {
    it("should create ADD_SAMPLE action with correct data", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const action = result.current.createAddSampleAction(
        1,
        0,
        "/path/to/sample.wav",
        { forceMono: true },
      );

      expect(action.type).toBe("ADD_SAMPLE");
      expect(action.data).toEqual({
        addedSample: {
          filename: "sample.wav",
          is_stereo: false,
          source_path: "/path/to/sample.wav",
        },
        slot: 0,
        voice: 1,
      });
      expect(action.id).toBeDefined();
      expect(action.timestamp).toBeDefined();
    });

    it("should create ADD_SAMPLE action without options", () => {
      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const action = result.current.createAddSampleAction(
        2,
        1,
        "/path/to/sample.wav",
      );

      expect(action.data).toEqual({
        addedSample: {
          filename: "sample.wav",
          is_stereo: false,
          source_path: "/path/to/sample.wav",
        },
        slot: 1,
        voice: 2,
      });
    });
  });

  describe("createReplaceSampleAction", () => {
    it("should create REPLACE_SAMPLE action with correct data", () => {
      const mockOldSample = {
        filename: "old.wav",
        source_path: "/path/to/old.wav",
      };

      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const action = result.current.createReplaceSampleAction(
        1,
        0,
        mockOldSample,
        "/path/to/new.wav",
        { forceStereo: true },
      );

      expect(action.type).toBe("REPLACE_SAMPLE");
      expect(action.data).toEqual({
        newSample: {
          filename: "new.wav",
          is_stereo: true,
          source_path: "/path/to/new.wav",
        },
        oldSample: {
          filename: "old.wav",
          is_stereo: undefined,
          source_path: "/path/to/old.wav",
        },
        slot: 0,
        voice: 1,
      });
    });
  });

  describe("createCompactSlotsAction", () => {
    it("should create COMPACT_SLOTS action with correct data", () => {
      const mockDeletedSample = {
        filename: "deleted.wav",
        is_stereo: undefined,
        source_path: "/path/to/deleted.wav",
      };

      const mockResult = {
        data: {
          affectedSamples: [
            {
              filename: "affected.wav",
              is_stereo: false,
              slot_number: 2,
              source_path: "/path/to/affected.wav",
              voice_number: 1,
            },
          ],
        },
        success: true,
      };

      const { result } = renderHook(() =>
        useSampleManagementUndoActions(mockOptions),
      );

      const action = result.current.createCompactSlotsAction(
        1,
        0,
        mockDeletedSample,
        mockResult,
      );

      expect(action.type).toBe("COMPACT_SLOTS");
      expect(action.data).toEqual({
        affectedSamples: [
          {
            newSlot: 1, // slot_number - 1
            oldSlot: 2, // original slot_number
            sample: {
              filename: "affected.wav",
              is_stereo: false,
              source_path: "/path/to/affected.wav",
            },
            voice: 1,
          },
        ],
        deletedSample: {
          filename: "deleted.wav",
          is_stereo: undefined,
          source_path: "/path/to/deleted.wav",
        },
        deletedSlot: 0,
        voice: 1,
      });
    });
  });
});
