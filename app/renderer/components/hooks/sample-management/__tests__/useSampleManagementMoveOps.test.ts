import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSampleManagementMoveOps } from "../useSampleManagementMoveOps";

// Extend Window interface
declare global {
  interface Window {
    electronAPI: any;
  }
}

// Mock dependencies
vi.mock("../useSampleManagementUndoActions", () => ({
  useSampleManagementUndoActions: vi.fn(),
}));

import * as undoActions from "../useSampleManagementUndoActions";

const mockUseSampleManagementUndoActions = vi.mocked(
  undoActions.useSampleManagementUndoActions,
);

// Mock window.electronAPI
const mockElectronAPI = {
  getAllSamplesForKit: vi.fn(),
  moveSampleBetweenKits: vi.fn(),
  moveSampleInKit: vi.fn(),
};

// Ensure window is properly typed and electronAPI is available
(window as any).electronAPI = mockElectronAPI;

describe("useSampleManagementMoveOps", () => {
  const mockOptions = {
    kitName: "Test Kit",
    onAddUndoAction: vi.fn(),
    onMessage: vi.fn(),
    onSamplesChanged: vi.fn(),
    skipUndoRecording: false,
  };

  const mockUndoActions = {
    createCrossKitMoveAction: vi.fn(() => ({
      data: {},
      type: "MOVE_SAMPLE_BETWEEN_KITS",
    })),
    createSameKitMoveAction: vi.fn(() => ({ data: {}, type: "MOVE_SAMPLE" })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    mockUseSampleManagementUndoActions.mockReturnValue(mockUndoActions);
    // Ensure electronAPI is always available
    (window as any).electronAPI = mockElectronAPI;
  });

  describe("handleSampleMove - within kit", () => {
    it("should handle successful same-kit move with undo recording", async () => {
      const mockSamples = [
        {
          filename: "sample1.wav",
          is_stereo: false,
          slot_number: 1,
          source_path: "/path/sample1.wav",
          voice_number: 1,
        },
        {
          filename: "sample2.wav",
          is_stereo: true,
          slot_number: 1,
          source_path: "/path/sample2.wav",
          voice_number: 2,
        },
      ];

      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        data: mockSamples,
        success: true,
      });

      const mockMoveResult = {
        data: { movedSample: { id: 1 } },
        success: true,
      };
      mockElectronAPI.moveSampleInKit.mockResolvedValue(mockMoveResult);

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert");

      expect(mockElectronAPI.getAllSamplesForKit).toHaveBeenCalledWith(
        "Test Kit",
      );
      expect(mockElectronAPI.moveSampleInKit).toHaveBeenCalledWith(
        "Test Kit",
        1,
        0,
        2,
        1,
        "insert",
      );
      expect(mockUndoActions.createSameKitMoveAction).toHaveBeenCalledWith({
        fromSlot: 0,
        fromVoice: 1,
        mode: "insert",
        result: mockMoveResult,
        stateSnapshot: expect.arrayContaining([
          expect.objectContaining({
            sample: expect.objectContaining({
              filename: "sample1.wav",
              is_stereo: false,
              source_path: "/path/sample1.wav",
            }),
            slot: 1,
            voice: 1,
          }),
          expect.objectContaining({
            sample: expect.objectContaining({
              filename: "sample2.wav",
              is_stereo: true,
              source_path: "/path/sample2.wav",
            }),
            slot: 1,
            voice: 2,
          }),
        ]),
        toSlot: 1,
        toVoice: 2,
      });
      expect(mockOptions.onAddUndoAction).toHaveBeenCalled();
      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample moved from voice 1, slot 1 to voice 2, slot 2",
        "success",
      );
      expect(mockOptions.onSamplesChanged).toHaveBeenCalled();
    });

    it("should handle same-kit move without undo recording when skipUndoRecording is true", async () => {
      const optionsWithSkip = { ...mockOptions, skipUndoRecording: true };

      const mockMoveResult = {
        data: { movedSample: { id: 1 } },
        success: true,
      };
      mockElectronAPI.moveSampleInKit.mockResolvedValue(mockMoveResult);

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(optionsWithSkip),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "overwrite");

      expect(mockElectronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
      expect(mockElectronAPI.moveSampleInKit).toHaveBeenCalledWith(
        "Test Kit",
        1,
        0,
        2,
        1,
        "overwrite",
      );
      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample moved from voice 1, slot 1 to voice 2, slot 2",
        "success",
      );
    });

    it("should handle same-kit move failure", async () => {
      const mockMoveResult = {
        error: "Move operation failed",
        success: false,
      };
      mockElectronAPI.moveSampleInKit.mockResolvedValue(mockMoveResult);

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Move operation failed",
        "error",
      );
      expect(mockOptions.onSamplesChanged).not.toHaveBeenCalled();
      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
    });

    it("should handle same-kit move API unavailable", async () => {
      const originalAPI = (window as any).electronAPI;
      (window as any).electronAPI = {}; // Missing moveSampleInKit

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample move not available",
        "error",
      );

      // Restore
      (window as any).electronAPI = originalAPI;
    });

    it("should handle same-kit move exception", async () => {
      mockElectronAPI.moveSampleInKit.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Failed to move sample: Network error",
        "error",
      );
    });
  });

  describe("handleSampleMove - cross-kit", () => {
    it("should handle successful cross-kit move with undo recording", async () => {
      const mockMoveResult = {
        data: { movedSample: { id: 1 }, replacedSample: null },
        success: true,
      };
      mockElectronAPI.moveSampleBetweenKits.mockResolvedValue(mockMoveResult);

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(
        1,
        0,
        2,
        1,
        "overwrite",
        "Target Kit",
      );

      expect(mockElectronAPI.moveSampleBetweenKits).toHaveBeenCalledWith(
        "Test Kit",
        1,
        0,
        "Target Kit",
        2,
        1,
        "overwrite",
      );
      expect(mockUndoActions.createCrossKitMoveAction).toHaveBeenCalledWith({
        fromSlot: 0,
        fromVoice: 1,
        mode: "overwrite",
        result: mockMoveResult,
        targetKit: "Target Kit",
        toSlot: 1,
        toVoice: 2,
      });
      expect(mockOptions.onAddUndoAction).toHaveBeenCalled();
      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample moved from Test Kit voice 1, slot 1 to Target Kit voice 2, slot 2",
        "success",
      );
      expect(mockOptions.onSamplesChanged).toHaveBeenCalled();
    });

    it("should handle cross-kit move without undo recording when skipUndoRecording is true", async () => {
      const optionsWithSkip = { ...mockOptions, skipUndoRecording: true };

      const mockMoveResult = {
        data: { movedSample: { id: 1 } },
        success: true,
      };
      mockElectronAPI.moveSampleBetweenKits.mockResolvedValue(mockMoveResult);

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(optionsWithSkip),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert", "Target Kit");

      expect(mockElectronAPI.moveSampleBetweenKits).toHaveBeenCalledWith(
        "Test Kit",
        1,
        0,
        "Target Kit",
        2,
        1,
        "insert",
      );
      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample moved from Test Kit voice 1, slot 1 to Target Kit voice 2, slot 2",
        "success",
      );
    });

    it("should handle cross-kit move failure", async () => {
      const mockMoveResult = {
        error: "Cross-kit move failed",
        success: false,
      };
      mockElectronAPI.moveSampleBetweenKits.mockResolvedValue(mockMoveResult);

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert", "Target Kit");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Cross-kit move failed",
        "error",
      );
      expect(mockOptions.onSamplesChanged).not.toHaveBeenCalled();
      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
    });

    it("should handle cross-kit move API unavailable", async () => {
      const originalAPI = (window as any).electronAPI;
      (window as any).electronAPI = { moveSampleInKit: vi.fn() }; // Missing moveSampleBetweenKits

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert", "Target Kit");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Cross-kit sample move not available",
        "error",
      );

      // Restore
      (window as any).electronAPI = originalAPI;
    });

    it("should handle cross-kit move exception", async () => {
      mockElectronAPI.moveSampleBetweenKits.mockRejectedValue("String error");

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert", "Target Kit");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Failed to move sample: String error",
        "error",
      );
    });
  });

  describe("state snapshot capture", () => {
    it("should capture state snapshot for affected voices", async () => {
      const mockSamples = [
        {
          filename: "sample1.wav",
          is_stereo: false,
          slot_number: 1,
          source_path: "/path/sample1.wav",
          voice_number: 1,
        },
        {
          filename: "sample2.wav",
          is_stereo: true,
          slot_number: 1,
          source_path: "/path/sample2.wav",
          voice_number: 2,
        },
        {
          filename: "sample3.wav",
          is_stereo: false,
          slot_number: 1,
          source_path: "/path/sample3.wav",
          voice_number: 3, // Should not be included
        },
      ];

      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        data: mockSamples,
        success: true,
      });
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        data: { movedSample: { id: 1 } },
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert");

      expect(mockUndoActions.createSameKitMoveAction).toHaveBeenCalledWith(
        expect.objectContaining({
          stateSnapshot: expect.arrayContaining([
            expect.objectContaining({ voice: 1 }),
            expect.objectContaining({ voice: 2 }),
          ]),
        }),
      );

      // Verify that voice 3 sample is not included in snapshot
      const stateSnapshot =
        mockUndoActions.createSameKitMoveAction.mock.calls[0][0].stateSnapshot;
      expect(stateSnapshot).toHaveLength(2);
      expect(stateSnapshot.every((s: any) => s.voice !== 3)).toBe(true);
    });

    it("should handle empty state snapshot when getAllSamplesForKit fails", async () => {
      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        error: "Failed to get samples",
        success: false,
      });
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        data: { movedSample: { id: 1 } },
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert");

      expect(mockUndoActions.createSameKitMoveAction).toHaveBeenCalledWith(
        expect.objectContaining({
          stateSnapshot: [],
        }),
      );
    });

    it("should handle null data from getAllSamplesForKit", async () => {
      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        data: null,
        success: true,
      });
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        data: { movedSample: { id: 1 } },
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert");

      expect(mockUndoActions.createSameKitMoveAction).toHaveBeenCalledWith(
        expect.objectContaining({
          stateSnapshot: [],
        }),
      );
    });
  });

  describe("edge cases", () => {
    it("should not record undo when move result has no data", async () => {
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        data: null,
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert");

      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
    });

    it("should not record undo when onAddUndoAction is not provided", async () => {
      const optionsWithoutUndo = { ...mockOptions, onAddUndoAction: undefined };

      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        data: [],
        success: true,
      });
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        data: { movedSample: { id: 1 } },
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(optionsWithoutUndo),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert");

      expect(mockElectronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
    });

    it("should handle move result with no error message", async () => {
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        success: false,
      });

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Failed to move sample",
        "error",
      );
    });

    it("should not call onSamplesChanged when callback not provided", async () => {
      const optionsWithoutCallback = {
        ...mockOptions,
        onSamplesChanged: undefined,
      };

      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        data: { movedSample: { id: 1 } },
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(optionsWithoutCallback),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "insert");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample moved from voice 1, slot 1 to voice 2, slot 2",
        "success",
      );
      // Should not throw or cause issues
    });
  });

  describe("return values", () => {
    it("should return handleSampleMove function", () => {
      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      expect(result.current).toEqual({
        handleSampleMove: expect.any(Function),
      });
    });
  });
});
