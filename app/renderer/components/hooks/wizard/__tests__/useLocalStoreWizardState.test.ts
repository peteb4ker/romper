import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLocalStoreWizardState } from "../useLocalStoreWizardState";

describe("useLocalStoreWizardState", () => {
  const mockApi = {
    getDefaultLocalStorePath: vi.fn(),
    validateLocalStoreDirectory: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe("initial state", () => {
    it("should initialize with default state values", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      expect(result.current.state).toEqual({
        error: null,
        isInitializing: false,
        sdCardMounted: false,
        source: null,
        sourceConfirmed: false,
        targetPath: "",
      });
      expect(result.current.defaultPath).toBe("");
      expect(result.current.progress).toBeNull();
    });
  });

  describe("state setters", () => {
    it("should update targetPath", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      act(() => {
        result.current.setTargetPath("/new/target/path");
      });

      expect(result.current.state.targetPath).toBe("/new/target/path");
    });

    it("should update source", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      act(() => {
        result.current.setSource("sdcard");
      });

      expect(result.current.state.source).toBe("sdcard");
    });

    it("should update sdCardMounted", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      act(() => {
        result.current.setSdCardMounted(true);
      });

      expect(result.current.state.sdCardMounted).toBe(true);
    });

    it("should update error", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      act(() => {
        result.current.setError("Test error");
      });

      expect(result.current.state.error).toBe("Test error");

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.state.error).toBeNull();
    });

    it("should update isInitializing", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      act(() => {
        result.current.setIsInitializing(true);
      });

      expect(result.current.state.isInitializing).toBe(true);
    });

    it("should update sdCardPath and clear validation error", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      // First set a validation error using setWizardState
      act(() => {
        result.current.setWizardState({
          kitFolderValidationError: "Previous error",
        });
      });

      expect(result.current.state.kitFolderValidationError).toBe(
        "Previous error",
      );

      // Then set SD card path - should clear the error
      act(() => {
        result.current.setSdCardPath("/path/to/sdcard");
      });

      expect(result.current.state.sdCardSourcePath).toBe("/path/to/sdcard");
      expect(result.current.state.kitFolderValidationError).toBeUndefined();
    });

    it("should update sourceConfirmed", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      act(() => {
        result.current.setSourceConfirmed(true);
      });

      expect(result.current.state.sourceConfirmed).toBe(true);
    });
  });

  describe("progress tracking", () => {
    it("should initialize progress as null", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      expect(result.current.progress).toBeNull();
    });

    it("should update progress via setProgress", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      const progressEvent = {
        file: "test.wav",
        percent: 50,
        phase: "scanning",
      };

      act(() => {
        result.current.setProgress(progressEvent);
      });

      expect(result.current.progress).toEqual(progressEvent);
    });

    it("should clear progress by setting to null", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      // Set progress first
      act(() => {
        result.current.setProgress({ phase: "scanning" });
      });

      expect(result.current.progress).toEqual({ phase: "scanning" });

      // Clear progress
      act(() => {
        result.current.setProgress(null);
      });

      expect(result.current.progress).toBeNull();
    });
  });

  describe("default path management", () => {
    it("should initialize defaultPath as empty string", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      expect(result.current.defaultPath).toBe("");
    });

    // Note: defaultPath is managed internally via getUserHomeDir API call
  });

  describe("direct state manipulation", () => {
    it("should allow direct state updates via setWizardState", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      act(() => {
        result.current.setWizardState({
          kitFolderValidationError: "Custom validation error",
          source: "blank",
          targetPath: "/custom/path",
        });
      });

      expect(result.current.state).toEqual(
        expect.objectContaining({
          kitFolderValidationError: "Custom validation error",
          source: "blank",
          targetPath: "/custom/path",
        }),
      );
    });

    it("should preserve other state properties when updating via setWizardState", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      // Set initial state
      act(() => {
        result.current.setError("Initial error");
        result.current.setIsInitializing(true);
      });

      // Update via setWizardState - should preserve other properties
      act(() => {
        result.current.setWizardState({
          source: "squarp",
        });
      });

      expect(result.current.state).toEqual({
        error: "Initial error",
        isInitializing: true,
        sdCardMounted: false,
        source: "squarp",
        sourceConfirmed: false,
        targetPath: "",
      });
    });
  });

  describe("state immutability", () => {
    it("should not mutate previous state when updating", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      const initialState = result.current.state;

      act(() => {
        result.current.setError("New error");
      });

      // Original state should remain unchanged
      expect(initialState.error).toBeNull();
      expect(result.current.state.error).toBe("New error");
    });

    it("should create new state object on each update", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      const state1 = result.current.state;

      act(() => {
        result.current.setTargetPath("/path1");
      });

      const state2 = result.current.state;

      act(() => {
        result.current.setTargetPath("/path2");
      });

      const state3 = result.current.state;

      expect(state1).not.toBe(state2);
      expect(state2).not.toBe(state3);
      expect(state1.targetPath).toBe("");
      expect(state2.targetPath).toBe("/path1");
      expect(state3.targetPath).toBe("/path2");
    });
  });

  describe("return values", () => {
    it("should return all expected functions and state", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      expect(result.current).toEqual({
        canInitialize: expect.any(Boolean),
        defaultPath: expect.any(String),
        errorMessage: null,
        isSdCardSource: expect.any(Boolean),
        progress: null,
        setError: expect.any(Function),
        setIsInitializing: expect.any(Function),
        setProgress: expect.any(Function),
        setSdCardMounted: expect.any(Function),
        setSdCardPath: expect.any(Function),
        setSource: expect.any(Function),
        setSourceConfirmed: expect.any(Function),
        setTargetPath: expect.any(Function),
        setWizardState: expect.any(Function),
        state: expect.any(Object),
      });
    });
  });

  describe("edge cases", () => {
    it("should handle rapid successive updates", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      act(() => {
        result.current.setError("Error 1");
        result.current.setError("Error 2");
        result.current.setError("Error 3");
      });

      expect(result.current.state.error).toBe("Error 3");
    });

    it("should handle setting same value multiple times", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      const initialState = result.current.state;

      act(() => {
        result.current.setSource("blank");
        result.current.setSource("blank");
        result.current.setSource("blank");
      });

      expect(result.current.state.source).toBe("blank");
      expect(result.current.state).not.toBe(initialState); // Should still create new state object
    });

    it("should handle undefined and empty string values", () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardState({ api: mockApi }),
      );

      act(() => {
        result.current.setTargetPath("");
        result.current.setError(null);
        result.current.setWizardState({
          kitFolderValidationError: undefined,
        });
      });

      expect(result.current.state.targetPath).toBe("");
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.kitFolderValidationError).toBeUndefined();
    });
  });
});
