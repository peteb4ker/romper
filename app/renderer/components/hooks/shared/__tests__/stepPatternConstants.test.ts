import { describe, expect, it } from "vitest";

import {
  createDefaultStepPattern,
  ensureValidStepPattern,
  isValidStepPattern,
  LED_GLOWS,
  NUM_STEPS,
  NUM_VOICES,
  ROW_COLORS,
} from "../stepPatternConstants";

describe("stepPatternConstants", () => {
  describe("constants", () => {
    it("should have correct NUM_VOICES", () => {
      expect(NUM_VOICES).toBe(4);
    });

    it("should have correct NUM_STEPS", () => {
      expect(NUM_STEPS).toBe(16);
    });

    it("should have ROW_COLORS with correct length", () => {
      expect(ROW_COLORS).toHaveLength(NUM_VOICES);
      expect(ROW_COLORS[0]).toBe("bg-red-500 border-red-700");
      expect(ROW_COLORS[1]).toBe("bg-green-500 border-green-700");
      expect(ROW_COLORS[2]).toBe("bg-yellow-400 border-yellow-600");
      expect(ROW_COLORS[3]).toBe("bg-purple-500 border-purple-700");
    });

    it("should have LED_GLOWS with correct length", () => {
      expect(LED_GLOWS).toHaveLength(NUM_VOICES);
      expect(LED_GLOWS[0]).toBe("shadow-[0_0_12px_3px_rgba(239,68,68,0.7)]");
      expect(LED_GLOWS[1]).toBe("shadow-[0_0_12px_3px_rgba(34,197,94,0.7)]");
      expect(LED_GLOWS[2]).toBe("shadow-[0_0_12px_3px_rgba(234,179,8,0.7)]");
      expect(LED_GLOWS[3]).toBe("shadow-[0_0_12px_3px_rgba(168,85,247,0.7)]");
    });
  });

  describe("createDefaultStepPattern", () => {
    it("should create a pattern with correct dimensions", () => {
      const pattern = createDefaultStepPattern();
      expect(pattern).toHaveLength(NUM_VOICES);
      pattern.forEach((row) => {
        expect(row).toHaveLength(NUM_STEPS);
      });
    });

    it("should create a pattern filled with zeros", () => {
      const pattern = createDefaultStepPattern();
      pattern.forEach((row) => {
        row.forEach((velocity) => {
          expect(velocity).toBe(0);
        });
      });
    });

    it("should create a new instance each time", () => {
      const pattern1 = createDefaultStepPattern();
      const pattern2 = createDefaultStepPattern();
      expect(pattern1).not.toBe(pattern2);
      expect(pattern1[0]).not.toBe(pattern2[0]);
    });
  });

  describe("isValidStepPattern", () => {
    it("should return true for valid pattern", () => {
      const validPattern = [
        [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
        [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      ];
      expect(isValidStepPattern(validPattern)).toBe(true);
    });

    it("should return true for default pattern", () => {
      const defaultPattern = createDefaultStepPattern();
      expect(isValidStepPattern(defaultPattern)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isValidStepPattern(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isValidStepPattern(undefined)).toBe(false);
    });

    it("should return false for non-array", () => {
      expect(isValidStepPattern("not array")).toBe(false);
      expect(isValidStepPattern(123)).toBe(false);
      expect(isValidStepPattern({})).toBe(false);
    });

    it("should return false for wrong number of voices", () => {
      const wrongVoices = [
        [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      ]; // Only 2 voices instead of 4
      expect(isValidStepPattern(wrongVoices)).toBe(false);
    });

    it("should return false for wrong number of steps", () => {
      const wrongSteps = [
        [1, 0, 1, 0, 1, 0, 1, 0], // Only 8 steps instead of 16
        [0, 1, 0, 1, 0, 1, 0, 1],
        [1, 1, 0, 0, 1, 1, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 1],
      ];
      expect(isValidStepPattern(wrongSteps)).toBe(false);
    });

    it("should return false for non-array rows", () => {
      const nonArrayRows = [
        [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        "not array", // Non-array row
        [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      ];
      expect(isValidStepPattern(nonArrayRows)).toBe(false);
    });

    it("should return false for empty array", () => {
      expect(isValidStepPattern([])).toBe(false);
    });
  });

  describe("ensureValidStepPattern", () => {
    it("should return valid pattern unchanged", () => {
      const validPattern = [
        [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
        [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      ];
      const result = ensureValidStepPattern(validPattern);
      expect(result).toBe(validPattern);
    });

    it("should return default pattern for null", () => {
      const result = ensureValidStepPattern(null);
      expect(isValidStepPattern(result)).toBe(true);
      expect(result).toEqual(createDefaultStepPattern());
    });

    it("should return default pattern for undefined", () => {
      const result = ensureValidStepPattern(undefined);
      expect(isValidStepPattern(result)).toBe(true);
      expect(result).toEqual(createDefaultStepPattern());
    });

    it("should return default pattern for invalid pattern", () => {
      const invalidPattern = [
        [1, 0, 1], // Wrong number of steps
        [0, 1, 0],
      ]; // Wrong number of voices
      const result = ensureValidStepPattern(invalidPattern);
      expect(isValidStepPattern(result)).toBe(true);
      expect(result).toEqual(createDefaultStepPattern());
    });

    it("should return default pattern for non-array", () => {
      const result = ensureValidStepPattern("not array" as any);
      expect(isValidStepPattern(result)).toBe(true);
      expect(result).toEqual(createDefaultStepPattern());
    });

    it("should create new instance each time for invalid input", () => {
      const result1 = ensureValidStepPattern(null);
      const result2 = ensureValidStepPattern(null);
      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });

  describe("edge cases", () => {
    it("should handle patterns with various velocity values", () => {
      const patternWithVelocities = [
        [127, 64, 32, 16, 8, 4, 2, 1, 0, 127, 64, 32, 16, 8, 4, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [255, 128, 64, 32, 16, 8, 4, 2, 1, 255, 128, 64, 32, 16, 8, 4],
        [
          100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
          100, 100,
        ],
      ];
      expect(isValidStepPattern(patternWithVelocities)).toBe(true);
      expect(ensureValidStepPattern(patternWithVelocities)).toBe(
        patternWithVelocities
      );
    });

    it("should handle patterns with negative values", () => {
      const patternWithNegatives = [
        [-1, 0, 1, 0, -1, 0, 1, 0, -1, 0, 1, 0, -1, 0, 1, 0],
        [0, -1, 0, 1, 0, -1, 0, 1, 0, -1, 0, 1, 0, -1, 0, 1],
        [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
        [0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, -1],
      ];
      expect(isValidStepPattern(patternWithNegatives)).toBe(true);
      expect(ensureValidStepPattern(patternWithNegatives)).toBe(
        patternWithNegatives
      );
    });
  });
});
