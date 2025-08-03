import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useValidationResults } from "../useValidationResults";

describe("useValidationResults", () => {
  const mockLocalStorePath = "/mock/path";
  const mockOnMessage = vi.fn();

  const mockValidationResult = {
    errors: [
      {
        extraFiles: [],
        kitName: "A1",
        missingFiles: ["kick.wav"],
      },
      {
        extraFiles: ["snare.wav"],
        kitName: "B2",
        missingFiles: [],
      },
      {
        extraFiles: ["clap.wav"],
        kitName: "C3",
        missingFiles: ["hihat.wav"],
      },
    ],
    errorSummary: "Found 3 kit(s) with validation errors",
    isValid: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(window.electronAPI.validateLocalStore).mockResolvedValue(
      mockValidationResult,
    );
    vi.mocked(window.electronAPI.rescanKit).mockResolvedValue({
      data: { scannedSamples: 5, updatedVoices: 2 },
      success: true,
    });
  });

  test("should handle rescan selected kits", async () => {
    // Mock validation to return valid result after rescan
    vi.mocked(window.electronAPI.validateLocalStore)
      .mockResolvedValueOnce(mockValidationResult) // Initial validation
      .mockResolvedValueOnce(mockValidationResult) // When opening dialog
      .mockResolvedValueOnce({ errors: [], errorSummary: "", isValid: true }); // After rescan

    // Mock the rescanKit API
    vi.mocked(window.electronAPI.rescanKit).mockResolvedValue({
      data: { scannedSamples: 5, updatedVoices: 2 },
      success: true,
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
    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith("A1");
    expect(window.electronAPI.rescanKit).toHaveBeenCalledWith("B2");

    // Should show success message
    expect(mockOnMessage).toHaveBeenCalledWith({
      duration: 5000,
      text: "Successfully rescanned 2 kit(s). Found 10 samples, updated 4 voices.",
      type: "success",
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
      duration: 5000,
      text: "Found 3 kit(s) with validation errors",
      type: "error",
    });

    // Check grouped errors
    expect(result.current.groupedErrors).toEqual({
      both: [
        {
          extraFiles: ["clap.wav"],
          kitName: "C3",
          missingFiles: ["hihat.wav"],
        },
      ],
      extra: [{ extraFiles: ["snare.wav"], kitName: "B2", missingFiles: [] }],
      missing: [{ extraFiles: [], kitName: "A1", missingFiles: ["kick.wav"] }],
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
    vi.mocked(window.electronAPI.rescanKit)
      .mockResolvedValueOnce({
        data: { scannedSamples: 3, updatedVoices: 1 },
        success: true,
      })
      .mockResolvedValueOnce({
        error: "Kit directory not found",
        success: false,
      });

    // Mock validation to return invalid result after failed rescan (dialog stays open)
    vi.mocked(window.electronAPI.validateLocalStore)
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
      duration: 7000,
      text: "Partially completed rescan. 1 kit(s) succeeded, 1 failed. Found 3 samples.",
      type: "warning",
    });

    // Should not close dialog on partial failure
    expect(result.current.isOpen).toBe(true);
  });
});
