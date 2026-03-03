import { describe, expect, it } from "vitest";

import {
  ICON_BASE_MAX,
  ICON_BASE_MIN,
  ICON_BASE_SCALE,
  ICON_COLS,
  ICON_LED_COUNT,
  ICON_MAX_RIPPLES,
  ICON_PROXIMITY_INTENSITY,
  ICON_PROXIMITY_RADIUS_SQ,
  ICON_RIPPLE_DURATION,
  ICON_RIPPLE_SPEED,
  ICON_RIPPLE_WIDTH,
  ICON_ROW_LFO_CONFIGS,
  ICON_ROWS,
  ICON_TIME_HOVER,
  ICON_TIME_IDLE,
} from "../ledIconConstants";

describe("ledIconConstants", () => {
  describe("grid dimensions", () => {
    it("defines a 14x5 grid matching the Rample layout", () => {
      expect(ICON_COLS).toBe(14);
      expect(ICON_ROWS).toBe(5);
    });

    it("ICON_LED_COUNT equals cols * rows", () => {
      expect(ICON_LED_COUNT).toBe(ICON_COLS * ICON_ROWS);
      expect(ICON_LED_COUNT).toBe(70);
    });
  });

  describe("ICON_ROW_LFO_CONFIGS", () => {
    it("has exactly 5 row configs (one per row)", () => {
      expect(ICON_ROW_LFO_CONFIGS).toHaveLength(ICON_ROWS);
    });

    it("each config has valid wave type", () => {
      const validTypes = ["sine", "triangle", "saw"];
      for (const config of ICON_ROW_LFO_CONFIGS) {
        expect(validTypes).toContain(config.wave);
      }
    });

    it("each config has positive frequency", () => {
      for (const config of ICON_ROW_LFO_CONFIGS) {
        expect(config.frequency).toBeGreaterThan(0);
      }
    });

    it("frequencies are in ambient range (0.08-0.35 Hz)", () => {
      for (const config of ICON_ROW_LFO_CONFIGS) {
        expect(config.frequency).toBeGreaterThanOrEqual(0.08);
        expect(config.frequency).toBeLessThanOrEqual(0.35);
      }
    });

    it("each config has non-negative phase", () => {
      for (const config of ICON_ROW_LFO_CONFIGS) {
        expect(config.phase).toBeGreaterThanOrEqual(0);
      }
    });

    it("each config has positive spatial frequency", () => {
      for (const config of ICON_ROW_LFO_CONFIGS) {
        expect(config.spatialFreq).toBeGreaterThan(0);
      }
    });
  });

  describe("time multipliers", () => {
    it("idle multiplier is slower than hover", () => {
      expect(ICON_TIME_IDLE).toBeLessThan(ICON_TIME_HOVER);
    });

    it("idle multiplier is positive", () => {
      expect(ICON_TIME_IDLE).toBeGreaterThan(0);
    });

    it("hover multiplier is 1.0 (full speed)", () => {
      expect(ICON_TIME_HOVER).toBe(1.0);
    });
  });

  describe("interaction constants", () => {
    it("proximity radius is positive", () => {
      expect(ICON_PROXIMITY_RADIUS_SQ).toBeGreaterThan(0);
    });

    it("proximity intensity is between 0 and 1", () => {
      expect(ICON_PROXIMITY_INTENSITY).toBeGreaterThan(0);
      expect(ICON_PROXIMITY_INTENSITY).toBeLessThanOrEqual(1);
    });

    it("ripple constants are positive", () => {
      expect(ICON_RIPPLE_SPEED).toBeGreaterThan(0);
      expect(ICON_RIPPLE_WIDTH).toBeGreaterThan(0);
      expect(ICON_RIPPLE_DURATION).toBeGreaterThan(0);
    });

    it("max ripples is reasonable", () => {
      expect(ICON_MAX_RIPPLES).toBeGreaterThan(0);
      expect(ICON_MAX_RIPPLES).toBeLessThanOrEqual(10);
    });
  });

  describe("brightness range", () => {
    it("ICON_BASE_MIN is less than ICON_BASE_MAX", () => {
      expect(ICON_BASE_MIN).toBeLessThan(ICON_BASE_MAX);
    });

    it("both are in 0..1 range", () => {
      expect(ICON_BASE_MIN).toBeGreaterThanOrEqual(0);
      expect(ICON_BASE_MIN).toBeLessThanOrEqual(1);
      expect(ICON_BASE_MAX).toBeGreaterThanOrEqual(0);
      expect(ICON_BASE_MAX).toBeLessThanOrEqual(1);
    });

    it("ICON_BASE_SCALE equals max minus min", () => {
      expect(ICON_BASE_SCALE).toBeCloseTo(ICON_BASE_MAX - ICON_BASE_MIN);
    });
  });
});
