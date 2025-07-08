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
      rescanKit: vi.fn().mockResolvedValue({
        success: true,
        data: { scannedSamples: 5, updatedVoices: 2 },
      }),
    } as any;
  });

  test("should handle rescan selected kits", async () => {
    // Mock validation to return valid result after rescan
    window.electronAPI.validateLocalStore = vi
      .fn()
      .mockResolvedValueOnce(mockValidationResult) // Initial validation
      .mockResolvedValueOnce(mockValidationResult) // When opening dialog
      .mockResolvedValueOnce({ isValid: true, errors: [], errorSummary: "" }); // After rescan

    // Mock the rescanKit API
    window.electronAPI.rescanKit = vi.fn().mockResolvedValue({
      success: true,
      data: { scannedSamples: 5, updatedVoices: 2 },
    });

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

    // Set up the selected kits
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

    // Wait for rescan to complete
    await act(async () => {
      await rescanPromise;
    });

    // Should have called rescanKit for each selected kit
    expect(window.electronAPI.rescanKit).toHaveBeenCalledTimes(2);
    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith(
      `${mockLocalStorePath}/.romperdb`,
      mockLocalStorePath,
      "A1",
    );
    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith(
      `${mockLocalStorePath}/.romperdb`,
      mockLocalStorePath,
      "B2",
    );

    // Should show success message
    expect(mockOnMessage).toHaveBeenCalledWith({
      text: "Successfully rescanned 2 kit(s). Found 10 samples, updated 4 voices.",
      type: "success",
      duration: 5000,
    });

    // Should re-validate and close dialog
    expect(window.electronAPI.validateLocalStore).toHaveBeenCalledTimes(3); // Initial + openDialog + after rescan
    expect(result.current.isRescanning).toBe(false);
    expect(result.current.isOpen).toBe(false);
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

  test("should handle rescan errors gracefully", async () => {
    // Mock one success and one failure
    window.electronAPI.rescanKit = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: { scannedSamples: 3, updatedVoices: 1 },
      })
      .mockResolvedValueOnce({
        success: false,
        error: "Kit directory not found",
      });

    // Mock validation to return invalid result after failed rescan (dialog stays open)
    window.electronAPI.validateLocalStore = vi
      .fn()
      .mockResolvedValueOnce(mockValidationResult) // Initial validation
      .mockResolvedValueOnce(mockValidationResult) // When opening dialog
      .mockResolvedValueOnce(mockValidationResult); // After rescan (still invalid)

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

    // Set up the selected kits
    act(() => {
      result.current.toggleKitSelection("A1");
      result.current.toggleKitSelection("B2");
    });

    // Open dialog to set isOpen to true
    await act(async () => {
      await result.current.openValidationDialog();
    });

    // Start rescan process
    await act(async () => {
      await result.current.rescanSelectedKits();
    });

    // Should show partial success message
    expect(mockOnMessage).toHaveBeenCalledWith({
      text: "Partially completed rescan. 1 kit(s) succeeded, 1 failed. Found 3 samples.",
      type: "warning",
      duration: 7000,
    });

    // Should not close dialog on partial failure
    expect(result.current.isOpen).toBe(true);
  });
});
