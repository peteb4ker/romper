import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the schema and orm dependencies
vi.mock("@romper/shared/db/schema.js", () => ({
  banks: { letter: "banks_table" },
  kits: { insert: vi.fn(), name: "kits_table" },
  samples: {
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

import * as schema from "@romper/shared/db/schema.js";

// Import the functions we want to test
import { buildDeleteConditions, getSamplesToDelete } from "../crudOperations";

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
      vi.mocked(eq).mockReturnValue(mockCondition as any);
      vi.mocked(and).mockReturnValue("combined_condition" as any);

      const result = buildDeleteConditions(testKitName);

      expect(eq).toHaveBeenCalledWith(schema.samples.kit_name, testKitName);
      expect(and).toHaveBeenCalledWith(mockCondition);
      expect(result).toBe("combined_condition");
    });

    it("should build conditions with voice filter", () => {
      const mockKitCondition = { kit_name: testKitName };
      const mockVoiceCondition = { voice_number: 1 };
      vi.mocked(eq)
        .mockReturnValueOnce(mockKitCondition as any)
        .mockReturnValueOnce(mockVoiceCondition as any);
      vi.mocked(and).mockReturnValue("combined_condition" as any);

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
        .mockReturnValueOnce(mockKitCondition as any)
        .mockReturnValueOnce(mockSlotCondition as any);
      vi.mocked(and).mockReturnValue("combined_condition" as any);

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
        .mockReturnValueOnce(mockKitCondition as any)
        .mockReturnValueOnce(mockVoiceCondition as any)
        .mockReturnValueOnce(mockSlotCondition as any);
      vi.mocked(and).mockReturnValue("combined_condition" as any);

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

      const result = getSamplesToDelete(mockDb as any, mockCondition);

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
});
