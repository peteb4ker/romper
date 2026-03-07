import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKitDeletion } from "../useKitDeletion";

// Mock kitOperations
vi.mock("../../../utils/kitOperations", () => ({
  deleteKit: vi.fn(),
  formatKitOperationError: vi.fn(
    (err: unknown, op: string) =>
      `Failed to ${op} kit: ${err instanceof Error ? err.message : String(err)}`,
  ),
  getKitDeleteSummary: vi.fn(),
}));

import { deleteKit, getKitDeleteSummary } from "../../../utils/kitOperations";

const mockDeleteKit = vi.mocked(deleteKit);
const mockGetKitDeleteSummary = vi.mocked(getKitDeleteSummary);

describe("useKitDeletion", () => {
  const mockOnMessage = vi.fn();
  const mockOnRefreshKits = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns initial state", () => {
    const { result } = renderHook(() =>
      useKitDeletion({
        onMessage: mockOnMessage,
        onRefreshKits: mockOnRefreshKits,
      }),
    );

    expect(result.current.kitToDelete).toBeNull();
    expect(result.current.deleteSummary).toBeNull();
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.handleRequestDelete).toBeInstanceOf(Function);
    expect(result.current.handleConfirmDelete).toBeInstanceOf(Function);
    expect(result.current.handleCancelDelete).toBeInstanceOf(Function);
  });

  describe("handleRequestDelete", () => {
    it("sets kitToDelete and deleteSummary on success", async () => {
      mockGetKitDeleteSummary.mockResolvedValue({
        kitName: "A5",
        locked: false,
        sampleCount: 3,
        voiceCount: 4,
      });

      const { result } = renderHook(() =>
        useKitDeletion({
          onMessage: mockOnMessage,
          onRefreshKits: mockOnRefreshKits,
        }),
      );

      await act(async () => {
        await result.current.handleRequestDelete("A5");
      });

      expect(result.current.kitToDelete).toBe("A5");
      expect(result.current.deleteSummary).toEqual({
        sampleCount: 3,
        voiceCount: 4,
      });
    });

    it("shows warning and does not set state for locked kit", async () => {
      mockGetKitDeleteSummary.mockResolvedValue({
        kitName: "A5",
        locked: true,
        sampleCount: 3,
        voiceCount: 4,
      });

      const { result } = renderHook(() =>
        useKitDeletion({
          onMessage: mockOnMessage,
          onRefreshKits: mockOnRefreshKits,
        }),
      );

      await act(async () => {
        await result.current.handleRequestDelete("A5");
      });

      expect(mockOnMessage).toHaveBeenCalledWith(
        "Kit is locked. Unlock it before deleting.",
        "warning",
        4000,
      );
      expect(result.current.kitToDelete).toBeNull();
      expect(result.current.deleteSummary).toBeNull();
    });

    it("shows error message when getKitDeleteSummary fails", async () => {
      mockGetKitDeleteSummary.mockRejectedValue(new Error("DB error"));

      const { result } = renderHook(() =>
        useKitDeletion({
          onMessage: mockOnMessage,
          onRefreshKits: mockOnRefreshKits,
        }),
      );

      await act(async () => {
        await result.current.handleRequestDelete("A5");
      });

      expect(mockOnMessage).toHaveBeenCalledWith(
        "Failed to delete kit: DB error",
        "error",
        5000,
      );
      expect(result.current.kitToDelete).toBeNull();
    });
  });

  describe("handleConfirmDelete", () => {
    it("deletes kit, shows message, and refreshes", async () => {
      mockGetKitDeleteSummary.mockResolvedValue({
        kitName: "A5",
        locked: false,
        sampleCount: 0,
        voiceCount: 4,
      });
      mockDeleteKit.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useKitDeletion({
          onMessage: mockOnMessage,
          onRefreshKits: mockOnRefreshKits,
        }),
      );

      // First request delete to set up state
      await act(async () => {
        await result.current.handleRequestDelete("A5");
      });

      // Then confirm
      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(mockDeleteKit).toHaveBeenCalledWith("A5");
      expect(mockOnMessage).toHaveBeenCalledWith(
        "Kit A5 deleted.",
        "info",
        4000,
      );
      expect(mockOnRefreshKits).toHaveBeenCalled();
      expect(result.current.kitToDelete).toBeNull();
      expect(result.current.deleteSummary).toBeNull();
      expect(result.current.isDeleting).toBe(false);
    });

    it("does nothing when kitToDelete is null", async () => {
      const { result } = renderHook(() =>
        useKitDeletion({
          onMessage: mockOnMessage,
          onRefreshKits: mockOnRefreshKits,
        }),
      );

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(mockDeleteKit).not.toHaveBeenCalled();
    });

    it("shows error and resets state on delete failure", async () => {
      mockGetKitDeleteSummary.mockResolvedValue({
        kitName: "A5",
        locked: false,
        sampleCount: 0,
        voiceCount: 4,
      });
      mockDeleteKit.mockRejectedValue(new Error("Delete failed"));

      const { result } = renderHook(() =>
        useKitDeletion({
          onMessage: mockOnMessage,
          onRefreshKits: mockOnRefreshKits,
        }),
      );

      await act(async () => {
        await result.current.handleRequestDelete("A5");
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(mockOnMessage).toHaveBeenCalledWith(
        "Failed to delete kit: Delete failed",
        "error",
        5000,
      );
      expect(result.current.kitToDelete).toBeNull();
      expect(result.current.isDeleting).toBe(false);
    });
  });

  describe("handleCancelDelete", () => {
    it("resets kitToDelete and deleteSummary", async () => {
      mockGetKitDeleteSummary.mockResolvedValue({
        kitName: "A5",
        locked: false,
        sampleCount: 3,
        voiceCount: 4,
      });

      const { result } = renderHook(() =>
        useKitDeletion({
          onMessage: mockOnMessage,
          onRefreshKits: mockOnRefreshKits,
        }),
      );

      await act(async () => {
        await result.current.handleRequestDelete("A5");
      });

      expect(result.current.kitToDelete).toBe("A5");

      act(() => {
        result.current.handleCancelDelete();
      });

      expect(result.current.kitToDelete).toBeNull();
      expect(result.current.deleteSummary).toBeNull();
    });
  });
});
