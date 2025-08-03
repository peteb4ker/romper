import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../tests/mocks/electron/electronAPI";
import { useStepPattern } from "../useStepPattern";

// Mock the step pattern constants
vi.mock("../stepPatternConstants", () => ({
  createDefaultStepPattern: vi.fn(() => [
    [1, 0, 1, 0],
    [0, 1, 0, 1],
    [1, 1, 0, 0],
    [0, 0, 1, 1],
  ]),
  ensureValidStepPattern: vi.fn((pattern) => {
    if (!pattern) {
      return [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ];
    }
    return pattern;
  }),
}));

describe("useStepPattern", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-setup electronAPI mock after clearAllMocks
    setupElectronAPIMock();

    // Mock electronAPI using centralized mocks
    vi.mocked(window.electronAPI.updateStepPattern).mockResolvedValue({
      success: true,
    });

    // Mock console.error
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("initializes with null pattern when no initial pattern provided", () => {
      const { result } = renderHook(() => useStepPattern({ kitName: "A0" }));

      expect(result.current.stepPattern).toEqual([
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ]);
    });

    it("initializes with provided initial pattern", () => {
      const initialPattern = [
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ];

      const { result } = renderHook(() =>
        useStepPattern({
          initialPattern,
          kitName: "A0",
        }),
      );

      expect(result.current.stepPattern).toEqual(initialPattern);
    });

    it("updates pattern when initialPattern prop changes", () => {
      const initialPattern1 = [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
      ];

      const initialPattern2 = [
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ];

      const { rerender, result } = renderHook(
        ({ initialPattern }) =>
          useStepPattern({ initialPattern, kitName: "A0" }),
        {
          initialProps: { initialPattern: initialPattern1 },
        },
      );

      expect(result.current.stepPattern).toEqual(initialPattern1);

      rerender({ initialPattern: initialPattern2 });

      expect(result.current.stepPattern).toEqual(initialPattern2);
    });
  });

  describe("updateStepPattern", () => {
    it("updates step pattern successfully", async () => {
      const { result } = renderHook(() => useStepPattern({ kitName: "A0" }));

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).toHaveBeenCalledWith(
        "A0",
        newPattern,
      );
      expect(result.current.stepPattern).toEqual(newPattern);
    });

    it("does not call API when electronAPI is not available", async () => {
      (window as any).electronAPI = undefined;

      const { result } = renderHook(() => useStepPattern({ kitName: "A0" }));

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      // Should remain at default pattern since API call was skipped
      expect(result.current.stepPattern).toEqual([
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ]);
    });

    it("does not call API when updateStepPattern method is not available", async () => {
      (window as any).electronAPI = {};

      const { result } = renderHook(() => useStepPattern({ kitName: "A0" }));

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      // Should remain at default pattern since API call was skipped
      expect(result.current.stepPattern).toEqual([
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ]);
    });

    it("does not call API when kitName is empty", async () => {
      const { result } = renderHook(() => useStepPattern({ kitName: "" }));

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).not.toHaveBeenCalled();
      // Should remain at default pattern since API call was skipped
      expect(result.current.stepPattern).toEqual([
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ]);
    });

    it("reverts to initial pattern when API call fails", async () => {
      const initialPattern = [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
      ];

      vi.mocked(window.electronAPI.updateStepPattern).mockResolvedValue({
        error: "Database error",
        success: false,
      });

      const { result } = renderHook(() =>
        useStepPattern({
          initialPattern,
          kitName: "A0",
        }),
      );

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).toHaveBeenCalledWith(
        "A0",
        newPattern,
      );

      // Should revert to initial pattern after failure
      expect(result.current.stepPattern).toEqual(initialPattern);
      expect(console.error).toHaveBeenCalledWith(
        "Failed to save step pattern:",
        "Database error",
      );
    });

    it("reverts to initial pattern when API call throws exception", async () => {
      const initialPattern = [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
      ];

      const apiError = new Error("Network error");
      vi.mocked(window.electronAPI.updateStepPattern).mockRejectedValue(
        apiError,
      );

      const { result } = renderHook(() =>
        useStepPattern({
          initialPattern,
          kitName: "A0",
        }),
      );

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).toHaveBeenCalledWith(
        "A0",
        newPattern,
      );

      // Should revert to initial pattern after exception
      expect(result.current.stepPattern).toEqual(initialPattern);
      expect(console.error).toHaveBeenCalledWith(
        "Exception saving step pattern:",
        apiError,
      );
    });

    it("reverts to default pattern when no initial pattern and API fails", async () => {
      vi.mocked(window.electronAPI.updateStepPattern).mockResolvedValue({
        error: "Database error",
        success: false,
      });

      const { result } = renderHook(() => useStepPattern({ kitName: "A0" }));

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      // Should revert to default pattern (from ensureValidStepPattern)
      expect(result.current.stepPattern).toEqual([
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ]);
    });
  });

  describe("dependency updates", () => {
    it("updates callback when kitName changes", async () => {
      const { rerender, result } = renderHook(
        ({ kitName }) => useStepPattern({ kitName }),
        {
          initialProps: { kitName: "A0" },
        },
      );

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).toHaveBeenCalledWith(
        "A0",
        newPattern,
      );

      // Clear previous calls
      vi.clearAllMocks();

      // Change kitName
      rerender({ kitName: "B0" });

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).toHaveBeenCalledWith(
        "B0",
        newPattern,
      );
    });

    it("updates callback when initialPattern changes", async () => {
      const initialPattern1 = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
      ];

      const initialPattern2 = [
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ];

      vi.mocked(window.electronAPI.updateStepPattern).mockResolvedValue({
        error: "Test error",
        success: false,
      });

      const { rerender, result } = renderHook(
        ({ initialPattern }) =>
          useStepPattern({ initialPattern, kitName: "A0" }),
        {
          initialProps: { initialPattern: initialPattern1 },
        },
      );

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      // Should revert to first initial pattern
      expect(result.current.stepPattern).toEqual(initialPattern1);

      // Change initial pattern
      rerender({ initialPattern: initialPattern2 });

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      // Should revert to second initial pattern
      expect(result.current.stepPattern).toEqual(initialPattern2);
    });
  });

  describe("hook return interface", () => {
    it("returns correct interface structure", () => {
      const { result } = renderHook(() => useStepPattern({ kitName: "A0" }));

      expect(result.current).toHaveProperty("stepPattern");
      expect(result.current).toHaveProperty("setStepPattern");
      expect(typeof result.current.setStepPattern).toBe("function");
    });

    it("maintains stable function reference", () => {
      const { rerender, result } = renderHook(() =>
        useStepPattern({ kitName: "A0" }),
      );

      const firstSetStepPattern = result.current.setStepPattern;

      rerender();

      const secondSetStepPattern = result.current.setStepPattern;

      expect(firstSetStepPattern).toBe(secondSetStepPattern);
    });
  });
});
