import type { ReindexSamplesAction } from "@romper/shared/undoTypes";

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useSampleManagementOperations } from "../useSampleManagementOperations";

// Mock dependencies
vi.mock("../useSampleManagementUndoActions", () => ({
  useSampleManagementUndoActions: vi.fn(() => ({
    createAddSampleAction: vi.fn(() => ({ data: {}, type: "ADD_SAMPLE" })),
    createReindexSamplesAction: vi.fn(() => ({
      data: {},
      type: "REINDEX_SAMPLES",
    })),
  })),
}));

import * as undoActions from "../useSampleManagementUndoActions";
const mockUseSampleManagementUndoActions = vi.mocked(
  undoActions.useSampleManagementUndoActions,
);
type UndoActions = ReturnType<
  typeof undoActions.useSampleManagementUndoActions
>;

/** The undo hook's return, with the given action creators replaced */
const undoActionsWith = (overrides: Partial<UndoActions>): UndoActions => ({
  createAddSampleAction: vi.fn(),
  createCrossKitMoveAction: vi.fn(),
  createReindexSamplesAction: vi.fn(),
  createSameKitMoveAction: vi.fn(),
  ...overrides,
});

// Mock window.electronAPI
const mockElectronAPI = {
  addSampleToSlot: vi.fn(),
  deleteSampleFromSlot: vi.fn(),
};

setupElectronAPIMock(mockElectronAPI);

/** The voice before the edit, as undo keeps it (RE-86) */
const voicesBefore = [{ samples: [], voice: 1 }];

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
    setupElectronAPIMock(mockElectronAPI);
  });

  describe("[UC-19] [Q-07] handleSampleAdd", () => {
    it("should add sample successfully", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        data: { sampleId: 123 },
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      const added = await result.current.handleSampleAdd(
        1,
        0,
        "/path/to/sample.wav",
      );
      expect(added).toBe(true);

      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledWith(
        "Test Kit",
        1,
        0,
        "/path/to/sample.wav",
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

      const added = await result.current.handleSampleAdd(
        1,
        0,
        "/path/to/sample.wav",
      );
      expect(added).toBe(false);

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

      const added = await result.current.handleSampleAdd(
        1,
        0,
        "/path/to/sample.wav",
      );
      expect(added).toBe(false);

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Failed to add sample: Network error",
        "error",
      );
    });

    it("resolves true once main has added the sample, even if the reload fails", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        data: { sampleId: 123 },
        success: true,
      });
      const onSamplesChanged = vi
        .fn()
        .mockRejectedValue(new Error("reload failed"));

      const { result } = renderHook(() =>
        useSampleManagementOperations({ ...mockOptions, onSamplesChanged }),
      );

      const added = await result.current.handleSampleAdd(
        1,
        0,
        "/path/to/sample.wav",
      );
      expect(added).toBe(true);
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

      const added = await result.current.handleSampleAdd(
        1,
        0,
        "/path/to/sample.wav",
      );
      expect(added).toBe(true);

      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
    });

    it("should handle missing electronAPI", async () => {
      vi.stubGlobal("electronAPI", undefined);

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      const added = await result.current.handleSampleAdd(
        1,
        0,
        "/path/to/sample.wav",
      );
      expect(added).toBe(false);

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample management not available",
        "error",
      );

      // Restore
      vi.unstubAllGlobals();
    });
  });

  describe("[UC-23] handleSampleDelete", () => {
    it("[Q-01] deletes a sample, records undo from what main returned and shows the kit it returned (#452)", async () => {
      const mockSampleToDelete = {
        filename: "test.wav",
        source_path: "/path/to/test.wav",
      };
      const kit = { name: "Test Kit", samples: [] };

      const mockUndoActions = {
        createReindexSamplesAction: vi.fn(
          () =>
            ({
              data: {},
              type: "REINDEX_SAMPLES",
            }) as ReindexSamplesAction,
        ),
      };

      // Mock the hook return
      mockUseSampleManagementUndoActions.mockReturnValue(
        undoActionsWith(mockUndoActions),
      );

      // Main returns the deleted row and the voice as it was before
      const mockDeleteResult = {
        data: {
          affectedSamples: [],
          deletedSamples: [mockSampleToDelete],
          kit,
          voicesBefore,
        },
        success: true,
      };
      mockElectronAPI.deleteSampleFromSlot.mockResolvedValue(mockDeleteResult);

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleDelete(1, 0);

      expect(globalThis.electronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
      expect(mockElectronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
        "Test Kit",
        1,
        0,
      );
      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample deleted from voice 1, slot 1",
        "success",
      );
      expect(mockOptions.onSamplesChanged).toHaveBeenCalledWith(kit);
      expect(mockUndoActions.createReindexSamplesAction).toHaveBeenCalledWith(
        1,
        0,
        mockSampleToDelete,
        mockDeleteResult,
        voicesBefore,
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
      mockElectronAPI.deleteSampleFromSlot.mockRejectedValue(
        new Error("IPC closed"),
      );

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleDelete(1, 0);

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Failed to delete sample: IPC closed",
        "error",
      );
    });

    it("records no undo when main returns no voices from before", async () => {
      mockElectronAPI.deleteSampleFromSlot.mockResolvedValue({
        data: { affectedSamples: [], deletedSamples: [{ filename: "a.wav" }] },
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleDelete(1, 0);

      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
      expect(mockOptions.onSamplesChanged).toHaveBeenCalledWith(undefined);
    });

    it("should handle missing electronAPI for delete", async () => {
      setupElectronAPIMock({ deleteSampleFromSlot: undefined });

      const { result } = renderHook(() =>
        useSampleManagementOperations(mockOptions),
      );

      await result.current.handleSampleDelete(1, 0);

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample management not available",
        "error",
      );

      // Restore
      setupElectronAPIMock(mockElectronAPI);
    });
  });
});
