import type { KitWithRelations } from "@romper/shared/db/schema.js";

import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock electron ipcMain
const mockIpcHandlers = new Map();
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn().mockImplementation((channel, handler) => {
      mockIpcHandlers.set(channel, handler);
    }),
  },
}));

// Mock database operations with realistic responses
vi.mock("../romperDbCoreORM.js", () => ({
  addKit: vi.fn(),
  addSample: vi.fn(),
  createRomperDbFile: vi.fn(),
  deleteSamples: vi.fn(),
  getAllBanks: vi.fn(),
  getKit: vi.fn(),
  getKits: vi.fn(),
  getKitSamples: vi.fn(),
  toggleKitFavorite: vi.fn(),
  updateKit: vi.fn(),
  updateVoiceAlias: vi.fn(),
}));

import { registerDbIpcHandlers } from "../../dbIpcHandlers.js";
import { registerFavoritesIpcHandlers } from "../favoritesIpcHandlers.js";
import * as romperDbCoreORM from "../romperDbCoreORM.js";

describe("IPC Handlers Integration Tests", () => {
  const mockInMemorySettings = {
    databaseDirectory: "/test/db",
    localStorePath: "/test/local/store",
  };
  const mockDbDir = "/test/local/store/.romperdb"; // Actual computed path

  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcHandlers.clear();
  });

  describe("Favorites IPC Handlers", () => {
    beforeEach(() => {
      registerFavoritesIpcHandlers(mockInMemorySettings);
    });

    test("should handle toggle-kit-favorite successfully", async () => {
      const mockResult = { data: { isFavorite: true }, success: true };
      vi.mocked(romperDbCoreORM.toggleKitFavorite).mockReturnValue(mockResult);

      const handler = mockIpcHandlers.get("toggle-kit-favorite");
      expect(handler).toBeDefined();

      const result = await handler({}, "A0");

      expect(romperDbCoreORM.toggleKitFavorite).toHaveBeenCalledWith(
        mockDbDir,
        "A0",
      );
      expect(result).toEqual(mockResult);
    });

    test("should handle toggle-kit-favorite error", async () => {
      vi.mocked(romperDbCoreORM.toggleKitFavorite).mockImplementation(() => {
        throw new Error("Kit 'NonExistent' not found");
      });

      const handler = mockIpcHandlers.get("toggle-kit-favorite");

      // The handler doesn't catch errors, so they propagate up
      await expect(handler({}, "NonExistent")).rejects.toThrow(
        "Kit 'NonExistent' not found",
      );
    });

    test("[Q-03] no longer registers the favorites read channels", () => {
      registerDbIpcHandlers(mockInMemorySettings);

      expect(mockIpcHandlers.has("get-favorite-kits")).toBe(false);
      expect(mockIpcHandlers.has("get-favorite-kits-count")).toBe(false);
      expect(mockIpcHandlers.has("get-kits-metadata")).toBe(false);
    });
  });

  describe("updateKit IPC Handler", () => {
    test("should handle update-kit-metadata successfully", async () => {
      vi.mocked(romperDbCoreORM.updateKit).mockReturnValue({ success: true });

      registerDbIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("update-kit-metadata");

      const updates = { alias: "Updated Kit", editable: true };

      const result = await handler({}, "A0", updates);

      expect(romperDbCoreORM.updateKit).toHaveBeenCalledWith(
        mockDbDir,
        "A0",
        updates,
      );
      expect(result).toEqual({ success: true });
    });

    test("[Q-02] refuses fields other than alias and editable (RE-22)", async () => {
      registerDbIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("update-kit-metadata");

      const result = await handler({}, "A0", {
        alias: "Updated Kit",
        description: "New description",
      });

      expect(result).toEqual({
        error: "Kit details can't change description",
        success: false,
      });
      expect(romperDbCoreORM.updateKit).not.toHaveBeenCalled();
    });

    test("should handle update-kit-metadata error when kit not found", async () => {
      vi.mocked(romperDbCoreORM.updateKit).mockImplementation(() => {
        throw new Error("Kit 'NonExistent' not found");
      });

      registerDbIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("update-kit-metadata");

      // The handler doesn't catch errors, so they propagate up
      await expect(
        handler({}, "NonExistent", { alias: "Test" }),
      ).rejects.toThrow("Kit 'NonExistent' not found");
    });
  });

  describe("Handler Error Handling [Q-03]", () => {
    test("should handle synchronous database errors in handlers", async () => {
      vi.mocked(romperDbCoreORM.getKits).mockImplementation(() => {
        throw new Error("Synchronous database error");
      });

      registerDbIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("get-all-kits");

      // The handler doesn't catch errors, so they propagate up
      await expect(handler({})).rejects.toThrow("Synchronous database error");
    });

    test("should handle database result errors in handlers", async () => {
      vi.mocked(romperDbCoreORM.getKit).mockReturnValue({
        error: "Database query failed",
        success: false,
      });

      registerDbIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("get-kit");

      const result = await handler({}, "A0");

      expect(romperDbCoreORM.getKit).toHaveBeenCalledWith(mockDbDir, "A0");

      expect(result).toEqual({
        error: "Database query failed",
        success: false,
      });
    });
  });

  describe("IPC Serialization [Q-03]", () => {
    test("should ensure all handler responses are JSON serializable", async () => {
      // Test data that includes various types
      const mockKitsData = [
        {
          bank_letter: "A",
          bpm: 120,
          created_at: "2023-01-01T00:00:00.000Z",
          is_favorite: false,
          name: "A0",
          step_pattern: [
            [1, 0, 1, 0],
            [0, 1, 0, 1],
          ],
          updated_at: "2023-01-01T00:00:00.000Z",
        },
      ];

      vi.mocked(romperDbCoreORM.getKits).mockReturnValue({
        data: mockKitsData as unknown as KitWithRelations[],
        success: true,
      });

      registerDbIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("get-all-kits");

      const result = await handler({});

      // This should not throw - verifies no circular references
      expect(() => JSON.stringify(result)).not.toThrow();

      // Verify the serialized data can be parsed back
      const serialized = JSON.stringify(result);
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual({ data: mockKitsData, success: true });
    });

    test("should handle complex data structures without circular references", async () => {
      const mockKits = [
        {
          bank: null, // Explicit null instead of relation object
          bank_letter: "A",
          is_favorite: true,
          name: "A0",
          samples: [], // Empty array instead of populated samples
          step_pattern: [
            [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
            [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
          ],
          voices: [], // Empty array instead of populated voices
        },
      ];

      vi.mocked(romperDbCoreORM.getKits).mockReturnValue({
        data: mockKits as unknown as KitWithRelations[],
        success: true,
      });

      registerDbIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("get-all-kits");

      const result = await handler({});

      // Verify serialization works with complex nested structures
      expect(() => JSON.stringify(result)).not.toThrow();
      expect(result.data[0].bank).toBeNull();
      expect(result.data[0].samples).toEqual([]);
      expect(result.data[0].voices).toEqual([]);
    });
  });
});
