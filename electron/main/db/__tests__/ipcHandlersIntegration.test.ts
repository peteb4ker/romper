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
  getAllSamples: vi.fn(),
  getFavoriteKits: vi.fn(),
  getFavoriteKitsCount: vi.fn(),
  getKit: vi.fn(),
  getKits: vi.fn(),
  getKitSamples: vi.fn(),
  getKitsMetadata: vi.fn(),
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

  describe("getKitsMetadata IPC Handler", () => {
    test("should handle get-kits-metadata successfully with serializable data", async () => {
      // Setup realistic kit metadata that avoids circular references
      const mockKitsMetadata = [
        {
          alias: null,
          bank_letter: "A",
          bpm: 120,
          created_at: "2023-01-01T00:00:00.000Z",
          editable: true,
          is_favorite: false,
          name: "A0",
          step_pattern: null,
          updated_at: "2023-01-01T00:00:00.000Z",
        },
        {
          alias: "My Kit",
          bank_letter: "A",
          bpm: 140,
          created_at: "2023-01-02T00:00:00.000Z",
          editable: false,
          is_favorite: true,
          name: "A1",
          step_pattern: [[1, 0, 1, 0]],
          updated_at: "2023-01-02T00:00:00.000Z",
        },
      ];

      vi.mocked(romperDbCoreORM.getKitsMetadata).mockReturnValue(
        mockKitsMetadata,
      );

      // Register handlers
      registerDbIpcHandlers(mockInMemorySettings);

      // Get and invoke the handler
      const handler = mockIpcHandlers.get("get-kits-metadata");
      expect(handler).toBeDefined();

      const mockEvent = {};
      const result = await handler(mockEvent);

      expect(romperDbCoreORM.getKitsMetadata).toHaveBeenCalledWith(mockDbDir);
      expect(result).toEqual(mockKitsMetadata);

      // Verify data is serializable (no circular references)
      expect(() => JSON.stringify(result)).not.toThrow();

      // Verify no bank relation objects that cause IPC serialization issues
      result.forEach((kit: any) => {
        expect(kit).not.toHaveProperty("bank");
        expect(kit.bank_letter).toBeDefined(); // Only the bank letter, not the relation
      });
    });

    test("should handle database errors gracefully", async () => {
      vi.mocked(romperDbCoreORM.getKitsMetadata).mockReturnValue({
        error: "Database connection failed",
        success: false,
      });

      registerDbIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("get-kits-metadata");

      const result = await handler({});

      expect(result).toEqual({
        error: "Database connection failed",
        success: false,
      });
    });
  });

  describe("Favorites IPC Handlers", () => {
    beforeEach(() => {
      registerFavoritesIpcHandlers(mockInMemorySettings);
    });

    test("should handle toggle-kit-favorite successfully", async () => {
      const mockResult = { isFavorite: true };
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

    test("should handle get-favorite-kits successfully", async () => {
      const mockFavoriteKits = [
        {
          bank: null,
          bank_letter: "A",
          is_favorite: true,
          name: "A0",
          samples: [],
          voices: [],
        },
      ];
      vi.mocked(romperDbCoreORM.getFavoriteKits).mockReturnValue(
        mockFavoriteKits,
      );

      const handler = mockIpcHandlers.get("get-favorite-kits");

      const result = await handler({});

      expect(romperDbCoreORM.getFavoriteKits).toHaveBeenCalledWith(mockDbDir);
      expect(result).toEqual(mockFavoriteKits);

      // Verify serializable structure
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    test("should handle get-favorite-kits-count successfully", async () => {
      vi.mocked(romperDbCoreORM.getFavoriteKitsCount).mockReturnValue(3);

      const handler = mockIpcHandlers.get("get-favorite-kits-count");

      const result = await handler({});

      expect(romperDbCoreORM.getFavoriteKitsCount).toHaveBeenCalledWith(
        mockDbDir,
      );
      expect(result).toEqual(3);
    });
  });

  describe("updateKit IPC Handler", () => {
    test("should handle update-kit-metadata successfully", async () => {
      vi.mocked(romperDbCoreORM.updateKit).mockReturnValue(undefined);

      registerDbIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("update-kit-metadata");

      const updates = {
        alias: "Updated Kit",
        description: "New description",
      };

      const result = await handler({}, "A0", updates);

      expect(romperDbCoreORM.updateKit).toHaveBeenCalledWith(
        mockDbDir,
        "A0",
        updates,
      );
      expect(result).toEqual(undefined);
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

  describe("Handler Error Handling", () => {
    test("should handle synchronous database errors in handlers", async () => {
      vi.mocked(romperDbCoreORM.getKitsMetadata).mockImplementation(() => {
        throw new Error("Synchronous database error");
      });

      registerDbIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("get-kits-metadata");

      // The handler doesn't catch errors, so they propagate up
      await expect(handler({})).rejects.toThrow("Synchronous database error");
    });

    test("should handle database result errors in handlers", async () => {
      vi.mocked(romperDbCoreORM.getFavoriteKitsCount).mockReturnValue({
        error: "Database query failed",
        success: false,
      });

      registerFavoritesIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("get-favorite-kits-count");

      const result = await handler({});

      expect(result).toEqual({
        error: "Database query failed",
        success: false,
      });
    });
  });

  describe("IPC Serialization", () => {
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

      vi.mocked(romperDbCoreORM.getKitsMetadata).mockReturnValue(mockKitsData);

      registerDbIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("get-kits-metadata");

      const result = await handler({});

      // This should not throw - verifies no circular references
      expect(() => JSON.stringify(result)).not.toThrow();

      // Verify the serialized data can be parsed back
      const serialized = JSON.stringify(result);
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(mockKitsData);
    });

    test("should handle complex data structures without circular references", async () => {
      const mockFavoriteKits = [
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

      vi.mocked(romperDbCoreORM.getFavoriteKits).mockReturnValue(
        mockFavoriteKits,
      );

      registerFavoritesIpcHandlers(mockInMemorySettings);
      const handler = mockIpcHandlers.get("get-favorite-kits");

      const result = await handler({});

      // Verify serialization works with complex nested structures
      expect(() => JSON.stringify(result)).not.toThrow();
      expect(result[0].bank).toBeNull();
      expect(result[0].samples).toEqual([]);
      expect(result[0].voices).toEqual([]);
    });
  });
});
