import type { KitWithRelations } from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../../../tests/factories/kit.factory";
import { useKitCreation } from "../useKitCreation";

// Mock the kit operations
vi.mock("../../../utils/kitOperations", () => ({
  createKit: vi.fn(),
  formatKitError: vi.fn((err) => `Formatted: ${err.message || err}`),
  validateKitSlot: vi.fn((slot) => /^[A-Z]\d{1,2}$/.test(slot)),
}));

// Mock getNextSlotInBank
vi.mock("@romper/shared/kitUtilsShared", () => ({
  getNextSlotInBank: vi.fn((bankLetter, existingNames) => {
    for (let num = 0; num <= 99; num++) {
      const slot = `${bankLetter}${num}`;
      if (!existingNames.includes(slot)) return slot;
    }
    return null;
  }),
}));

// Mock HMR state manager
vi.mock("../../../../utils/hmrStateManager", () => ({
  markExplicitNavigation: vi.fn(),
}));

import { markExplicitNavigation } from "../../../../utils/hmrStateManager";
import { createKit, formatKitError } from "../../../utils/kitOperations";

const mockCreateKit = vi.mocked(createKit);
const mockFormatKitError = vi.mocked(formatKitError);
const mockMarkExplicitNavigation = vi.mocked(markExplicitNavigation);

describe("useKitCreation", () => {
  const mockKits: KitWithRelations[] = [
    createMockKitWithRelations({ name: "A0" }),
    createMockKitWithRelations({ name: "A1" }),
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
    it("should initialize with isCreatingKit as false", () => {
      const { result } = renderHook(() => useKitCreation(defaultProps));

      expect(result.current.isCreatingKit).toBe(false);
    });
  });

  describe("[UC-14] handleCreateKitInBank", () => {
    it("[Q-01] passes on the kit main returned (#452)", async () => {
      const created = createMockKitWithRelations({ name: "A2" });
      mockCreateKit.mockResolvedValueOnce(created);
      const { result } = renderHook(() => useKitCreation(defaultProps));

      await act(async () => {
        await result.current.handleCreateKitInBank("A");
      });

      expect(defaultProps.onRefreshKits).toHaveBeenCalledWith("A2", created);
    });

    it("should create a kit in the next available slot for the bank", async () => {
      mockCreateKit.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useKitCreation(defaultProps));

      await act(async () => {
        await result.current.handleCreateKitInBank("A");
      });

      expect(mockCreateKit).toHaveBeenCalledWith("A2");
      expect(mockMarkExplicitNavigation).toHaveBeenCalled();
      expect(defaultProps.onRefreshKits).toHaveBeenCalledWith("A2", undefined);
      // Success feedback is now handled by entrance animation, not toast
      expect(result.current.newlyCreatedKit).toBe("A2");
      expect(result.current.isCreatingKit).toBe(false);
    });

    it("should create first kit in empty bank", async () => {
      mockCreateKit.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useKitCreation(defaultProps));

      await act(async () => {
        await result.current.handleCreateKitInBank("B");
      });

      expect(mockCreateKit).toHaveBeenCalledWith("B0");
      expect(defaultProps.onRefreshKits).toHaveBeenCalledWith("B0", undefined);
    });

    it("should show warning when bank is full", async () => {
      const fullBankKits = Array.from({ length: 100 }, (_, i) =>
        createMockKitWithRelations({ name: `A${i}` }),
      );

      const { result } = renderHook(() =>
        useKitCreation({ ...defaultProps, kits: fullBankKits }),
      );

      await act(async () => {
        await result.current.handleCreateKitInBank("A");
      });

      expect(mockCreateKit).not.toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Bank A is full",
        "warning",
        4000,
      );
    });

    it("should handle creation error", async () => {
      const error = new Error("Creation failed");
      mockCreateKit.mockRejectedValueOnce(error);
      const { result } = renderHook(() => useKitCreation(defaultProps));

      await act(async () => {
        await result.current.handleCreateKitInBank("A");
      });

      expect(mockFormatKitError).toHaveBeenCalledWith(error);
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Formatted: Creation failed",
        "error",
        5000,
      );
      expect(result.current.isCreatingKit).toBe(false);
    });

    it("should work without onMessage callback", async () => {
      const propsWithoutMessage = {
        kits: mockKits,
        onRefreshKits: vi.fn(),
      };

      mockCreateKit.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useKitCreation(propsWithoutMessage));

      await act(async () => {
        await result.current.handleCreateKitInBank("A");
      });

      expect(mockCreateKit).toHaveBeenCalledWith("A2");
    });

    it("should work without onRefreshKits callback", async () => {
      const propsWithoutRefresh = {
        kits: mockKits,
        onMessage: vi.fn(),
      };

      mockCreateKit.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useKitCreation(propsWithoutRefresh));

      await act(async () => {
        await result.current.handleCreateKitInBank("A");
      });

      expect(mockCreateKit).toHaveBeenCalledWith("A2");
    });
  });

  describe("[UC-14] first kit in an empty library or bank (RE-64)", () => {
    it("creates A0 when the library has no kits", async () => {
      mockCreateKit.mockResolvedValueOnce(undefined);
      const onRefreshKits = vi.fn();
      const { result } = renderHook(() =>
        useKitCreation({ kits: [], onMessage: vi.fn(), onRefreshKits }),
      );

      await act(async () => {
        await result.current.handleCreateKitInBank("A");
      });

      expect(mockCreateKit).toHaveBeenCalledWith("A0");
      expect(onRefreshKits).toHaveBeenCalledWith("A0", undefined);
      expect(result.current.newlyCreatedKit).toBe("A0");
    });

    it("creates the first slot of a bank after the last one with kits", async () => {
      mockCreateKit.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useKitCreation(defaultProps));

      await act(async () => {
        await result.current.handleCreateKitInBank("Z");
      });

      expect(mockCreateKit).toHaveBeenCalledWith("Z0");
      expect(defaultProps.onRefreshKits).toHaveBeenCalledWith("Z0", undefined);
    });
  });
});
