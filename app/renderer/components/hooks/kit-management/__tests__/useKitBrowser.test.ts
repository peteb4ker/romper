import type { KitWithRelations } from "@romper/shared/db/schema";

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useKitBrowser } from "../useKitBrowser";

// Mock the composed hooks
vi.mock("../useKitErrorHandling", () => ({
  useKitErrorHandling: vi.fn(() => ({
    clearAllErrors: vi.fn(),
    clearError: vi.fn(),
    clearSdCardWarning: vi.fn(),
    error: null,
    sdCardWarning: null,
    setError: vi.fn(),
    setSdCardWarning: vi.fn(),
  })),
}));

vi.mock("../useKitCreation", () => ({
  useKitCreation: vi.fn(() => ({
    handleCreateKit: vi.fn(),
    handleCreateNextKit: vi.fn(),
    newKitError: null,
    newKitSlot: "",
    nextKitSlot: "A0",
    setNewKitError: vi.fn(),
    setNewKitSlot: vi.fn(),
    setShowNewKit: vi.fn(),
    showNewKit: false,
  })),
}));

vi.mock("../useKitDuplication", () => ({
  useKitDuplication: vi.fn(() => ({
    duplicateKitDest: "",
    duplicateKitError: null,
    duplicateKitSource: null,
    handleDuplicateKit: vi.fn(),
    setDuplicateKitDest: vi.fn(),
    setDuplicateKitError: vi.fn(),
    setDuplicateKitSource: vi.fn(),
  })),
}));

vi.mock("../useKitBankNavigation", () => ({
  useKitBankNavigation: vi.fn(() => ({
    bankNames: {},
    focusBankInKitList: vi.fn(),
    focusedKit: null,
    globalBankHotkeyHandler: vi.fn(),
    handleBankClick: vi.fn(),
    handleBankClickWithScroll: vi.fn(),
    handleVisibleBankChange: vi.fn(),
    scrollContainerRef: { current: null },
    selectedBank: "A",
    setBankNames: vi.fn(),
    setFocusedKit: vi.fn(),
    setSelectedBank: vi.fn(),
  })),
}));

describe("useKitBrowser", () => {
  const mockKits: KitWithRelations[] = [
    {
      alias: null,
      artist: null,
      bank_letter: "A",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "A0",
      step_pattern: null,
      voices: [],
    },
  ];

  const defaultProps = {
    kitListRef: { current: null },
    kits: mockKits,
    onMessage: vi.fn(),
    onRefreshKits: vi.fn(),
  };

  it("should compose all hooks and return expected interface", () => {
    const { result } = renderHook(() => useKitBrowser(defaultProps));

    // Check that all expected properties are present
    // From errorHandling
    expect(result.current.error).toBeDefined();
    expect(result.current.sdCardWarning).toBeDefined();
    expect(result.current.setError).toBeDefined();
    expect(result.current.setSdCardWarning).toBeDefined();

    // From kitCreation
    expect(result.current.showNewKit).toBeDefined();
    expect(result.current.newKitSlot).toBeDefined();
    expect(result.current.newKitError).toBeDefined();
    expect(result.current.nextKitSlot).toBeDefined();
    expect(result.current.setShowNewKit).toBeDefined();
    expect(result.current.setNewKitSlot).toBeDefined();
    expect(result.current.setNewKitError).toBeDefined();
    expect(result.current.handleCreateKit).toBeDefined();
    expect(result.current.handleCreateNextKit).toBeDefined();

    // From kitDuplication
    expect(result.current.duplicateKitSource).toBeDefined();
    expect(result.current.duplicateKitDest).toBeDefined();
    expect(result.current.duplicateKitError).toBeDefined();
    expect(result.current.setDuplicateKitSource).toBeDefined();
    expect(result.current.setDuplicateKitDest).toBeDefined();
    expect(result.current.setDuplicateKitError).toBeDefined();
    expect(result.current.handleDuplicateKit).toBeDefined();

    // From bankNavigation
    expect(result.current.selectedBank).toBeDefined();
    expect(result.current.focusedKit).toBeDefined();
    expect(result.current.bankNames).toBeDefined();
    expect(result.current.scrollContainerRef).toBeDefined();
    expect(result.current.setSelectedBank).toBeDefined();
    expect(result.current.setFocusedKit).toBeDefined();
    expect(result.current.setBankNames).toBeDefined();
    expect(result.current.handleBankClick).toBeDefined();
    expect(result.current.handleBankClickWithScroll).toBeDefined();
    expect(result.current.focusBankInKitList).toBeDefined();
    expect(result.current.globalBankHotkeyHandler).toBeDefined();
    expect(result.current.handleVisibleBankChange).toBeDefined();

    // Pass-through kits
    expect(result.current.kits).toBe(mockKits);
  });

  it("should pass correct props to composed hooks", async () => {
    const { useKitCreation } = await import("../useKitCreation");
    const { useKitDuplication } = await import("../useKitDuplication");
    const { useKitBankNavigation } = await import("../useKitBankNavigation");

    renderHook(() => useKitBrowser(defaultProps));

    // Check useKitCreation was called with correct props
    expect(useKitCreation).toHaveBeenCalledWith({
      kits: mockKits,
      onMessage: defaultProps.onMessage,
      onRefreshKits: defaultProps.onRefreshKits,
    });

    // Check useKitDuplication was called with correct props
    expect(useKitDuplication).toHaveBeenCalledWith({
      onRefreshKits: defaultProps.onRefreshKits,
    });

    // Check useKitBankNavigation was called with correct props
    expect(useKitBankNavigation).toHaveBeenCalledWith({
      kitListRef: defaultProps.kitListRef,
      kits: mockKits,
    });
  });

  it("should handle empty kits array", () => {
    const emptyProps = { ...defaultProps, kits: [] };
    const { result } = renderHook(() => useKitBrowser(emptyProps));

    expect(result.current.kits).toEqual([]);
  });

  it("should handle undefined kits with default empty array", () => {
    const propsWithoutKits = {
      kitListRef: { current: null },
      onMessage: vi.fn(),
      onRefreshKits: vi.fn(),
    };

    // @ts-expect-error Testing runtime behavior with partial props
    const { result } = renderHook(() => useKitBrowser(propsWithoutKits));

    expect(result.current.kits).toEqual([]);
  });
});
