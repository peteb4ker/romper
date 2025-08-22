import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the schema and orm dependencies
vi.mock("@romper/shared/db/schema.js", () => ({
  banks: { letter: "banks_table" },
  kits: { insert: vi.fn(), name: "kits_table" },
  samples: {
    id: "samples_id",
    kit_name: "samples_table",
    slot_number: "slot_field",
    voice_number: "voice_field",
  },
  voices: { voice_number: "voices_table" },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
}));

// Mock database utilities
vi.mock("../../utils/dbUtilities.js", () => ({
  withDb: vi.fn(),
}));

import * as schema from "@romper/shared/db/schema.js";

import { withDb } from "../../utils/dbUtilities.js";
// Import the functions we want to test
import {
  buildDeleteConditions,
  getSamplesToDelete,
  updateSampleMetadata,
} from "../crudOperations";

describe("crudOperations pure functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildDeleteConditions", () => {
    const testKitName = "Test Kit";

    beforeEach(() => {
      // Reset mocks
      vi.mocked(eq).mockClear();
      vi.mocked(and).mockClear();
    });

    it("should build conditions with kit name only", () => {
      const mockCondition = { kit_name: testKitName };
      vi.mocked(eq).mockReturnValue(mockCondition as unknown);

      const result = buildDeleteConditions(testKitName);

      expect(eq).toHaveBeenCalledWith(schema.samples.kit_name, testKitName);
      expect(and).not.toHaveBeenCalled(); // Single condition doesn't need and()
      expect(result).toBe(mockCondition);
    });

    it("should build conditions with voice filter", () => {
      const mockKitCondition = { kit_name: testKitName };
      const mockVoiceCondition = { voice_number: 1 };
      vi.mocked(eq)
        .mockReturnValueOnce(mockKitCondition as unknown)
        .mockReturnValueOnce(mockVoiceCondition as unknown);
      vi.mocked(and).mockReturnValue("combined_condition" as unknown);

      const result = buildDeleteConditions(testKitName, { voiceNumber: 1 });

      expect(eq).toHaveBeenCalledWith(schema.samples.kit_name, testKitName);
      expect(eq).toHaveBeenCalledWith(schema.samples.voice_number, 1);
      expect(and).toHaveBeenCalledWith(mockKitCondition, mockVoiceCondition);
      expect(result).toBe("combined_condition");
    });

    it("should build conditions with slot filter", () => {
      const mockKitCondition = { kit_name: testKitName };
      const mockSlotCondition = { slot_number: 2 };
      vi.mocked(eq)
        .mockReturnValueOnce(mockKitCondition as unknown)
        .mockReturnValueOnce(mockSlotCondition as unknown);
      vi.mocked(and).mockReturnValue("combined_condition" as unknown);

      const result = buildDeleteConditions(testKitName, { slotNumber: 2 });

      expect(eq).toHaveBeenCalledWith(schema.samples.kit_name, testKitName);
      expect(eq).toHaveBeenCalledWith(schema.samples.slot_number, 2); // Direct 0-11 slot indexing
      expect(and).toHaveBeenCalledWith(mockKitCondition, mockSlotCondition);
      expect(result).toBe("combined_condition");
    });

    it("should build conditions with both filters", () => {
      const mockKitCondition = { kit_name: testKitName };
      const mockVoiceCondition = { voice_number: 1 };
      const mockSlotCondition = { slot_number: 2 };
      vi.mocked(eq)
        .mockReturnValueOnce(mockKitCondition as unknown)
        .mockReturnValueOnce(mockVoiceCondition as unknown)
        .mockReturnValueOnce(mockSlotCondition as unknown);
      vi.mocked(and).mockReturnValue("combined_condition" as unknown);

      const result = buildDeleteConditions(testKitName, {
        slotNumber: 2,
        voiceNumber: 1,
      });

      expect(eq).toHaveBeenCalledTimes(3);
      expect(and).toHaveBeenCalledWith(
        mockKitCondition,
        mockVoiceCondition,
        mockSlotCondition,
      );
      expect(result).toBe("combined_condition");
    });
  });

  describe("getSamplesToDelete", () => {
    it("should return samples matching condition", () => {
      const mockDb = {
        all: vi.fn().mockReturnValue([
          { filename: "sample1.wav", id: 1 },
          { filename: "sample2.wav", id: 2 },
        ]),
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };

      const mockCondition = { kit_name: "Test Kit" };

      const result = getSamplesToDelete(mockDb as unknown, mockCondition);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(schema.samples);
      expect(mockDb.where).toHaveBeenCalledWith(mockCondition);
      expect(mockDb.all).toHaveBeenCalled();
      expect(result).toEqual([
        { filename: "sample1.wav", id: 1 },
        { filename: "sample2.wav", id: 2 },
      ]);
    });
  });

  describe("updateSampleMetadata", () => {
    const mockDb = {
      run: vi.fn(),
      set: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };

    beforeEach(() => {
      vi.mocked(withDb).mockImplementation(
        (dbDir: string, callback: unknown) => {
          try {
            const result = callback(mockDb);
            return { data: result, success: true };
          } catch (error) {
            return { error: (error as Error).message, success: false };
          }
        },
      );
    });

    it("should update sample metadata successfully", () => {
      mockDb.run.mockReturnValue({ changes: 1 });

      const result = updateSampleMetadata("/test/db", 123, {
        wav_bit_depth: 16,
        wav_bitrate: 1411200,
        wav_channels: 2,
        wav_sample_rate: 44100,
      });

      expect(result.success).toBe(true);
      expect(mockDb.update).toHaveBeenCalledWith(schema.samples);
      expect(mockDb.set).toHaveBeenCalledWith({
        wav_bit_depth: 16,
        wav_bitrate: 1411200,
        wav_channels: 2,
        wav_sample_rate: 44100,
      });
      expect(mockDb.where).toHaveBeenCalledWith(expect.anything());
      expect(eq).toHaveBeenCalledWith(schema.samples.id, 123);
      expect(mockDb.run).toHaveBeenCalled();
    });

    it("should handle partial metadata updates", () => {
      mockDb.run.mockReturnValue({ changes: 1 });

      const result = updateSampleMetadata("/test/db", 456, {
        wav_bit_depth: 24,
        wav_channels: null,
      });

      expect(result.success).toBe(true);
      expect(mockDb.set).toHaveBeenCalledWith({
        wav_bit_depth: 24,
        wav_channels: null,
      });
    });

    it("should return error when sample not found", () => {
      mockDb.run.mockReturnValue({ changes: 0 });

      const result = updateSampleMetadata("/test/db", 999, {
        wav_bit_depth: 16,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Sample with ID 999 not found");
    });

    it("should handle database errors", () => {
      mockDb.run.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const result = updateSampleMetadata("/test/db", 123, {
        wav_bit_depth: 16,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });

    it("should handle null metadata values correctly", () => {
      mockDb.run.mockReturnValue({ changes: 1 });

      const result = updateSampleMetadata("/test/db", 123, {
        wav_bit_depth: null,
        wav_bitrate: null,
        wav_channels: null,
        wav_sample_rate: null,
      });

      expect(result.success).toBe(true);
      expect(mockDb.set).toHaveBeenCalledWith({
        wav_bit_depth: null,
        wav_bitrate: null,
        wav_channels: null,
        wav_sample_rate: null,
      });
    });
  });
});
