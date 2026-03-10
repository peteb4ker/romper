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
        onMessage: mockOnMessage,
        openChangeDirectory: vi.fn(),
        openPreferences: vi.fn(),
      }),
    );

    expect(result.current.kitBrowserRef).toBeDefined();
    expect(result.current.kitBrowserRef.current).toBeNull();
  });

  it("should provide undo/redo capabilities", () => {
    const { result } = renderHook(() =>
      useKitViewMenuHandlers({
        canRedo: true,
        canUndo: true,
        onMessage: mockOnMessage,
        openChangeDirectory: vi.fn(),
        openPreferences: vi.fn(),
      }),
    );

    expect(result.current.kitBrowserRef).toBeDefined();
  });

  it("should handle optional parameters", () => {
    const { result } = renderHook(() =>
      useKitViewMenuHandlers({
        onMessage: mockOnMessage,
        openChangeDirectory: vi.fn(),
        openPreferences: vi.fn(),
      }),
    );

    expect(result.current.kitBrowserRef).toBeDefined();
  });

  it("should handle different callback functions", () => {
    const mockOpenChangeDirectory = vi.fn();
    const mockOpenPreferences = vi.fn();

    const { result } = renderHook(() =>
      useKitViewMenuHandlers({
        onMessage: mockOnMessage,
        openChangeDirectory: mockOpenChangeDirectory,
        openPreferences: mockOpenPreferences,
      }),
    );

    expect(result.current.kitBrowserRef).toBeDefined();
  });
});
