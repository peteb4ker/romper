import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBankScanning } from "../../shared/useBankScanning";
import { useMenuEvents } from "../../shared/useMenuEvents";
import { useKitViewMenuHandlers } from "../useKitViewMenuHandlers";

// Mock the dependencies
vi.mock("../../shared/useBankScanning", () => ({
  useBankScanning: vi.fn(() => ({
    scanBanks: vi.fn(),
  })),
}));

vi.mock("../../shared/useMenuEvents", () => ({
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

  describe("Scan All", () => {
    const scanBanks = vi.fn().mockResolvedValue(undefined);
    const handleScanAllKits = vi.fn();

    const triggerScanAll = async () => {
      vi.mocked(useBankScanning).mockReturnValue({ scanBanks } as never);
      const { result } = renderHook(() =>
        useKitViewMenuHandlers({
          onMessage: mockOnMessage,
          openChangeDirectory: vi.fn(),
          openPreferences: vi.fn(),
        }),
      );
      result.current.kitBrowserRef.current = { handleScanAllKits } as never;

      const handlers = vi.mocked(useMenuEvents).mock.calls.at(-1)![0];
      handlers.onScanAll?.();
      await Promise.resolve();
    };

    it("asks for confirmation and does nothing when declined", async () => {
      const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(false);

      await triggerScanAll();

      expect(confirm).toHaveBeenCalledWith(
        expect.stringContaining("every kit"),
      );
      expect(scanBanks).not.toHaveBeenCalled();
      expect(handleScanAllKits).not.toHaveBeenCalled();
      confirm.mockRestore();
    });

    it("scans banks, then every kit, once confirmed", async () => {
      const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(true);

      await triggerScanAll();

      expect(scanBanks).toHaveBeenCalledTimes(1);
      expect(handleScanAllKits).toHaveBeenCalledTimes(1);
      confirm.mockRestore();
    });
  });
});
