import { describe, expect, it } from "vitest";

import {
  getInsertionDbSlotWithReindexing,
  reindexSamples,
  shouldReindexBeforeInsertion,
  validateSlotSpacing,
} from "../slotUtils";

describe("slot reindexing system", () => {
  describe("reindexSamples", () => {
    it("should redistribute overcrowded samples evenly", () => {
      const overcrowdedSamples = [
        { filename: "S1", slot_number: 100 },
        { filename: "S2", slot_number: 150 },
        { filename: "S3", slot_number: 175 },
        { filename: "S4", slot_number: 187 },
      ];

      const reindexed = reindexSamples(overcrowdedSamples);

      expect(reindexed.map((s) => s.slot_number)).toEqual([100, 200, 300, 400]);
      expect(reindexed.map((s) => s.filename)).toEqual([
        "S1",
        "S2",
        "S3",
        "S4",
      ]);
    });
  });

  describe("shouldReindexBeforeInsertion", () => {
    it("should return false when insertion has plenty of room", () => {
      const samples = [{ slot_number: 100 }, { slot_number: 300 }];

      expect(shouldReindexBeforeInsertion(samples, 2)).toBe(false);
    });

    it("should return true when insertion would fail due to overcrowding", () => {
      const overcrowded = [
        { slot_number: 100 },
        { slot_number: 150 },
        { slot_number: 175 },
        { slot_number: 187 },
        { slot_number: 193 },
        { slot_number: 196 },
        { slot_number: 198 },
        { slot_number: 199 },
        { slot_number: 200 },
      ];

      expect(shouldReindexBeforeInsertion(overcrowded, 2)).toBe(true);
    });
  });

  describe("getInsertionDbSlotWithReindexing", () => {
    it("should return normal insertion when space is available", () => {
      const samples = [{ slot_number: 100 }, { slot_number: 300 }];

      const result = getInsertionDbSlotWithReindexing(samples, 2);

      expect(result.wasReindexed).toBe(false);
      expect(result.insertionSlot).toBe(200);
      expect(result.reindexedSamples).toBeUndefined();
    });

    it("should automatically reindex when insertion would fail", () => {
      const overcrowded = [
        { filename: "S1", slot_number: 100 },
        { filename: "S2", slot_number: 150 },
        { filename: "S3", slot_number: 175 },
        { filename: "S4", slot_number: 187 },
        { filename: "S5", slot_number: 193 },
        { filename: "S6", slot_number: 196 },
        { filename: "S7", slot_number: 198 },
        { filename: "S8", slot_number: 199 },
        { filename: "S9", slot_number: 200 },
      ];

      const result = getInsertionDbSlotWithReindexing(overcrowded, 2);

      expect(result.wasReindexed).toBe(true);
      expect(result.reindexedSamples).toBeDefined();
      expect(result.reindexedSamples!.length).toBe(9);

      // After reindexing, should have clean spacing
      expect(result.reindexedSamples!.map((s) => s.slot_number)).toEqual([
        100, 200, 300, 400, 500, 600, 700, 800, 900,
      ]);
    });
  });

  describe("validateSlotSpacing", () => {
    it("should detect need for reindexing when slots are overcrowded", () => {
      const overcrowded = [
        { slot_number: 100 },
        { slot_number: 101 },
        { slot_number: 102 },
      ];

      const validation = validateSlotSpacing(overcrowded);

      expect(validation.isValid).toBe(false);
      expect(validation.needsReindexing).toBe(true);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });
});
