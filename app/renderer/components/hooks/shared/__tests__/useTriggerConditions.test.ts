import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";

vi.mock("../stepPatternConstants", () => ({
  createDefaultTriggerConditions: vi.fn(() =>
    Array.from({ length: 4 }, () => Array(16).fill(null)),
  ),
  ensureValidTriggerConditions: vi.fn((conditions) => {
    if (!conditions) {
      return Array.from({ length: 4 }, () => Array(16).fill(null));
    }
    return conditions;
  }),
}));

import { useTriggerConditions } from "../useTriggerConditions";

describe("useTriggerConditions", () => {
  let mockElectronAPI: ReturnType<typeof setupElectronAPIMock>;

  beforeEach(() => {
    mockElectronAPI = setupElectronAPIMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const defaultConditions = Array.from({ length: 4 }, () =>
    Array(16).fill(null),
  );

  describe("initialization", () => {
    it("should initialize with default conditions when no initial conditions provided", () => {
      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: null,
          kitName: "test-kit",
        }),
      );

      expect(result.current.triggerConditions).toEqual(defaultConditions);
    });

    it("should initialize with provided initial conditions", () => {
      const initial: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      initial[0][0] = "1:2";
      initial[1][3] = "2:4";

      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: initial,
          kitName: "test-kit",
        }),
      );

      expect(result.current.triggerConditions).toEqual(initial);
    });

    it("should handle undefined initial conditions", () => {
      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: null,
          kitName: "test-kit",
        }),
      );

      expect(result.current.triggerConditions).toEqual(defaultConditions);
    });

    it("should re-initialize when initialConditions prop changes", () => {
      const initial1: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      initial1[0][0] = "1:2";

      const initial2: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      initial2[1][1] = "2:4";

      const { rerender, result } = renderHook(
        ({ initialConditions, kitName }) =>
          useTriggerConditions({ initialConditions, kitName }),
        {
          initialProps: {
            initialConditions: initial1 as (null | string)[][] | null,
            kitName: "test-kit",
          },
        },
      );

      expect(result.current.triggerConditions).toEqual(initial1);

      rerender({ initialConditions: initial2, kitName: "test-kit" });

      expect(result.current.triggerConditions).toEqual(initial2);
    });
  });

  describe("updateTriggerConditions", () => {
    it("should update conditions and call electronAPI on success", async () => {
      mockElectronAPI.updateTriggerConditions.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: null,
          kitName: "test-kit",
        }),
      );

      const newConditions: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      newConditions[0][0] = "1:2";

      await act(async () => {
        result.current.setTriggerConditions(newConditions);
      });

      expect(mockElectronAPI.updateTriggerConditions).toHaveBeenCalledWith(
        "test-kit",
        newConditions,
      );
      expect(result.current.triggerConditions).toEqual(newConditions);
    });

    it("should handle missing electronAPI gracefully", async () => {
      const originalElectronAPI = window.electronAPI;
      Object.defineProperty(window, "electronAPI", {
        configurable: true,
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: null,
          kitName: "test-kit",
        }),
      );

      const newConditions: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      newConditions[0][0] = "1:2";

      await act(async () => {
        result.current.setTriggerConditions(newConditions);
      });

      // Without electronAPI the hook reverts to initial (default) conditions
      expect(result.current.triggerConditions).toEqual(defaultConditions);

      Object.defineProperty(window, "electronAPI", {
        configurable: true,
        value: originalElectronAPI,
        writable: true,
      });
    });

    it("should handle missing updateTriggerConditions method gracefully", async () => {
      const originalMethod = window.electronAPI?.updateTriggerConditions;
      if (window.electronAPI) {
        Object.defineProperty(window.electronAPI, "updateTriggerConditions", {
          configurable: true,
          value: undefined,
          writable: true,
        });
      }

      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: null,
          kitName: "test-kit",
        }),
      );

      const newConditions: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      newConditions[0][0] = "1:2";

      await act(async () => {
        result.current.setTriggerConditions(newConditions);
      });

      // Without the method the hook reverts to initial (default) conditions
      expect(result.current.triggerConditions).toEqual(defaultConditions);

      if (window.electronAPI) {
        Object.defineProperty(window.electronAPI, "updateTriggerConditions", {
          configurable: true,
          value: originalMethod,
          writable: true,
        });
      }
    });

    it("should not call API when kitName is empty", async () => {
      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: null,
          kitName: "",
        }),
      );

      const newConditions: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      newConditions[0][0] = "1:2";

      await act(async () => {
        result.current.setTriggerConditions(newConditions);
      });

      expect(mockElectronAPI.updateTriggerConditions).not.toHaveBeenCalled();
    });

    it("should revert to initial conditions on API failure", async () => {
      const initial: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      initial[0][0] = "1:4";

      mockElectronAPI.updateTriggerConditions.mockResolvedValue({
        success: false,
      });

      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: initial,
          kitName: "test-kit",
        }),
      );

      const newConditions: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      newConditions[0][0] = "2:4";

      await act(async () => {
        result.current.setTriggerConditions(newConditions);
      });

      expect(result.current.triggerConditions).toEqual(initial);
    });

    it("should revert to initial conditions on API exception", async () => {
      const initial: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      initial[0][0] = "1:4";

      mockElectronAPI.updateTriggerConditions.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: initial,
          kitName: "test-kit",
        }),
      );

      const newConditions: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      newConditions[0][0] = "2:4";

      await act(async () => {
        result.current.setTriggerConditions(newConditions);
      });

      expect(result.current.triggerConditions).toEqual(initial);
    });

    it("should revert to defaults when no initial conditions and API fails", async () => {
      mockElectronAPI.updateTriggerConditions.mockResolvedValue({
        success: false,
      });

      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: null,
          kitName: "test-kit",
        }),
      );

      const newConditions: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      newConditions[0][0] = "1:2";

      await act(async () => {
        result.current.setTriggerConditions(newConditions);
      });

      expect(result.current.triggerConditions).toEqual(defaultConditions);
    });
  });

  describe("dependency updates", () => {
    it("should reset to defaults when kitName changes", () => {
      const initial: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      initial[0][0] = "1:2";

      const { rerender, result } = renderHook(
        ({ initialConditions, kitName }) =>
          useTriggerConditions({ initialConditions, kitName }),
        {
          initialProps: {
            initialConditions: initial as (null | string)[][] | null,
            kitName: "kit-a",
          },
        },
      );

      expect(result.current.triggerConditions).toEqual(initial);

      rerender({ initialConditions: null, kitName: "kit-b" });

      expect(result.current.triggerConditions).toEqual(defaultConditions);
    });

    it("should update when initialConditions prop changes", () => {
      const initial1: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      initial1[0][0] = "1:2";

      const initial2: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      initial2[2][5] = "3:4";

      const { rerender, result } = renderHook(
        ({ initialConditions, kitName }) =>
          useTriggerConditions({ initialConditions, kitName }),
        {
          initialProps: {
            initialConditions: initial1 as (null | string)[][] | null,
            kitName: "test-kit",
          },
        },
      );

      expect(result.current.triggerConditions).toEqual(initial1);

      rerender({ initialConditions: initial2, kitName: "test-kit" });

      expect(result.current.triggerConditions).toEqual(initial2);
    });
  });

  describe("onSaved callback", () => {
    it("should call onSaved after successful save", async () => {
      const onSaved = vi.fn();
      mockElectronAPI.updateTriggerConditions.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: null,
          kitName: "test-kit",
          onSaved,
        }),
      );

      const newConditions: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      newConditions[0][0] = "1:2";

      await act(async () => {
        result.current.setTriggerConditions(newConditions);
      });

      expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it("should not call onSaved after failed save", async () => {
      const onSaved = vi.fn();
      mockElectronAPI.updateTriggerConditions.mockResolvedValue({
        success: false,
      });

      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: null,
          kitName: "test-kit",
          onSaved,
        }),
      );

      const newConditions: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      newConditions[0][0] = "1:2";

      await act(async () => {
        result.current.setTriggerConditions(newConditions);
      });

      expect(onSaved).not.toHaveBeenCalled();
    });

    it("should not call onSaved after API exception", async () => {
      const onSaved = vi.fn();
      mockElectronAPI.updateTriggerConditions.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: null,
          kitName: "test-kit",
          onSaved,
        }),
      );

      const newConditions: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      newConditions[0][0] = "1:2";

      await act(async () => {
        result.current.setTriggerConditions(newConditions);
      });

      expect(onSaved).not.toHaveBeenCalled();
    });
  });

  describe("hook return interface", () => {
    it("should return the expected structure", () => {
      const { result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: null,
          kitName: "test-kit",
        }),
      );

      expect(result.current).toHaveProperty("triggerConditions");
      expect(result.current).toHaveProperty("setTriggerConditions");
      expect(Array.isArray(result.current.triggerConditions)).toBe(true);
      expect(typeof result.current.setTriggerConditions).toBe("function");
    });

    it("should maintain stable setTriggerConditions reference across renders", () => {
      const { rerender, result } = renderHook(() =>
        useTriggerConditions({
          initialConditions: null,
          kitName: "test-kit",
        }),
      );

      const firstRef = result.current.setTriggerConditions;

      rerender();

      expect(result.current.setTriggerConditions).toBe(firstRef);
    });
  });
});
