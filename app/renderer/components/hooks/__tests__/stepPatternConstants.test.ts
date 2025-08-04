import { describe, expect, it } from "vitest";

import {
  createDefaultStepPattern,
  ensureValidStepPattern,
  type FocusedStep,
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

    it("should have ROW_COLORS array with correct length", () => {
      expect(ROW_COLORS).toHaveLength(4);
      expect(ROW_COLORS[0]).toContain("bg-red-500");
      expect(ROW_COLORS[1]).toContain("bg-green-500");
      expect(ROW_COLORS[2]).toContain("bg-yellow-400");
      expect(ROW_COLORS[3]).toContain("bg-purple-500");
    });

    it("should have LED_GLOWS array with correct length", () => {
      expect(LED_GLOWS).toHaveLength(4);
      expect(LED_GLOWS[0]).toContain("rgba(239,68,68,0.7)"); // red
      expect(LED_GLOWS[1]).toContain("rgba(34,197,94,0.7)"); // green
      expect(LED_GLOWS[2]).toContain("rgba(234,179,8,0.7)"); // yellow
      expect(LED_GLOWS[3]).toContain("rgba(168,85,247,0.7)"); // purple
    });
  });

  describe("createDefaultStepPattern", () => {
    it("should create a pattern with correct dimensions", () => {
      const pattern = createDefaultStepPattern();
      expect(pattern).toHaveLength(NUM_VOICES);
      expect(pattern[0]).toHaveLength(NUM_STEPS);
      expect(pattern[1]).toHaveLength(NUM_STEPS);
      expect(pattern[2]).toHaveLength(NUM_STEPS);
      expect(pattern[3]).toHaveLength(NUM_STEPS);
    });

    it("should initialize all values to 0", () => {
      const pattern = createDefaultStepPattern();
      pattern.forEach((voice) => {
        voice.forEach((step) => {
          expect(step).toBe(0);
        });
      });
    });
  });

  describe("isValidStepPattern", () => {
    it("should return true for valid pattern", () => {
      const validPattern = createDefaultStepPattern();
      expect(isValidStepPattern(validPattern)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isValidStepPattern(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isValidStepPattern(undefined)).toBe(false);
    });

    it("should return false for non-array", () => {
      expect(isValidStepPattern({})).toBe(false);
      expect(isValidStepPattern("string")).toBe(false);
      expect(isValidStepPattern(123)).toBe(false);
    });

    it("should return false for wrong number of voices", () => {
      const wrongVoices = [
        [0, 1, 2],
        [3, 4, 5],
      ]; // only 2 voices
      expect(isValidStepPattern(wrongVoices)).toBe(false);
    });

    it("should return false for wrong number of steps", () => {
      const wrongSteps = [
        [0, 1, 2], // only 3 steps
        [3, 4, 5],
        [6, 7, 8],
        [9, 10, 11],
      ];
      expect(isValidStepPattern(wrongSteps)).toBe(false);
    });

    it("should return false if voice is not an array", () => {
      const invalidPattern = [
        Array(NUM_STEPS).fill(0),
        Array(NUM_STEPS).fill(0),
        Array(NUM_STEPS).fill(0),
        "not an array", // invalid voice
      ];
      expect(isValidStepPattern(invalidPattern)).toBe(false);
    });
  });

  describe("ensureValidStepPattern", () => {
    it("should return valid pattern unchanged", () => {
      const validPattern = createDefaultStepPattern();
      const result = ensureValidStepPattern(validPattern);
      expect(result).toEqual(validPattern);
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
      const invalidPattern = [[1, 2, 3]]; // wrong dimensions
      const result = ensureValidStepPattern(invalidPattern);
      expect(isValidStepPattern(result)).toBe(true);
      expect(result).toEqual(createDefaultStepPattern());
    });
  });

  describe("FocusedStep interface", () => {
    it("should allow valid FocusedStep objects", () => {
      const focusedStep: FocusedStep = { step: 5, voice: 2 };
      expect(focusedStep.step).toBe(5);
      expect(focusedStep.voice).toBe(2);
    });
  });
});
