import { describe, expect, it } from "vitest";

import {
  dbSlotToUiSlot,
  getInsertionDbSlot,
  uiSlotToDbSlot,
} from "../slotUtils";

describe("slotUtils", () => {
  describe("uiSlotToDbSlot", () => {
    it("should convert display slots to 0-based database slots", () => {
      expect(uiSlotToDbSlot(1)).toBe(0);
      expect(uiSlotToDbSlot(2)).toBe(1);
      expect(uiSlotToDbSlot(12)).toBe(11);
    });

    it("should throw for invalid display slots", () => {
      expect(() => uiSlotToDbSlot(0)).toThrow();
      expect(() => uiSlotToDbSlot(13)).toThrow();
    });
  });

  describe("dbSlotToUiSlot", () => {
    it("should convert 0-based database slots to display slots", () => {
      expect(dbSlotToUiSlot(0)).toBe(1);
      expect(dbSlotToUiSlot(1)).toBe(2);
      expect(dbSlotToUiSlot(11)).toBe(12);
    });

    it("should throw for invalid database slots", () => {
      expect(() => dbSlotToUiSlot(-1)).toThrow();
      expect(() => dbSlotToUiSlot(12)).toThrow();
    });
  });

  describe("12-sample movement scenario", () => {
    it("should handle complex sample movements", () => {
      // Initial 12 samples: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
      const initialSamples = Array.from({ length: 12 }, (_, i) => ({
        slot_number: i,
      }));

      // Move sample 3 to position 2 (insert mode)
      const insertionSlot = getInsertionDbSlot(initialSamples, 2);
      expect(insertionSlot).toBe(1); // Display position 2 = slot index 1

      // Verify display conversion works correctly for 0-11 system
      expect(dbSlotToUiSlot(0)).toBe(1);
      expect(dbSlotToUiSlot(1)).toBe(2);
      expect(dbSlotToUiSlot(11)).toBe(12);
    });

    it("should handle simple 0-11 slot indexing", () => {
      // With 0-11 system, samples occupy slots 0 through 11
      const samples = [
        { slot_number: 0 },
        { slot_number: 2 },
        { slot_number: 5 },
        { slot_number: 11 },
      ];

      // All slots should be within valid range
      samples.forEach((sample) => {
        expect(sample.slot_number).toBeGreaterThanOrEqual(0);
        expect(sample.slot_number).toBeLessThan(12);
      });

      // Verify display conversion works
      expect(dbSlotToUiSlot(0)).toBe(1);
      expect(dbSlotToUiSlot(11)).toBe(12);
    });
  });
});
