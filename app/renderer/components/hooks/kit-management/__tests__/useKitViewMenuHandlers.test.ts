import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKitViewMenuHandlers } from "../useKitViewMenuHandlers";

// Mock the dependencies
vi.mock("../useBankScanning", () => ({
  useBankScanning: vi.fn(() => ({
    scanBanks: vi.fn(),
  })),
}));

vi.mock("../useMenuEvents", () => ({
  useMenuEvents: vi.fn(),
}));

vi.mock("../useValidationResults", () => ({
  useValidationResults: vi.fn(() => ({
    openValidationDialog: vi.fn(),
  })),
}));

describe("useKitViewMenuHandlers", () => {
  const mockOnMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with required handlers", () => {
    const { result } = renderHook(() =>
      useKitViewMenuHandlers({
        canRedo: false,
        canUndo: false,
        localStorePath: "/test/path",
        onMessage: mockOnMessage,
        openChangeDirectory: vi.fn(),
        openPreferences: vi.fn(),
        openWizard: vi.fn(),
      })
    );

    expect(result.current.kitBrowserRef).toBeDefined();
    expect(result.current.kitBrowserRef.current).toBeNull();
    expect(result.current.openValidationDialog).toBeDefined();
  });

  it("should handle null localStorePath", () => {
    const { result } = renderHook(() =>
      useKitViewMenuHandlers({
        localStorePath: null,
        onMessage: mockOnMessage,
        openChangeDirectory: vi.fn(),
        openPreferences: vi.fn(),
        openWizard: vi.fn(),
      })
    );

    expect(result.current.kitBrowserRef).toBeDefined();
    expect(result.current.openValidationDialog).toBeDefined();
  });

  it("should provide undo/redo capabilities", () => {
    const { result } = renderHook(() =>
      useKitViewMenuHandlers({
        canRedo: true,
        canUndo: true,
        localStorePath: "/test/path",
        onMessage: mockOnMessage,
        openChangeDirectory: vi.fn(),
        openPreferences: vi.fn(),
        openWizard: vi.fn(),
      })
    );

    expect(result.current.kitBrowserRef).toBeDefined();
  });

  it("should handle optional parameters", () => {
    const { result } = renderHook(() =>
      useKitViewMenuHandlers({
        localStorePath: "/test/path",
        onMessage: mockOnMessage,
        openChangeDirectory: vi.fn(),
        openPreferences: vi.fn(),
        openWizard: vi.fn(),
      })
    );

    expect(result.current.kitBrowserRef).toBeDefined();
    expect(result.current.openValidationDialog).toBeDefined();
  });

  it("should handle different localStorePath values", () => {
    const { result: result1 } = renderHook(() =>
      useKitViewMenuHandlers({
        localStorePath: "/path1",
        onMessage: mockOnMessage,
        openChangeDirectory: vi.fn(),
        openPreferences: vi.fn(),
        openWizard: vi.fn(),
      })
    );

    const { result: result2 } = renderHook(() =>
      useKitViewMenuHandlers({
        localStorePath: "/path2",
        onMessage: mockOnMessage,
        openChangeDirectory: vi.fn(),
        openPreferences: vi.fn(),
        openWizard: vi.fn(),
      })
    );

    expect(result1.current.kitBrowserRef).toBeDefined();
    expect(result2.current.kitBrowserRef).toBeDefined();
  });

  it("should handle different callback functions", () => {
    const mockOpenWizard = vi.fn();
    const mockOpenChangeDirectory = vi.fn();
    const mockOpenPreferences = vi.fn();

    const { result } = renderHook(() =>
      useKitViewMenuHandlers({
        localStorePath: "/test/path",
        onMessage: mockOnMessage,
        openChangeDirectory: mockOpenChangeDirectory,
        openPreferences: mockOpenPreferences,
        openWizard: mockOpenWizard,
      })
    );

    expect(result.current.kitBrowserRef).toBeDefined();
    expect(result.current.openValidationDialog).toBeDefined();
  });
});
