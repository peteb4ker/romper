/**
 * Property-Based Tests for slotUtils (round-trip properties).
 * PBT-02: Serialization/deserialization round-trips.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { dbSlotToUiSlot, uiSlotToDbSlot } from "../slotUtils";

describe("slotUtils - Property-Based Tests", () => {
  describe("PBT-02: Round-trip properties", () => {
    it("dbSlotToUiSlot(uiSlotToDbSlot(x)) === x for all valid UI slots", () => {
      fc.assert(
        fc.property(fc.integer({ max: 12, min: 1 }), (uiSlot) => {
          const dbSlot = uiSlotToDbSlot(uiSlot);
          const roundTripped = dbSlotToUiSlot(dbSlot);
          expect(roundTripped).toBe(uiSlot);
        }),
      );
    });

    it("uiSlotToDbSlot(dbSlotToUiSlot(x)) === x for all valid DB slots", () => {
      fc.assert(
        fc.property(fc.integer({ max: 11, min: 0 }), (dbSlot) => {
          const uiSlot = dbSlotToUiSlot(dbSlot);
          const roundTripped = uiSlotToDbSlot(uiSlot);
          expect(roundTripped).toBe(dbSlot);
        }),
      );
    });
  });

  describe("PBT-03: Invariant properties", () => {
    it("dbSlotToUiSlot always returns a value in range [1, 12]", () => {
      fc.assert(
        fc.property(fc.integer({ max: 11, min: 0 }), (dbSlot) => {
          const uiSlot = dbSlotToUiSlot(dbSlot);
          expect(uiSlot).toBeGreaterThanOrEqual(1);
          expect(uiSlot).toBeLessThanOrEqual(12);
        }),
      );
    });

    it("uiSlotToDbSlot always returns a value in range [0, 11]", () => {
      fc.assert(
        fc.property(fc.integer({ max: 12, min: 1 }), (uiSlot) => {
          const dbSlot = uiSlotToDbSlot(uiSlot);
          expect(dbSlot).toBeGreaterThanOrEqual(0);
          expect(dbSlot).toBeLessThanOrEqual(11);
        }),
      );
    });

    it("UI slot is always exactly 1 more than DB slot", () => {
      fc.assert(
        fc.property(fc.integer({ max: 11, min: 0 }), (dbSlot) => {
          expect(dbSlotToUiSlot(dbSlot)).toBe(dbSlot + 1);
        }),
      );
    });
  });
});
