import type { KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKitCreation } from "../useKitCreation";

// Mock the kit operations
vi.mock("../../../utils/kitOperations", () => ({
  createKit: vi.fn(),
  formatKitError: vi.fn((err) => `Formatted: ${err.message || err}`),
  validateKitSlot: vi.fn((slot) => /^[A-Z]\d{1,2}$/.test(slot)),
}));

// Mock getNextKitSlot
vi.mock("@romper/shared/kitUtilsShared", () => ({
  getNextKitSlot: vi.fn((kitNames) => {
    // Simple mock implementation
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const letter of letters) {
      for (let num = 0; num <= 99; num++) {
        const slot = `${letter}${num}`;
        if (!kitNames.includes(slot)) {
          return slot;
        }
      }
    }
    return null;
  }),
}));

// Mock HMR state manager
vi.mock("../../../../utils/hmrStateManager", () => ({
  markExplicitNavigation: vi.fn(),
}));

import { getNextKitSlot } from "@romper/shared/kitUtilsShared";

import { markExplicitNavigation } from "../../../../utils/hmrStateManager";
import { createKit, formatKitError } from "../../../utils/kitOperations";

const mockCreateKit = vi.mocked(createKit);
const mockFormatKitError = vi.mocked(formatKitError);
const mockGetNextKitSlot = vi.mocked(getNextKitSlot);
const mockMarkExplicitNavigation = vi.mocked(markExplicitNavigation);

describe("useKitCreation", () => {
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
    {
      alias: null,
      artist: null,
      bank_letter: "A",
      editable: false,
      locked: false,
      modified_since_sync: false,
      name: "A1",
      step_pattern: null,
      voices: [],
    },
  ];

  const defaultProps = {
    kits: mockKits,
    onMessage: vi.fn(),
    onRefreshKits: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should initialize with correct default values", () => {
      const { result } = renderHook(() => useKitCreation(defaultProps));

      expect(result.current.showNewKit).toBe(false);
      expect(result.current.newKitSlot).toBe("");
      expect(result.current.newKitError).toBeNull();
      expect(result.current.nextKitSlot).toBe("A2"); // Next available after A0, A1
    });

    it("should calculate nextKitSlot based on existing kits", () => {
      const propsWithMoreKits = {
        ...defaultProps,
        kits: [
          ...mockKits,
          { ...mockKits[0], name: "A2" },
          { ...mockKits[0], name: "A3" },
        ],
      };

      const { result } = renderHook(() => useKitCreation(propsWithMoreKits));

      expect(result.current.nextKitSlot).toBe("A4");
    });
  });

  describe("kit creation", () => {
    it("should successfully create a kit", async () => {
      mockCreateKit.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useKitCreation(defaultProps));

      act(() => {
        result.current.setNewKitSlot("B0");
      });

      await act(async () => {
        await result.current.handleCreateKit();
      });

      expect(mockCreateKit).toHaveBeenCalledWith("B0");
      expect(mockMarkExplicitNavigation).toHaveBeenCalled();
      expect(result.current.showNewKit).toBe(false);
      expect(result.current.newKitSlot).toBe("");
      expect(result.current.newKitError).toBeNull();
      expect(defaultProps.onRefreshKits).toHaveBeenCalledWith("B0");
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Kit B0 created successfully!",
        "info",
        4000
      );
    });

    it("should handle invalid kit slot", async () => {
      const { result } = renderHook(() => useKitCreation(defaultProps));

      act(() => {
        result.current.setNewKitSlot("INVALID");
      });

      await act(async () => {
        await result.current.handleCreateKit();
      });

      expect(mockCreateKit).not.toHaveBeenCalled();
      expect(result.current.newKitError).toBe(
        "Invalid kit slot. Use format A0-Z99."
      );
    });

    it("should handle kit creation error", async () => {
      const error = new Error("Creation failed");
      mockCreateKit.mockRejectedValueOnce(error);
      const { result } = renderHook(() => useKitCreation(defaultProps));

      act(() => {
        result.current.setNewKitSlot("B0");
      });

      await act(async () => {
        await result.current.handleCreateKit();
      });

      expect(mockFormatKitError).toHaveBeenCalledWith(error);
      expect(result.current.newKitError).toBe("Formatted: Creation failed");
    });
  });

  describe("next kit creation", () => {
    it("should successfully create next kit", async () => {
      mockCreateKit.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useKitCreation(defaultProps));

      await act(async () => {
        await result.current.handleCreateNextKit();
      });

      expect(mockCreateKit).toHaveBeenCalledWith("A2");
      expect(mockMarkExplicitNavigation).toHaveBeenCalled();
      expect(defaultProps.onRefreshKits).toHaveBeenCalledWith("A2");
    });

    it("should handle no next kit slot available", async () => {
      const propsWithNoNextSlot = {
        ...defaultProps,
        kits: mockKits,
      };

      // Mock getNextKitSlot to return null
      mockGetNextKitSlot.mockReturnValueOnce(null);

      const { result } = renderHook(() => useKitCreation(propsWithNoNextSlot));

      await act(async () => {
        await result.current.handleCreateNextKit();
      });

      expect(mockCreateKit).not.toHaveBeenCalled();
      expect(result.current.newKitError).toBe("No next kit slot available.");
    });

    it("should handle next kit creation error", async () => {
      const error = new Error("Next kit creation failed");
      mockCreateKit.mockRejectedValueOnce(error);
      const { result } = renderHook(() => useKitCreation(defaultProps));

      await act(async () => {
        await result.current.handleCreateNextKit();
      });

      expect(result.current.newKitError).toBe(
        "Formatted: Next kit creation failed"
      );
    });
  });

  describe("state management", () => {
    it("should allow setting and clearing new kit slot", () => {
      const { result } = renderHook(() => useKitCreation(defaultProps));

      act(() => {
        result.current.setNewKitSlot("C5");
      });
      expect(result.current.newKitSlot).toBe("C5");

      act(() => {
        result.current.setNewKitSlot("");
      });
      expect(result.current.newKitSlot).toBe("");
    });

    it("should allow toggling show new kit dialog", () => {
      const { result } = renderHook(() => useKitCreation(defaultProps));

      act(() => {
        result.current.setShowNewKit(true);
      });
      expect(result.current.showNewKit).toBe(true);

      act(() => {
        result.current.setShowNewKit(false);
      });
      expect(result.current.showNewKit).toBe(false);
    });

    it("should allow setting and clearing errors", () => {
      const { result } = renderHook(() => useKitCreation(defaultProps));

      act(() => {
        result.current.setNewKitError("Test error");
      });
      expect(result.current.newKitError).toBe("Test error");

      act(() => {
        result.current.setNewKitError(null);
      });
      expect(result.current.newKitError).toBeNull();
    });
  });

  describe("without optional callbacks", () => {
    it("should work without onMessage callback", async () => {
      const propsWithoutMessage = {
        kits: mockKits,
        onRefreshKits: vi.fn(),
      };

      mockCreateKit.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useKitCreation(propsWithoutMessage));

      act(() => {
        result.current.setNewKitSlot("B0");
      });

      await act(async () => {
        await result.current.handleCreateKit();
      });

      expect(mockCreateKit).toHaveBeenCalledWith("B0");
      // Should not throw error when onMessage is undefined
    });

    it("should work without onRefreshKits callback", async () => {
      const propsWithoutRefresh = {
        kits: mockKits,
        onMessage: vi.fn(),
      };

      mockCreateKit.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useKitCreation(propsWithoutRefresh));

      act(() => {
        result.current.setNewKitSlot("B0");
      });

      await act(async () => {
        await result.current.handleCreateKit();
      });

      expect(mockCreateKit).toHaveBeenCalledWith("B0");
      // Should not throw error when onRefreshKits is undefined
    });
  });
});
