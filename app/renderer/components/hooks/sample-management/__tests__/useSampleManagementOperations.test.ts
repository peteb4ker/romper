import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSampleManagementOperations } from "../useSampleManagementOperations";

// Mock dependencies
vi.mock("../useSampleManagementUndoActions", () => ({
  useSampleManagementUndoActions: vi.fn(() => ({
    createAddSampleAction: vi.fn(() => ({ data: {}, type: "ADD_SAMPLE" })),
    createReindexSamplesAction: vi.fn(() => ({
      data: {},
      type: "REINDEX_SAMPLES",
    })),
    createReplaceSampleAction: vi.fn(() => ({
      data: {},
      type: "REPLACE_SAMPLE",
    })),
    getOldSampleForUndo: vi.fn(),
    getSampleToDeleteForUndo: vi.fn(),
  })),
}));

import * as undoActions from "../useSampleManagementUndoActions";
const mockUseSampleManagementUndoActions = vi.mocked(
  undoActions.useSampleManagementUndoActions,
);

// Mock window.electronAPI
const mockElectronAPI = {
  addSampleToSlot: vi.fn(),
  deleteSampleFromSlot: vi.fn(),
  replaceSampleInSlot: vi.fn(),
};

// Ensure window is properly typed and electronAPI is available
(window as unknown).electronAPI = mockElectronAPI;

describe("useSampleManagementOperations", () => {
  const mockOptions = {
    kitName: "Test Kit",
    onAddUndoAction: vi.fn(),
    onMessage: vi.fn(),
    onSamplesChanged: vi.fn(),
    skipUndoRecording: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    // Ensure electronAPI is always available
    (window as unknown).electronAPI = mockElectronAPI;
  });

  describe("handleSampleAdd", () => {
    it("should add sample successfully", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        data: { sampleId: 123 },
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav", {
        forceMono: true,
      });

      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledWith(
        "Test Kit",
        1,
        0,
        "/path/to/sample.wav",
        { forceMono: true },
      );
      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample added to voice 1, slot 1",
        "success",
      );
      expect(mockOptions.onSamplesChanged).toHaveBeenCalled();
      expect(mockOptions.onAddUndoAction).toHaveBeenCalled();
    });

    it("should handle add sample failure", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        error: "Failed to add sample",
        success: false,
      });

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Failed to add sample",
        "error",
      );
      expect(mockOptions.onSamplesChanged).not.toHaveBeenCalled();
      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
    });

    it("should handle add sample exception", async () => {
      mockElectronAPI.addSampleToSlot.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Failed to add sample: Network error",
        "error",
      );
    });

    it("should skip undo recording when skipUndoRecording is true", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        data: { sampleId: 123 },
        success: true,
      });

      const optionsWithSkip = { ...mockOptions, skipUndoRecording: true };
      const { result } = renderHook(() =>
        useSampleManagementOperations(optionsWithSkip),
      );

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
    });

    it("should handle missing electronAPI", async () => {
      const originalAPI = (window as unknown).electronAPI;
      (window as unknown).electronAPI = undefined;

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample management not available",
        "error",
      );

      // Restore
      (window as unknown).electronAPI = originalAPI;
    });
  });

  describe("handleSampleReplace", () => {
    it("should replace sample successfully", async () => {
      const mockOldSample = {
        is_stereo: false,
        source_path: "/path/to/old.wav",
      };

      const mockUndoActions = {
        createReplaceSampleAction: vi.fn(() => ({
          data: {},
          type: "REPLACE_SAMPLE",
        })),
        getOldSampleForUndo: vi.fn().mockResolvedValue(mockOldSample),
      };

      // Mock the hook return
      mockUseSampleManagementUndoActions.mockReturnValue(mockUndoActions);

      mockElectronAPI.replaceSampleInSlot.mockResolvedValue({
        data: { sampleId: 123 },
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleReplace(1, 0, "/path/to/new.wav", {
        forceStereo: true,
      });

      expect(mockUndoActions.getOldSampleForUndo).toHaveBeenCalledWith(1, 0);
      expect(mockElectronAPI.replaceSampleInSlot).toHaveBeenCalledWith(
        "Test Kit",
        1,
        0,
        "/path/to/new.wav",
        { forceStereo: true },
      );
      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample replaced in voice 1, slot 1",
        "success",
      );
      expect(mockOptions.onSamplesChanged).toHaveBeenCalled();
      expect(mockOptions.onAddUndoAction).toHaveBeenCalled();
    });

    it("should handle replace sample failure", async () => {
      mockElectronAPI.replaceSampleInSlot.mockResolvedValue({
        error: "Replace failed",
        success: false,
      });

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleReplace(1, 0, "/path/to/new.wav");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Replace failed",
        "error",
      );
      expect(mockOptions.onSamplesChanged).not.toHaveBeenCalled();
    });

    it("should handle missing electronAPI for replace", async () => {
      const originalAPI = (window as unknown).electronAPI;
      (window as unknown).electronAPI = { addSampleToSlot: vi.fn() }; // Missing replaceSampleInSlot

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleReplace(1, 0, "/path/to/new.wav");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample management not available",
        "error",
      );

      // Restore
      (window as unknown).electronAPI = originalAPI;
    });
  });

  describe("handleSampleDelete", () => {
    it("should delete sample successfully", async () => {
      const mockSampleToDelete = {
        filename: "test.wav",
        is_stereo: true,
        source_path: "/path/to/test.wav",
      };

      const mockUndoActions = {
        createReindexSamplesAction: vi.fn(() => ({
          data: {},
          type: "REINDEX_SAMPLES",
        })),
        getSampleToDeleteForUndo: vi.fn().mockResolvedValue(mockSampleToDelete),
      };

      // Mock the hook return
      mockUseSampleManagementUndoActions.mockReturnValue(mockUndoActions);

      const mockDeleteResult = {
        data: { affectedSamples: [] },
        success: true,
      };
      mockElectronAPI.deleteSampleFromSlot.mockResolvedValue(mockDeleteResult);

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleDelete(1, 0);

      expect(mockUndoActions.getSampleToDeleteForUndo).toHaveBeenCalledWith(
        1,
        0,
      );
      expect(mockElectronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
        "Test Kit",
        1,
        0,
      );
      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample deleted from voice 1, slot 1",
        "success",
      );
      expect(mockOptions.onSamplesChanged).toHaveBeenCalled();
      expect(mockUndoActions.createReindexSamplesAction).toHaveBeenCalledWith(
        1,
        0,
        mockSampleToDelete,
        mockDeleteResult,
      );
      expect(mockOptions.onAddUndoAction).toHaveBeenCalled();
    });

    it("should handle delete sample failure", async () => {
      mockElectronAPI.deleteSampleFromSlot.mockResolvedValue({
        error: "Delete failed",
        success: false,
      });

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleDelete(1, 0);

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Delete failed",
        "error",
      );
      expect(mockOptions.onSamplesChanged).not.toHaveBeenCalled();
      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
    });

    it("should handle delete sample exception", async () => {
      const mockUndoActions = {
        getSampleToDeleteForUndo: vi
          .fn()
          .mockRejectedValue(new Error("Undo prep failed")),
      };

      // Mock the hook return
      mockUseSampleManagementUndoActions.mockReturnValue(mockUndoActions);

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleDelete(1, 0);

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Failed to delete sample: Undo prep failed",
        "error",
      );
    });

    it("should handle missing electronAPI for delete", async () => {
      const originalAPI = (window as unknown).electronAPI;
      (window as unknown).electronAPI = { addSampleToSlot: vi.fn() }; // Missing deleteSampleFromSlot

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleDelete(1, 0);

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample management not available",
        "error",
      );

      // Restore
      (window as unknown).electronAPI = originalAPI;
    });
  });
});
