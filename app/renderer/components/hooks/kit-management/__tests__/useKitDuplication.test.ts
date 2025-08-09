import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKitDuplication } from "../useKitDuplication";

// Mock the kit operations
vi.mock("../../../utils/kitOperations", () => ({
  duplicateKit: vi.fn(),
  validateKitSlot: vi.fn((slot) => /^[A-Z]\d{1,2}$/.test(slot)),
}));

import { duplicateKit } from "../../../utils/kitOperations";

const mockDuplicateKit = vi.mocked(duplicateKit);

describe("useKitDuplication", () => {
  const defaultProps = {
    onRefreshKits: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should initialize with correct default values", () => {
      const { result } = renderHook(() => useKitDuplication(defaultProps));

      expect(result.current.duplicateKitSource).toBeNull();
      expect(result.current.duplicateKitDest).toBe("");
      expect(result.current.duplicateKitError).toBeNull();
    });
  });

  describe("kit duplication", () => {
    it("should successfully duplicate a kit", async () => {
      mockDuplicateKit.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useKitDuplication(defaultProps));

      act(() => {
        result.current.setDuplicateKitSource("A0");
        result.current.setDuplicateKitDest("B0");
      });

      await act(async () => {
        await result.current.handleDuplicateKit();
      });

      expect(mockDuplicateKit).toHaveBeenCalledWith("A0", "B0");
      expect(result.current.duplicateKitSource).toBeNull();
      expect(result.current.duplicateKitDest).toBe("");
      expect(result.current.duplicateKitError).toBeNull();
      expect(defaultProps.onRefreshKits).toHaveBeenCalledWith("B0");
    });

    it("should handle missing source kit", async () => {
      const { result } = renderHook(() => useKitDuplication(defaultProps));

      act(() => {
        result.current.setDuplicateKitDest("B0");
      });

      await act(async () => {
        await result.current.handleDuplicateKit();
      });

      expect(mockDuplicateKit).not.toHaveBeenCalled();
      expect(result.current.duplicateKitError).toBe(
        "Invalid destination slot. Use format A0-Z99.",
      );
    });

    it("should handle invalid destination slot", async () => {
      const { result } = renderHook(() => useKitDuplication(defaultProps));

      act(() => {
        result.current.setDuplicateKitSource("A0");
        result.current.setDuplicateKitDest("INVALID");
      });

      await act(async () => {
        await result.current.handleDuplicateKit();
      });

      expect(mockDuplicateKit).not.toHaveBeenCalled();
      expect(result.current.duplicateKitError).toBe(
        "Invalid destination slot. Use format A0-Z99.",
      );
    });

    it("should handle duplication error", async () => {
      const error = new Error("Duplication failed");
      mockDuplicateKit.mockRejectedValueOnce(error);
      const { result } = renderHook(() => useKitDuplication(defaultProps));

      act(() => {
        result.current.setDuplicateKitSource("A0");
        result.current.setDuplicateKitDest("B0");
      });

      await act(async () => {
        await result.current.handleDuplicateKit();
      });

      expect(result.current.duplicateKitError).toBe("Duplication failed");
    });

    it("should handle string error", async () => {
      mockDuplicateKit.mockRejectedValueOnce("String error");
      const { result } = renderHook(() => useKitDuplication(defaultProps));

      act(() => {
        result.current.setDuplicateKitSource("A0");
        result.current.setDuplicateKitDest("B0");
      });

      await act(async () => {
        await result.current.handleDuplicateKit();
      });

      expect(result.current.duplicateKitError).toBe("String error");
    });
  });

  describe("state management", () => {
    it("should allow setting source kit", () => {
      const { result } = renderHook(() => useKitDuplication(defaultProps));

      act(() => {
        result.current.setDuplicateKitSource("A5");
      });
      expect(result.current.duplicateKitSource).toBe("A5");

      act(() => {
        result.current.setDuplicateKitSource(null);
      });
      expect(result.current.duplicateKitSource).toBeNull();
    });

    it("should allow setting destination slot", () => {
      const { result } = renderHook(() => useKitDuplication(defaultProps));

      act(() => {
        result.current.setDuplicateKitDest("C7");
      });
      expect(result.current.duplicateKitDest).toBe("C7");

      act(() => {
        result.current.setDuplicateKitDest("");
      });
      expect(result.current.duplicateKitDest).toBe("");
    });

    it("should allow setting and clearing errors", () => {
      const { result } = renderHook(() => useKitDuplication(defaultProps));

      act(() => {
        result.current.setDuplicateKitError("Test error");
      });
      expect(result.current.duplicateKitError).toBe("Test error");

      act(() => {
        result.current.setDuplicateKitError(null);
      });
      expect(result.current.duplicateKitError).toBeNull();
    });
  });

  describe("without optional callbacks", () => {
    it("should work without onRefreshKits callback", async () => {
      const propsWithoutRefresh = {};

      mockDuplicateKit.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() =>
        useKitDuplication(propsWithoutRefresh),
      );

      act(() => {
        result.current.setDuplicateKitSource("A0");
        result.current.setDuplicateKitDest("B0");
      });

      await act(async () => {
        await result.current.handleDuplicateKit();
      });

      expect(mockDuplicateKit).toHaveBeenCalledWith("A0", "B0");
      // Should not throw error when onRefreshKits is undefined
    });
  });

  describe("error clearing on retry", () => {
    it("should clear error before attempting duplication", async () => {
      const { result } = renderHook(() => useKitDuplication(defaultProps));

      // Set an initial error
      act(() => {
        result.current.setDuplicateKitError("Previous error");
      });

      expect(result.current.duplicateKitError).toBe("Previous error");

      // Attempt duplication with invalid data (should clear error first, then set new one)
      act(() => {
        result.current.setDuplicateKitSource("A0");
        result.current.setDuplicateKitDest("INVALID");
      });

      await act(async () => {
        await result.current.handleDuplicateKit();
      });

      expect(result.current.duplicateKitError).toBe(
        "Invalid destination slot. Use format A0-Z99.",
      );
    });
  });
});
