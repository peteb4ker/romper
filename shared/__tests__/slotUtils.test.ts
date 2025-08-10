import { describe, expect, it } from "vitest";

import {
  dbSlotToDisplaySlot,
  displaySlotToDbSlot,
  generateInsertionSlot,
  getInsertionDbSlot,
  SLOT_SPACING,
} from "../slotUtils";

describe("slotUtils", () => {
  describe("displaySlotToDbSlot", () => {
    it("should convert display slots to spaced database slots", () => {
      expect(displaySlotToDbSlot(1)).toBe(100);
      expect(displaySlotToDbSlot(2)).toBe(200);
      expect(displaySlotToDbSlot(12)).toBe(1200);
    });

    it("should throw for invalid display slots", () => {
      expect(() => displaySlotToDbSlot(0)).toThrow();
      expect(() => displaySlotToDbSlot(13)).toThrow();
    });
  });

  describe("dbSlotToDisplaySlot", () => {
    it("should convert spaced database slots to display slots", () => {
      expect(dbSlotToDisplaySlot(100)).toBe(1);
      expect(dbSlotToDisplaySlot(200)).toBe(2);
      expect(dbSlotToDisplaySlot(1200)).toBe(12);
    });

    it("should handle midpoint slots correctly", () => {
      expect(dbSlotToDisplaySlot(150)).toBe(2); // Rounds to nearest display slot
      expect(dbSlotToDisplaySlot(125)).toBe(1); // Rounds to nearest display slot
    });

    it("should throw for invalid database slots", () => {
      expect(() => dbSlotToDisplaySlot(0)).toThrow();
      expect(() => dbSlotToDisplaySlot(1300)).toThrow();
    });
  });

  describe("generateInsertionSlot", () => {
    it("should generate midpoint for insertion between spaced slots", () => {
      expect(generateInsertionSlot(100, 200)).toBe(150);
      expect(generateInsertionSlot(200, 300)).toBe(250);
      expect(generateInsertionSlot(0, 100)).toBe(50);
    });

    it("should work with fine-grained slots", () => {
      expect(generateInsertionSlot(150, 200)).toBe(175);
      expect(generateInsertionSlot(175, 200)).toBe(187);
    });

    it("should throw when no room for insertion", () => {
      expect(() => generateInsertionSlot(100, 101)).toThrow(
        "No room to insert",
      );
    });
  });

  describe("12-sample movement scenario", () => {
    it("should handle complex sample movements", () => {
      // Initial 12 samples: 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200
      const initialSamples = Array.from({ length: 12 }, (_, i) => ({
        slot_number: (i + 1) * SLOT_SPACING,
      }));

      // Move sample 3 to position 2 (insert mode)
      const insertionSlot = getInsertionDbSlot(initialSamples, 2);
      expect(insertionSlot).toBe(150); // Between 100 and 200

      // Simulate the result after moving S3 to position 2
      const afterMove1 = [
        { slot_number: 100 }, // S1
        { slot_number: 150 }, // S3 (moved here)
        { slot_number: 200 }, // S2
        { slot_number: 400 }, // S4-S12 unchanged
        { slot_number: 500 },
        { slot_number: 600 },
        { slot_number: 700 },
        { slot_number: 800 },
        { slot_number: 900 },
        { slot_number: 1000 },
        { slot_number: 1100 },
        { slot_number: 1200 },
      ];

      // Move S12 to position 1 (before everything)
      const insertAtStart = getInsertionDbSlot(afterMove1, 1);
      expect(insertAtStart).toBe(50); // Before 100

      // Verify display conversion still works correctly
      expect(dbSlotToDisplaySlot(50)).toBe(1); // Rounds to display slot 1
      expect(dbSlotToDisplaySlot(100)).toBe(1); // Rounds to display slot 1
      expect(dbSlotToDisplaySlot(150)).toBe(2); // Rounds to display slot 2
      expect(dbSlotToDisplaySlot(200)).toBe(2); // Rounds to display slot 2

      // The system maintains proper ordering despite internal spacing
      const finalSlots = [
        50, 100, 150, 200, 400, 500, 600, 700, 800, 900, 1000, 1100,
      ];
      const displaySlots = finalSlots.map(dbSlotToDisplaySlot);

      // UI should show proper sequence (allowing for rounding)
      expect(displaySlots).toEqual([1, 1, 2, 2, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    it("should allow many insertions between standard slots", () => {
      // Start with two slots far apart
      const samples = [{ slot_number: 100 }, { slot_number: 200 }];

      // Insert samples between 100 and 200 repeatedly
      let insertionCount = 0;
      let beforeSlot = 100;
      const afterSlot = 200;

      // Keep inserting until we can't anymore (should be many insertions)
      while (insertionCount < 6) {
        // Limit to prevent infinite loop
        try {
          const insertionSlot = generateInsertionSlot(beforeSlot, afterSlot);
          samples.push({ slot_number: insertionSlot });

          // For next iteration, insert between the new slot and the after slot
          beforeSlot = insertionSlot;
          insertionCount++;
        } catch {
          break; // No more room
        }
      }

      expect(insertionCount).toBeGreaterThanOrEqual(6); // Should be able to insert multiple times
      expect(samples.length).toBe(8); // Started with 2, inserted 6 more

      // All samples should have valid slot numbers between 100 and 200
      const sortedSlots = samples
        .map((s) => s.slot_number)
        .sort((a, b) => a - b);
      expect(sortedSlots[0]).toBe(100);
      expect(sortedSlots[sortedSlots.length - 1]).toBe(200);

      // Verify they're all in ascending order
      for (let i = 1; i < sortedSlots.length; i++) {
        expect(sortedSlots[i]).toBeGreaterThan(sortedSlots[i - 1]);
      }
    });
  });
});
