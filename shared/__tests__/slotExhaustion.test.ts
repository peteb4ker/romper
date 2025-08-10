import { describe, expect, it } from "vitest";

import {
  generateInsertionSlot,
  SLOT_SPACING,
  validateSlotSpacing,
} from "../slotUtils";

describe("slot exhaustion scenarios", () => {
  it("should demonstrate slot exhaustion between two standard slots", () => {
    let beforeSlot = 100;
    const afterSlot = 200;
    const insertedSlots = [];
    let insertionCount = 0;

    // Keep inserting until we can't anymore
    while (true) {
      try {
        const newSlot = generateInsertionSlot(beforeSlot, afterSlot);
        insertedSlots.push(newSlot);

        // For next insertion, use the new slot as the beforeSlot
        beforeSlot = newSlot;
        insertionCount++;

        // Safety valve to prevent infinite loop
        if (insertionCount > 100) break;
      } catch {
        console.log(`Exhausted after ${insertionCount} insertions`);
        console.log(
          `Final slots: ${[100, ...insertedSlots, 200].sort((a, b) => a - b)}`,
        );
        break;
      }
    }

    expect(insertionCount).toBeGreaterThan(5); // Should allow multiple insertions
    expect(insertionCount).toBeLessThan(100); // But not infinite
  });

  it("should show practical insertion limits", () => {
    // Start with 12 samples at standard spacing
    const samples = Array.from({ length: 12 }, (_, i) => ({
      slot_number: (i + 1) * SLOT_SPACING,
    }));

    // Try to insert 50 samples between slots 1 and 2 (100 and 200)
    let beforeSlot = 100;
    const afterSlot = 200;
    let successfulInsertions = 0;

    for (let i = 0; i < 50; i++) {
      try {
        const newSlot = generateInsertionSlot(beforeSlot, afterSlot);
        samples.push({ slot_number: newSlot });
        beforeSlot = newSlot; // Insert next one after this
        successfulInsertions++;
      } catch {
        break;
      }
    }

    console.log(
      `Successfully inserted ${successfulInsertions} samples between slots 100 and 200`,
    );
    expect(successfulInsertions).toBeGreaterThan(6); // Should allow many insertions
  });

  it("should demonstrate reindexing need detection", () => {
    const samples = [
      { slot_number: 100 },
      { slot_number: 101 }, // Very close to previous
      { slot_number: 102 }, // Very close
      { slot_number: 300 },
      { slot_number: 400 },
    ];

    const validation = validateSlotSpacing(samples);

    // These samples are not properly spaced
    expect(validation.isValid).toBe(false);
    expect(validation.issues.length).toBeGreaterThan(0);
    console.log("Validation issues:", validation.issues);
  });
});
