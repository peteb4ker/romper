import { describe, expect, it } from "vitest";

import {
  BASE_MAX,
  BASE_MIN,
  LED_COLS,
  LED_COUNT,
  LED_ROWS,
  MAX_RIPPLES,
  PROXIMITY_INTENSITY,
  PROXIMITY_RADIUS_SQ,
  RIPPLE_DURATION,
  RIPPLE_SPEED,
  RIPPLE_WIDTH,
  ROW_LFO_CONFIGS,
} from "../ledConstants";

describe("ledConstants", () => {
  describe("grid dimensions", () => {
    it("defines a 28x16 grid", () => {
      expect(LED_COLS).toBe(28);
      expect(LED_ROWS).toBe(16);
    });

    it("LED_COUNT equals cols * rows", () => {
      expect(LED_COUNT).toBe(LED_COLS * LED_ROWS);
      expect(LED_COUNT).toBe(448);
    });
  });

  describe("ROW_LFO_CONFIGS", () => {
    it("has exactly 16 row configs (one per row)", () => {
      expect(ROW_LFO_CONFIGS).toHaveLength(LED_ROWS);
    });

    it("each config has valid wave type", () => {
      const validTypes = ["sine", "triangle", "saw"];
      for (const config of ROW_LFO_CONFIGS) {
        expect(validTypes).toContain(config.wave);
      }
    });

    it("each config has positive frequency", () => {
      for (const config of ROW_LFO_CONFIGS) {
        expect(config.frequency).toBeGreaterThan(0);
      }
    });

    it("frequencies are in ambient range (0.08-0.35 Hz)", () => {
      for (const config of ROW_LFO_CONFIGS) {
        expect(config.frequency).toBeGreaterThanOrEqual(0.08);
        expect(config.frequency).toBeLessThanOrEqual(0.35);
      }
    });

    it("each config has non-negative phase", () => {
      for (const config of ROW_LFO_CONFIGS) {
        expect(config.phase).toBeGreaterThanOrEqual(0);
      }
    });

    it("each config has positive spatial frequency", () => {
      for (const config of ROW_LFO_CONFIGS) {
        expect(config.spatialFreq).toBeGreaterThan(0);
      }
    });
  });

  describe("interaction constants", () => {
    it("proximity radius is positive", () => {
      expect(PROXIMITY_RADIUS_SQ).toBeGreaterThan(0);
    });

    it("proximity intensity is between 0 and 1", () => {
      expect(PROXIMITY_INTENSITY).toBeGreaterThan(0);
      expect(PROXIMITY_INTENSITY).toBeLessThanOrEqual(1);
    });

    it("ripple constants are positive", () => {
      expect(RIPPLE_SPEED).toBeGreaterThan(0);
      expect(RIPPLE_WIDTH).toBeGreaterThan(0);
      expect(RIPPLE_DURATION).toBeGreaterThan(0);
    });

    it("max ripples is reasonable", () => {
      expect(MAX_RIPPLES).toBeGreaterThan(0);
      expect(MAX_RIPPLES).toBeLessThanOrEqual(20);
    });
  });

  describe("brightness range", () => {
    it("BASE_MIN is less than BASE_MAX", () => {
      expect(BASE_MIN).toBeLessThan(BASE_MAX);
    });

    it("both are in 0..1 range", () => {
      expect(BASE_MIN).toBeGreaterThanOrEqual(0);
      expect(BASE_MIN).toBeLessThanOrEqual(1);
      expect(BASE_MAX).toBeGreaterThanOrEqual(0);
      expect(BASE_MAX).toBeLessThanOrEqual(1);
    });
  });
});
