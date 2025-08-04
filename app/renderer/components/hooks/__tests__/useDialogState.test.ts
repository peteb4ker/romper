import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDialogState } from "../useDialogState";

describe("useDialogState", () => {
  it("should initialize with all dialogs closed", () => {
    const { result } = renderHook(() => useDialogState());

    expect(result.current.showWizard).toBe(false);
    expect(result.current.showChangeDirectoryDialog).toBe(false);
    expect(result.current.showPreferencesDialog).toBe(false);
  });

  it("should open and close wizard dialog", () => {
    const { result } = renderHook(() => useDialogState());

    // Open wizard
    act(() => {
      result.current.openWizard();
    });
    expect(result.current.showWizard).toBe(true);

    // Close wizard
    act(() => {
      result.current.closeWizard();
    });
    expect(result.current.showWizard).toBe(false);
  });

  it("should open and close change directory dialog", () => {
    const { result } = renderHook(() => useDialogState());

    // Open change directory
    act(() => {
      result.current.openChangeDirectory();
    });
    expect(result.current.showChangeDirectoryDialog).toBe(true);

    // Close change directory
    act(() => {
      result.current.closeChangeDirectory();
    });
    expect(result.current.showChangeDirectoryDialog).toBe(false);
  });

  it("should open and close preferences dialog", () => {
    const { result } = renderHook(() => useDialogState());

    // Open preferences
    act(() => {
      result.current.openPreferences();
    });
    expect(result.current.showPreferencesDialog).toBe(true);

    // Close preferences
    act(() => {
      result.current.closePreferences();
    });
    expect(result.current.showPreferencesDialog).toBe(false);
  });

  it("should handle multiple dialogs independently", () => {
    const { result } = renderHook(() => useDialogState());

    // Open all dialogs
    act(() => {
      result.current.openWizard();
      result.current.openChangeDirectory();
      result.current.openPreferences();
    });

    expect(result.current.showWizard).toBe(true);
    expect(result.current.showChangeDirectoryDialog).toBe(true);
    expect(result.current.showPreferencesDialog).toBe(true);

    // Close only wizard
    act(() => {
      result.current.closeWizard();
    });

    expect(result.current.showWizard).toBe(false);
    expect(result.current.showChangeDirectoryDialog).toBe(true);
    expect(result.current.showPreferencesDialog).toBe(true);
  });

  it("should handle setters directly", () => {
    const { result } = renderHook(() => useDialogState());

    // Use setters
    act(() => {
      result.current.setShowWizard(true);
      result.current.setShowChangeDirectoryDialog(true);
      result.current.setShowPreferencesDialog(true);
    });

    expect(result.current.showWizard).toBe(true);
    expect(result.current.showChangeDirectoryDialog).toBe(true);
    expect(result.current.showPreferencesDialog).toBe(true);

    // Toggle off
    act(() => {
      result.current.setShowWizard(false);
    });

    expect(result.current.showWizard).toBe(false);
  });

  it("should maintain stable function references", () => {
    const { rerender, result } = renderHook(() => useDialogState());

    const firstOpenWizard = result.current.openWizard;
    const firstCloseWizard = result.current.closeWizard;

    // Rerender
    rerender();

    expect(result.current.openWizard).toBe(firstOpenWizard);
    expect(result.current.closeWizard).toBe(firstCloseWizard);
  });
});
