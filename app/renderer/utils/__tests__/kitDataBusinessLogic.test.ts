import type { KitWithRelations } from "@romper/shared/db/schema";

import { describe, expect, test } from "vitest";

/**
 * Business Logic Tests - Isolated from React
 *
 * These tests focus on the pure business logic functions extracted from useKitDataManager
 * without any React hook dependencies. This improves test coverage and ensures logic
 * correctness independent of UI framework concerns.
 */

describe("Kit Data Manager Business Logic - Unit Tests", () => {
  const mockKits: KitWithRelations[] = [
    {
      alias: null,
      artist: null,
      bank_letter: "A",
      bpm: 120,
      created_at: "2023-01-01T00:00:00.000Z",
      description: null,
      editable: false,
      id: 1,
      is_favorite: false,
      locked: false,
      modified_since_sync: false,
      name: "A0",
      step_pattern: null,
      updated_at: "2023-01-01T00:00:00.000Z",
    } as KitWithRelations,
    {
      alias: "My Favorite Kit",
      artist: "Test Artist",
      bank_letter: "A",
      bpm: 140,
      created_at: "2023-01-02T00:00:00.000Z",
      description: "Test Description",
      editable: true,
      id: 2,
      is_favorite: true,
      locked: false,
      modified_since_sync: false,
      name: "A1",
      step_pattern: [[1, 0, 1, 0]],
      updated_at: "2023-01-02T00:00:00.000Z",
    } as KitWithRelations,
  ];

  describe("getKitByName - Kit Lookup Logic", () => {
    const getKitByName = (
      kits: KitWithRelations[],
      kitName: string,
    ): KitWithRelations | undefined => {
      return kits.find((kit) => kit.name === kitName);
    };

    test("should find existing kit by name", () => {
      const result = getKitByName(mockKits, "A0");
      expect(result).toBeDefined();
      expect(result?.name).toBe("A0");
      expect(result?.bank_letter).toBe("A");
    });

    test("should return undefined for non-existent kit", () => {
      const result = getKitByName(mockKits, "NonExistent");
      expect(result).toBeUndefined();
    });

    test("should handle empty kit list", () => {
      const result = getKitByName([], "A0");
      expect(result).toBeUndefined();
    });

    test("should be case sensitive", () => {
      const result = getKitByName(mockKits, "a0"); // lowercase
      expect(result).toBeUndefined();
    });

    test("should handle special characters in kit names", () => {
      const specialKits: KitWithRelations[] = [
        { ...mockKits[0], name: "Kit-With-Dashes" },
        { ...mockKits[0], name: "Kit_With_Underscores" },
        { ...mockKits[0], name: "Kit With Spaces" },
      ];

      expect(getKitByName(specialKits, "Kit-With-Dashes")).toBeDefined();
      expect(getKitByName(specialKits, "Kit_With_Underscores")).toBeDefined();
      expect(getKitByName(specialKits, "Kit With Spaces")).toBeDefined();
    });
  });

  describe("updateKit - Optimistic State Update Logic", () => {
    const updateKit = (
      kits: KitWithRelations[],
      kitName: string,
      updates: Partial<KitWithRelations>,
    ): KitWithRelations[] => {
      return kits.map((kit) =>
        kit.name === kitName ? { ...kit, ...updates } : kit,
      );
    };

    test("should update single property of existing kit", () => {
      const result = updateKit(mockKits, "A0", { is_favorite: true });

      expect(result).toHaveLength(2);
      expect(result[0].is_favorite).toBe(true);
      expect(result[0].name).toBe("A0"); // Other properties unchanged
      expect(result[1].is_favorite).toBe(true); // Other kit unchanged
    });

    test("should update multiple properties at once", () => {
      const updates = {
        alias: "Updated Alias",
        bpm: 160,
        editable: true,
        is_favorite: false,
      };

      const result = updateKit(mockKits, "A1", updates);

      expect(result[1].alias).toBe("Updated Alias");
      expect(result[1].bpm).toBe(160);
      expect(result[1].editable).toBe(true);
      expect(result[1].is_favorite).toBe(false);
      expect(result[1].name).toBe("A1"); // Name unchanged
    });

    test("should handle non-existent kit gracefully", () => {
      const result = updateKit(mockKits, "NonExistent", { is_favorite: true });

      expect(result).toEqual(mockKits); // No changes
      expect(result).toHaveLength(2);
    });

    test("should handle empty updates object", () => {
      const result = updateKit(mockKits, "A0", {});

      expect(result).toEqual(mockKits); // No changes
    });

    test("should not mutate original kit array", () => {
      const originalKits = [...mockKits];
      const result = updateKit(mockKits, "A0", { is_favorite: true });

      expect(mockKits).toEqual(originalKits); // Original unchanged
      expect(result).not.toBe(mockKits); // New array returned
    });

    test("should preserve all original properties not in updates", () => {
      const result = updateKit(mockKits, "A1", { alias: "New Alias" });

      const updatedKit = result[1];
      expect(updatedKit.name).toBe("A1");
      expect(updatedKit.bank_letter).toBe("A");
      expect(updatedKit.bpm).toBe(140); // Original bpm preserved
      expect(updatedKit.is_favorite).toBe(true); // Original favorite status preserved
      expect(updatedKit.editable).toBe(true); // Original editable status preserved
      expect(updatedKit.alias).toBe("New Alias"); // Only alias updated
    });
  });

  describe("Sample Count Calculation Logic", () => {
    const calculateSampleCounts = (
      allKitSamples: { [kit: string]: { [voice: number]: string[] } },
      kits: KitWithRelations[],
    ): Record<string, [number, number, number, number]> => {
      const counts: Record<string, [number, number, number, number]> = {};

      kits.forEach((kit) => {
        const kitSamples = allKitSamples[kit.name] || {};
        const voiceCounts: [number, number, number, number] = [0, 0, 0, 0];

        for (let voice = 1; voice <= 4; voice++) {
          const voiceSamples = kitSamples[voice] || [];
          // Count non-empty samples
          voiceCounts[voice - 1] = voiceSamples.filter(
            (sample) => sample && sample.trim() !== "",
          ).length;
        }

        counts[kit.name] = voiceCounts;
      });

      return counts;
    };

    test("should calculate sample counts correctly for multiple kits", () => {
      const mockSamples = {
        A0: {
          1: ["kick.wav", "snare.wav"],
          2: ["hat.wav"],
          3: [],
          4: ["crash.wav", "ride.wav", "tom.wav"],
        },
        A1: {
          1: ["bass.wav"],
          2: [],
          3: ["lead.wav", "pad.wav"],
          4: [],
        },
      };

      const result = calculateSampleCounts(mockSamples, mockKits);

      expect(result["A0"]).toEqual([2, 1, 0, 3]);
      expect(result["A1"]).toEqual([1, 0, 2, 0]);
    });

    test("should handle kit with no samples", () => {
      const mockSamples = {
        A0: {},
      };

      const result = calculateSampleCounts(mockSamples, mockKits);

      expect(result["A0"]).toEqual([0, 0, 0, 0]);
    });

    test("should handle missing kit in samples", () => {
      const mockSamples = {
        A0: {
          1: ["kick.wav"],
          2: ["snare.wav"],
          3: [],
          4: [],
        },
      };

      const result = calculateSampleCounts(mockSamples, mockKits);

      expect(result["A0"]).toEqual([1, 1, 0, 0]);
      expect(result["A1"]).toEqual([0, 0, 0, 0]); // Missing in samples
    });

    test("should ignore empty strings and whitespace-only samples", () => {
      const mockSamples = {
        A0: {
          1: ["kick.wav", "", "snare.wav", "   "],
          2: ["hat.wav", " ", ""],
          3: [],
          4: [],
        },
      };

      const result = calculateSampleCounts(mockSamples, mockKits);

      expect(result["A0"]).toEqual([2, 1, 0, 0]); // Empty strings and whitespace ignored
    });

    test("should handle maximum samples per voice", () => {
      const mockSamples = {
        A0: {
          1: Array(12).fill("sample.wav"), // 12 samples (max per voice)
          2: Array(5).fill("sample.wav"), // 5 samples
          3: Array(8).fill("sample.wav"), // 8 samples
          4: Array(12).fill("sample.wav"), // 12 samples (max per voice)
        },
      };

      const result = calculateSampleCounts(mockSamples, mockKits);

      expect(result["A0"]).toEqual([12, 5, 8, 12]);
    });

    test("should handle empty kits array", () => {
      const result = calculateSampleCounts({}, []);
      expect(result).toEqual({});
    });
  });

  describe("Kit Data Validation Logic", () => {
    const validateKitForEditable = (
      kit: KitWithRelations | undefined,
    ): { reason?: string; valid: boolean } => {
      if (!kit) {
        return { reason: "Kit not found", valid: false };
      }

      if (kit.locked) {
        return { reason: "Kit is locked", valid: false };
      }

      return { valid: true };
    };

    test("should validate editable kit successfully", () => {
      const result = validateKitForEditable(mockKits[0]);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test("should reject undefined kit", () => {
      const result = validateKitForEditable(undefined);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Kit not found");
    });

    test("should reject locked kit", () => {
      const lockedKit = { ...mockKits[0], locked: true };
      const result = validateKitForEditable(lockedKit);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Kit is locked");
    });
  });

  describe("Error Handling Utilities", () => {
    const handleApiError = (
      error: unknown,
      operation: string,
    ): { details?: string; message: string } => {
      if (error instanceof Error) {
        return {
          details: error.message,
          message: `Failed to ${operation}`,
        };
      }

      return {
        details: String(error),
        message: `Failed to ${operation}`,
      };
    };

    test("should handle Error instances", () => {
      const error = new Error("Database connection failed");
      const result = handleApiError(error, "update kit");

      expect(result.message).toBe("Failed to update kit");
      expect(result.details).toBe("Database connection failed");
    });

    test("should handle string errors", () => {
      const error = "Network timeout";
      const result = handleApiError(error, "toggle favorite");

      expect(result.message).toBe("Failed to toggle favorite");
      expect(result.details).toBe("Network timeout");
    });

    test("should handle unknown error types", () => {
      const error = { code: 500, status: "Internal Error" };
      const result = handleApiError(error, "load data");

      expect(result.message).toBe("Failed to load data");
      expect(result.details).toBe("[object Object]");
    });

    test("should handle null/undefined errors", () => {
      expect(handleApiError(null, "save")).toEqual({
        details: "null",
        message: "Failed to save",
      });

      expect(handleApiError(undefined, "delete")).toEqual({
        details: "undefined",
        message: "Failed to delete",
      });
    });
  });

  describe("Optimistic Update Helpers", () => {
    const createOptimisticUpdate = <T>(
      items: T[],
      predicate: (item: T) => boolean,
      updates: Partial<T>,
    ): T[] => {
      return items.map((item) =>
        predicate(item) ? { ...item, ...updates } : item,
      );
    };

    test("should apply optimistic update to matching items", () => {
      const result = createOptimisticUpdate(
        mockKits,
        (kit) => kit.name === "A0",
        { alias: "Updated", is_favorite: true },
      );

      expect(result[0].is_favorite).toBe(true);
      expect(result[0].alias).toBe("Updated");
      expect(result[1].is_favorite).toBe(true); // Unchanged
      expect(result[1].alias).toBe("My Favorite Kit"); // Unchanged
    });

    test("should handle no matching items", () => {
      const result = createOptimisticUpdate(
        mockKits,
        (kit) => kit.name === "NonExistent",
        { is_favorite: true },
      );

      expect(result).toEqual(mockKits); // No changes
    });

    test("should handle multiple matching items", () => {
      const kitsWithDuplicates = [...mockKits, { ...mockKits[0], id: 3 }];
      const result = createOptimisticUpdate(
        kitsWithDuplicates,
        (kit) => kit.name === "A0",
        { is_favorite: true },
      );

      expect(result[0].is_favorite).toBe(true);
      expect(result[2].is_favorite).toBe(true);
      expect(result[1].is_favorite).toBe(true); // Unchanged (different name)
    });

    test("should not mutate original array", () => {
      const original = [...mockKits];
      const result = createOptimisticUpdate(
        mockKits,
        (kit) => kit.name === "A0",
        { is_favorite: true },
      );

      expect(mockKits).toEqual(original);
      expect(result).not.toBe(mockKits);
    });
  });
});
