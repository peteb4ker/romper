import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useKitErrorHandling } from "../useKitErrorHandling";

describe("useKitErrorHandling", () => {
  describe("initial state", () => {
    it("should initialize with no errors", () => {
      const { result } = renderHook(() => useKitErrorHandling());

      expect(result.current.error).toBeNull();
      expect(result.current.sdCardWarning).toBeNull();
    });
  });

  describe("error management", () => {
    it("should set and clear error", () => {
      const { result } = renderHook(() => useKitErrorHandling());

      act(() => {
        result.current.setError("Test error message");
      });
      expect(result.current.error).toBe("Test error message");

      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });

    it("should set and clear SD card warning", () => {
      const { result } = renderHook(() => useKitErrorHandling());

      act(() => {
        result.current.setSdCardWarning("SD card warning");
      });
      expect(result.current.sdCardWarning).toBe("SD card warning");

      act(() => {
        result.current.clearSdCardWarning();
      });
      expect(result.current.sdCardWarning).toBeNull();
    });

    it("should clear all errors at once", () => {
      const { result } = renderHook(() => useKitErrorHandling());

      act(() => {
        result.current.setError("Test error");
        result.current.setSdCardWarning("SD warning");
      });
      expect(result.current.error).toBe("Test error");
      expect(result.current.sdCardWarning).toBe("SD warning");

      act(() => {
        result.current.clearAllErrors();
      });
      expect(result.current.error).toBeNull();
      expect(result.current.sdCardWarning).toBeNull();
    });
  });

  describe("multiple error scenarios", () => {
    it("should handle multiple error updates", () => {
      const { result } = renderHook(() => useKitErrorHandling());

      act(() => {
        result.current.setError("First error");
      });
      expect(result.current.error).toBe("First error");

      act(() => {
        result.current.setError("Second error");
      });
      expect(result.current.error).toBe("Second error");
    });

    it("should handle empty string errors", () => {
      const { result } = renderHook(() => useKitErrorHandling());

      act(() => {
        result.current.setError("");
      });
      expect(result.current.error).toBe("");

      act(() => {
        result.current.setSdCardWarning("");
      });
      expect(result.current.sdCardWarning).toBe("");
    });
  });
});
