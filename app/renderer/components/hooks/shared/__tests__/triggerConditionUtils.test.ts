import { describe, expect, it } from "vitest";

import {
  createDefaultTriggerConditions,
  ensureValidTriggerConditions,
  shouldTrigger,
} from "../stepPatternConstants";

describe("triggerConditionUtils", () => {
  describe("createDefaultTriggerConditions", () => {
    it("should return a 4x16 array filled with null", () => {
      const result = createDefaultTriggerConditions();

      expect(result).toHaveLength(4);
      for (const row of result) {
        expect(row).toHaveLength(16);
        expect(row.every((v: null | string) => v === null)).toBe(true);
      }
    });

    it("should return a new array on each call", () => {
      const result1 = createDefaultTriggerConditions();
      const result2 = createDefaultTriggerConditions();

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });

    it("should return independent row arrays", () => {
      const result = createDefaultTriggerConditions();

      result[0][0] = "1:2";
      expect(result[1][0]).toBeNull();
    });
  });

  describe("ensureValidTriggerConditions", () => {
    it("should return defaults for null input", () => {
      const result = ensureValidTriggerConditions(null);

      expect(result).toHaveLength(4);
      for (const row of result) {
        expect(row).toHaveLength(16);
        expect(row.every((v: null | string) => v === null)).toBe(true);
      }
    });

    it("should return defaults for undefined input", () => {
      const result = ensureValidTriggerConditions(
        undefined as unknown as (null | string)[][],
      );

      expect(result).toHaveLength(4);
      for (const row of result) {
        expect(row).toHaveLength(16);
      }
    });

    it("should return defaults for wrong outer array length", () => {
      const tooFew = [Array(16).fill(null), Array(16).fill(null)];
      const result = ensureValidTriggerConditions(tooFew);

      expect(result).toHaveLength(4);
    });

    it("should return defaults for wrong inner array length", () => {
      const wrongInner = Array.from({ length: 4 }, () => Array(8).fill(null));
      const result = ensureValidTriggerConditions(wrongInner);

      expect(result).toHaveLength(4);
      for (const row of result) {
        expect(row).toHaveLength(16);
      }
    });

    it("should return the input for valid 4x16 conditions", () => {
      const valid: (null | string)[][] = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      valid[0][0] = "1:2";
      valid[2][7] = "3:4";

      const result = ensureValidTriggerConditions(valid);

      expect(result).toEqual(valid);
    });

    it("should return the input for valid all-null conditions", () => {
      const valid = Array.from({ length: 4 }, () => Array(16).fill(null));

      const result = ensureValidTriggerConditions(valid);

      expect(result).toEqual(valid);
    });
  });

  describe("shouldTrigger", () => {
    it("should always return true for null condition", () => {
      for (let cycle = 0; cycle < 10; cycle++) {
        expect(shouldTrigger(null, cycle)).toBe(true);
      }
    });

    describe("1:2 - triggers on even cycles", () => {
      it("should return true on cycle 0", () => {
        expect(shouldTrigger("1:2", 0)).toBe(true);
      });

      it("should return false on cycle 1", () => {
        expect(shouldTrigger("1:2", 1)).toBe(false);
      });

      it("should return true on cycle 2", () => {
        expect(shouldTrigger("1:2", 2)).toBe(true);
      });

      it("should return false on cycle 3", () => {
        expect(shouldTrigger("1:2", 3)).toBe(false);
      });

      it("should return true on cycle 4", () => {
        expect(shouldTrigger("1:2", 4)).toBe(true);
      });

      it("should return false on cycle 5", () => {
        expect(shouldTrigger("1:2", 5)).toBe(false);
      });
    });

    describe("2:2 - triggers on odd cycles", () => {
      it("should return false on cycle 0", () => {
        expect(shouldTrigger("2:2", 0)).toBe(false);
      });

      it("should return true on cycle 1", () => {
        expect(shouldTrigger("2:2", 1)).toBe(true);
      });

      it("should return false on cycle 2", () => {
        expect(shouldTrigger("2:2", 2)).toBe(false);
      });

      it("should return true on cycle 3", () => {
        expect(shouldTrigger("2:2", 3)).toBe(true);
      });

      it("should return false on cycle 4", () => {
        expect(shouldTrigger("2:2", 4)).toBe(false);
      });

      it("should return true on cycle 5", () => {
        expect(shouldTrigger("2:2", 5)).toBe(true);
      });
    });

    describe("1:4 - triggers on first of every 4 cycles", () => {
      it("should return true on cycle 0", () => {
        expect(shouldTrigger("1:4", 0)).toBe(true);
      });

      it("should return false on cycle 1", () => {
        expect(shouldTrigger("1:4", 1)).toBe(false);
      });

      it("should return false on cycle 2", () => {
        expect(shouldTrigger("1:4", 2)).toBe(false);
      });

      it("should return false on cycle 3", () => {
        expect(shouldTrigger("1:4", 3)).toBe(false);
      });

      it("should return true on cycle 4", () => {
        expect(shouldTrigger("1:4", 4)).toBe(true);
      });

      it("should return true on cycle 8", () => {
        expect(shouldTrigger("1:4", 8)).toBe(true);
      });
    });

    describe("2:4 - triggers on second of every 4 cycles", () => {
      it("should return false on cycle 0", () => {
        expect(shouldTrigger("2:4", 0)).toBe(false);
      });

      it("should return true on cycle 1", () => {
        expect(shouldTrigger("2:4", 1)).toBe(true);
      });

      it("should return false on cycle 2", () => {
        expect(shouldTrigger("2:4", 2)).toBe(false);
      });

      it("should return false on cycle 3", () => {
        expect(shouldTrigger("2:4", 3)).toBe(false);
      });

      it("should return true on cycle 5", () => {
        expect(shouldTrigger("2:4", 5)).toBe(true);
      });
    });

    describe("3:4 - triggers on third of every 4 cycles", () => {
      it("should return false on cycle 0", () => {
        expect(shouldTrigger("3:4", 0)).toBe(false);
      });

      it("should return false on cycle 1", () => {
        expect(shouldTrigger("3:4", 1)).toBe(false);
      });

      it("should return true on cycle 2", () => {
        expect(shouldTrigger("3:4", 2)).toBe(true);
      });

      it("should return false on cycle 3", () => {
        expect(shouldTrigger("3:4", 3)).toBe(false);
      });

      it("should return true on cycle 6", () => {
        expect(shouldTrigger("3:4", 6)).toBe(true);
      });
    });

    describe("4:4 - triggers on fourth of every 4 cycles", () => {
      it("should return false on cycle 0", () => {
        expect(shouldTrigger("4:4", 0)).toBe(false);
      });

      it("should return false on cycle 1", () => {
        expect(shouldTrigger("4:4", 1)).toBe(false);
      });

      it("should return false on cycle 2", () => {
        expect(shouldTrigger("4:4", 2)).toBe(false);
      });

      it("should return true on cycle 3", () => {
        expect(shouldTrigger("4:4", 3)).toBe(true);
      });

      it("should return true on cycle 7", () => {
        expect(shouldTrigger("4:4", 7)).toBe(true);
      });
    });
  });
});
