import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useValidationResults } from "../useValidationResults";

describe("useValidationResults", () => {
  const mockLocalStorePath = "/mock/path";
  const mockOnMessage = vi.fn();

  const mockValidationResult = {
    isValid: false,
    errors: [
      {
        kitName: "A1",
        missingFiles: ["kick.wav"],
        extraFiles: [],
      },
      {
        kitName: "B2",
        missingFiles: [],
        extraFiles: ["snare.wav"],
      },
      {
        kitName: "C3",
        missingFiles: ["hihat.wav"],
        extraFiles: ["clap.wav"],
      },
    ],
    errorSummary: "Found 3 kit(s) with validation errors",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    window.electronAPI = {
      validateLocalStore: vi.fn().mockResolvedValue(mockValidationResult),
    } as any;
  });

  test("should initialize with default values", () => {
    const { result } = renderHook(() =>
      useValidationResults({
        localStorePath: mockLocalStorePath,
        onMessage: mockOnMessage,
      }),
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRescanning).toBe(false);
    expect(result.current.validationResult).toBe(null);
    expect(result.current.selectedKits).toEqual([]);
  });

  test("should validate local store and group errors", async () => {
    const { result } = renderHook(() =>
      useValidationResults({
        localStorePath: mockLocalStorePath,
        onMessage: mockOnMessage,
      }),
    );

    await act(async () => {
      await result.current.validateLocalStore();
    });

    expect(window.electronAPI.validateLocalStore).toHaveBeenCalledWith(
      mockLocalStorePath,
    );
    expect(result.current.validationResult).toEqual(mockValidationResult);
    expect(mockOnMessage).toHaveBeenCalledWith({
      text: "Found 3 kit(s) with validation errors",
      type: "error",
      duration: 5000,
    });

    // Check grouped errors
    expect(result.current.groupedErrors).toEqual({
      missing: [{ kitName: "A1", missingFiles: ["kick.wav"], extraFiles: [] }],
      extra: [{ kitName: "B2", missingFiles: [], extraFiles: ["snare.wav"] }],
      both: [
        {
          kitName: "C3",
          missingFiles: ["hihat.wav"],
          extraFiles: ["clap.wav"],
        },
      ],
    });
  });

  test("should open validation dialog and trigger validation", async () => {
    const { result } = renderHook(() =>
      useValidationResults({
        localStorePath: mockLocalStorePath,
        onMessage: mockOnMessage,
      }),
    );

    await act(async () => {
      await result.current.openValidationDialog();
    });

    expect(result.current.isOpen).toBe(true);
    expect(window.electronAPI.validateLocalStore).toHaveBeenCalled();
  });

  test("should close validation dialog and reset selected kits", async () => {
    const { result } = renderHook(() =>
      useValidationResults({
        localStorePath: mockLocalStorePath,
        onMessage: mockOnMessage,
      }),
    );

    await act(async () => {
      await result.current.openValidationDialog();
      result.current.toggleKitSelection("A1");
    });

    expect(result.current.selectedKits).toEqual(["A1"]);

    await act(async () => {
      result.current.closeValidationDialog();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.selectedKits).toEqual([]);
  });

  test("should toggle kit selection", async () => {
    const { result } = renderHook(() =>
      useValidationResults({
        localStorePath: mockLocalStorePath,
        onMessage: mockOnMessage,
      }),
    );

    await act(async () => {
      result.current.toggleKitSelection("A1");
    });

    expect(result.current.selectedKits).toEqual(["A1"]);

    await act(async () => {
      result.current.toggleKitSelection("B2");
    });

    expect(result.current.selectedKits).toEqual(["A1", "B2"]);

    await act(async () => {
      result.current.toggleKitSelection("A1");
    });

    expect(result.current.selectedKits).toEqual(["B2"]);
  });

  test("should select all kits", async () => {
    const { result } = renderHook(() =>
      useValidationResults({
        localStorePath: mockLocalStorePath,
        onMessage: mockOnMessage,
      }),
    );

    // First validate to populate validation result
    await act(async () => {
      await result.current.validateLocalStore();
    });

    // Verify that validation result is set
    expect(result.current.validationResult).toEqual(mockValidationResult);

    // Now select all kits
    await act(() => {
      result.current.selectAllKits();
    });

    expect(result.current.selectedKits).toEqual(["A1", "B2", "C3"]);
  });

  test("should handle rescan selected kits", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useValidationResults({
        localStorePath: mockLocalStorePath,
        onMessage: mockOnMessage,
      }),
    );

    // Set up the selected kits first
    act(() => {
      result.current.toggleKitSelection("A1");
      result.current.toggleKitSelection("B2");
    });

    expect(result.current.selectedKits).toEqual(["A1", "B2"]);

    // Set isOpen to true so we can test that it's closed afterwards
    act(() => {
      result.current.openValidationDialog();
    });

    let rescanPromise;

    // Start rescan process in a separate act
    act(() => {
      rescanPromise = result.current.rescanSelectedKits();
    });

    // Should be in rescanning state
    expect(result.current.isRescanning).toBe(true);

    expect(mockOnMessage).toHaveBeenCalledWith({
      text: "Rescanning kits will be implemented in task 2.13.6",
      type: "info",
    });

    // Fast-forward timer and resolve the promise
    await act(async () => {
      vi.advanceTimersByTime(1500);
      await rescanPromise;
    });

    // Should complete rescanning and close dialog
    expect(result.current.isRescanning).toBe(false);
    expect(result.current.isOpen).toBe(false);

    vi.useRealTimers();
  });
});
