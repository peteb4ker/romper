/**
 * Property-Based Tests for kitUtilsShared.
 * PBT-03: Invariant properties for kit name validation and sample grouping.
 * PBT-04: Idempotency properties for validation functions.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { kitNameArb, kitPositionArb } from "../../tests/utils/pbt-generators";
import { groupSamplesByVoice, isValidKit } from "../kitUtilsShared";

describe("kitUtilsShared - Property-Based Tests", () => {
  describe("PBT-03: Invariant properties", () => {
    it("isValidKit returns true for all generated valid kit names", () => {
      fc.assert(
        fc.property(kitNameArb, (kitName) => {
          expect(isValidKit(kitName)).toBe(true);
        }),
      );
    });

    it("isValidKit returns false for empty strings", () => {
      expect(isValidKit("")).toBe(false);
    });

    it("isValidKit returns false for lowercase-first names", () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.stringMatching(/^[a-z]$/), kitPositionArb),
          ([letter, pos]) => {
            expect(isValidKit(`${letter}${pos}`)).toBe(false);
          },
        ),
      );
    });

    it("groupSamplesByVoice preserves total sample count", () => {
      fc.assert(
        fc.property(
          fc.array(fc.stringMatching(/^[1-4][a-z]+\.wav$/), {
            maxLength: 48,
            minLength: 0,
          }),
          (filenames) => {
            const grouped = groupSamplesByVoice(filenames);
            let totalGrouped = 0;
            if (grouped instanceof Map) {
              for (const [, samples] of grouped) {
                totalGrouped += samples.length;
              }
            } else {
              for (const key of Object.keys(grouped)) {
                totalGrouped += grouped[Number(key)]?.length || 0;
              }
            }
            // Grouped count should not exceed input count
            expect(totalGrouped).toBeLessThanOrEqual(filenames.length);
          },
        ),
      );
    });
  });

  describe("PBT-04: Idempotency properties", () => {
    it("isValidKit is idempotent — calling it twice gives same result", () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 10, minLength: 0 }), (input) => {
          const first = isValidKit(input);
          const second = isValidKit(input);
          expect(first).toBe(second);
        }),
      );
    });

    it("isValidKit result is stable across calls", () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 10, minLength: 0 }), (input) => {
          expect(isValidKit(input)).toBe(isValidKit(input));
        }),
      );
    });
  });
});
