import type {
  MoveSampleAction,
  MoveSampleBetweenKitsAction,
} from "@romper/shared/undoTypes";

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useSampleManagementMoveOps } from "../useSampleManagementMoveOps";

// Mock dependencies
vi.mock("../useSampleManagementUndoActions", () => ({
  useSampleManagementUndoActions: vi.fn(),
}));

import * as undoActions from "../useSampleManagementUndoActions";

const mockUseSampleManagementUndoActions = vi.mocked(
  undoActions.useSampleManagementUndoActions,
);
type UndoActions = ReturnType<
  typeof undoActions.useSampleManagementUndoActions
>;

// Mock window.electronAPI
const mockElectronAPI = {
  getAllSamplesForKit: vi.fn(),
  moveSampleBetweenKits: vi.fn(),
  moveSampleInKit: vi.fn(),
};

setupElectronAPIMock(mockElectronAPI);

describe("useSampleManagementMoveOps", () => {
  const mockOptions = {
    kitName: "Test Kit",
    onAddUndoAction: vi.fn(),
    onMessage: vi.fn(),
    onSamplesChanged: vi.fn(),
    skipUndoRecording: false,
  };

  const mockUndoActions = {
    createAddSampleAction: vi.fn<UndoActions["createAddSampleAction"]>(),
    createCrossKitMoveAction: vi.fn<UndoActions["createCrossKitMoveAction"]>(
      () =>
        ({
          data: {},
          type: "MOVE_SAMPLE_BETWEEN_KITS",
        }) as MoveSampleBetweenKitsAction,
    ),
    createReindexSamplesAction:
      vi.fn<UndoActions["createReindexSamplesAction"]>(),
    createSameKitMoveAction: vi.fn<UndoActions["createSameKitMoveAction"]>(
      () => ({ data: {}, type: "MOVE_SAMPLE" }) as MoveSampleAction,
    ),
  } satisfies UndoActions;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    mockUseSampleManagementUndoActions.mockReturnValue(mockUndoActions);
    // Ensure electronAPI is always available
    setupElectronAPIMock(mockElectronAPI);
  });

  describe("[UC-21] handleSampleMove - within kit", () => {
    it("should handle successful same-kit move with undo recording", async () => {
      const mockSamples = [
        {
          filename: "sample1.wav",
          slot_number: 100,
          source_path: "/path/sample1.wav",
          voice_number: 1,
        },
        {
          filename: "sample2.wav",
          slot_number: 100,
          source_path: "/path/sample2.wav",
          voice_number: 2,
        },
      ];

      // Main returns the two voices as they were before the move (#452)
      const mockMoveResult = {
        data: {
          movedSample: { id: 1 },
          voicesBefore: [
            { samples: [mockSamples[0]], voice: 1 },
            { samples: [mockSamples[1]], voice: 2 },
          ],
        },
        success: true,
      };
      mockElectronAPI.moveSampleInKit.mockResolvedValue(mockMoveResult);

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1);

      expect(mockElectronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
      expect(mockElectronAPI.moveSampleInKit).toHaveBeenCalledWith(
        "Test Kit",
        1,
        0,
        2,
        1,
      );
      expect(mockUndoActions.createSameKitMoveAction).toHaveBeenCalledWith({
        fromSlot: 0,
        fromVoice: 1,
        result: mockMoveResult,
        toSlot: 1,
        toVoice: 2,
        voicesBefore: [
          {
            samples: [
              expect.objectContaining({
                filename: "sample1.wav",
                slot_number: 100,
                source_path: "/path/sample1.wav",
              }),
            ],
            voice: 1,
          },
          {
            samples: [
              expect.objectContaining({
                filename: "sample2.wav",
                slot_number: 100,
                source_path: "/path/sample2.wav",
              }),
            ],
            voice: 2,
          },
        ],
      });
      expect(mockOptions.onAddUndoAction).toHaveBeenCalled();
      // Toast notification was removed per user request
      expect(mockOptions.onMessage).not.toHaveBeenCalledWith(
        expect.stringContaining("Sample moved"),
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

      await result.current.handleSampleMove(1, 0, 2, 1);

      expect(mockElectronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
      expect(mockElectronAPI.moveSampleInKit).toHaveBeenCalledWith(
        "Test Kit",
        1,
        0,
        2,
        1,
      );
      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
      // Toast notification was removed per user request
      expect(mockOptions.onMessage).not.toHaveBeenCalledWith(
        expect.stringContaining("Sample moved"),
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

      await result.current.handleSampleMove(1, 0, 2, 1);

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Move operation failed",
        "error",
      );
      expect(mockOptions.onSamplesChanged).not.toHaveBeenCalled();
      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
    });

    it("should handle same-kit move API unavailable", async () => {
      setupElectronAPIMock({ moveSampleInKit: undefined });

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1);

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Sample move not available",
        "error",
      );

      // Restore
      setupElectronAPIMock(mockElectronAPI);
    });

    it("should handle same-kit move exception", async () => {
      mockElectronAPI.moveSampleInKit.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1);

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Failed to move sample: Network error",
        "error",
      );
    });
  });

  describe("handleSampleMove - cross-kit", () => {
    it("should handle successful cross-kit move with undo recording", async () => {
      const mockMoveResult = {
        data: { movedSample: { id: 1 } },
        success: true,
      };
      mockElectronAPI.moveSampleBetweenKits.mockResolvedValue(mockMoveResult);

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "Target Kit");

      expect(mockElectronAPI.moveSampleBetweenKits).toHaveBeenCalledWith(
        "Test Kit",
        1,
        0,
        "Target Kit",
        2,
        1,
        "insert",
      );
      expect(mockUndoActions.createCrossKitMoveAction).toHaveBeenCalledWith({
        fromSlot: 0,
        fromVoice: 1,
        result: mockMoveResult,
        targetKit: "Target Kit",
        toSlot: 1,
        toVoice: 2,
      });
      expect(mockOptions.onAddUndoAction).toHaveBeenCalled();
      // Toast notification was removed per user request
      expect(mockOptions.onMessage).not.toHaveBeenCalledWith(
        expect.stringContaining("Sample moved"),
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

      await result.current.handleSampleMove(1, 0, 2, 1, "Target Kit");

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
      // Toast notification was removed per user request
      expect(mockOptions.onMessage).not.toHaveBeenCalledWith(
        expect.stringContaining("Sample moved"),
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

      await result.current.handleSampleMove(1, 0, 2, 1, "Target Kit");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Cross-kit move failed",
        "error",
      );
      expect(mockOptions.onSamplesChanged).not.toHaveBeenCalled();
      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
    });

    it("should handle cross-kit move API unavailable", async () => {
      setupElectronAPIMock({
        moveSampleBetweenKits: undefined,
        moveSampleInKit: vi.fn(),
      });

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "Target Kit");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Cross-kit sample move not available",
        "error",
      );

      // Restore
      setupElectronAPIMock(mockElectronAPI);
    });

    it("should handle cross-kit move exception", async () => {
      mockElectronAPI.moveSampleBetweenKits.mockRejectedValue("String error");

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1, "Target Kit");

      expect(mockOptions.onMessage).toHaveBeenCalledWith(
        "Failed to move sample: String error",
        "error",
      );
    });
  });

  describe("[Q-02] voice snapshot for undo (RE-86, #452)", () => {
    it("[Q-01] records the voices main returned from before the move, and shows the kit it returned", async () => {
      const voicesBefore = [
        { samples: [], voice: 1 },
        { samples: [], voice: 2 },
      ];
      const kit = { name: "Test Kit", samples: [] };
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        data: { kit, movedSample: { id: 1 }, voicesBefore },
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1);

      expect(
        mockUndoActions.createSameKitMoveAction.mock.calls[0][0].voicesBefore,
      ).toBe(voicesBefore);
      expect(mockOptions.onSamplesChanged).toHaveBeenCalledWith(kit);
      expect(mockElectronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
    });

    it("records no undo when main returns no voices from before", async () => {
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        data: { movedSample: { id: 1 } },
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1);

      // Restoring an empty snapshot would empty both voices
      expect(mockElectronAPI.moveSampleInKit).toHaveBeenCalled();
      expect(mockUndoActions.createSameKitMoveAction).not.toHaveBeenCalled();
      expect(mockOptions.onAddUndoAction).not.toHaveBeenCalled();
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

      await result.current.handleSampleMove(1, 0, 2, 1);

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

      await result.current.handleSampleMove(1, 0, 2, 1);

      expect(mockElectronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
    });

    it("should handle move result with no error message", async () => {
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        success: false,
      });

      const { result } = renderHook(() =>
        useSampleManagementMoveOps(mockOptions),
      );

      await result.current.handleSampleMove(1, 0, 2, 1);

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

      await result.current.handleSampleMove(1, 0, 2, 1);

      // Toast notification was removed per user request
      expect(mockOptions.onMessage).not.toHaveBeenCalledWith(
        expect.stringContaining("Sample moved"),
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
