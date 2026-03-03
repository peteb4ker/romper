import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowLfoConfig } from "../ledConstants";
import type { Ripple } from "../ledMath";

import {
  applyLedStyle,
  computeBaseLfo,
  computeProximityBoost,
  computeRippleBoost,
  readGlowColor,
  saw,
  sine,
  triangle,
  waveFunction,
} from "../ledMath";

describe("ledMath", () => {
  describe("sine", () => {
    it("returns 0.5 at t=0", () => {
      expect(sine(0)).toBeCloseTo(0.5, 5);
    });

    it("returns 1 at t=0.25 (peak)", () => {
      expect(sine(0.25)).toBeCloseTo(1, 5);
    });

    it("returns 0.5 at t=0.5", () => {
      expect(sine(0.5)).toBeCloseTo(0.5, 5);
    });

    it("returns 0 at t=0.75 (trough)", () => {
      expect(sine(0.75)).toBeCloseTo(0, 5);
    });

    it("is periodic with period 1", () => {
      expect(sine(0)).toBeCloseTo(sine(1), 5);
      expect(sine(0.3)).toBeCloseTo(sine(1.3), 5);
    });

    it("outputs are in 0..1 range", () => {
      for (let t = 0; t < 2; t += 0.1) {
        const v = sine(t);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("triangle", () => {
    it("returns 0 at t=0", () => {
      expect(triangle(0)).toBeCloseTo(0, 5);
    });

    it("returns 1 at t=0.5 (peak)", () => {
      expect(triangle(0.5)).toBeCloseTo(1, 5);
    });

    it("returns 0 at t=1", () => {
      expect(triangle(1)).toBeCloseTo(0, 5);
    });

    it("is periodic with period 1", () => {
      expect(triangle(0.3)).toBeCloseTo(triangle(1.3), 5);
    });

    it("outputs are in 0..1 range", () => {
      for (let t = 0; t < 2; t += 0.1) {
        const v = triangle(t);
        expect(v).toBeGreaterThanOrEqual(-0.001);
        expect(v).toBeLessThanOrEqual(1.001);
      }
    });

    it("handles negative values", () => {
      const v = triangle(-0.25);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  describe("saw", () => {
    it("returns 0 at t=0", () => {
      expect(saw(0)).toBeCloseTo(0, 5);
    });

    it("returns close to 1 at t=0.999", () => {
      expect(saw(0.999)).toBeCloseTo(0.999, 2);
    });

    it("wraps around at t=1", () => {
      expect(saw(1)).toBeCloseTo(0, 5);
    });

    it("is periodic with period 1", () => {
      expect(saw(0.3)).toBeCloseTo(saw(1.3), 5);
    });

    it("outputs are in 0..1 range", () => {
      for (let t = 0; t < 2; t += 0.1) {
        const v = saw(t);
        expect(v).toBeGreaterThanOrEqual(-0.001);
        expect(v).toBeLessThanOrEqual(1.001);
      }
    });
  });

  describe("waveFunction", () => {
    it("dispatches to sine", () => {
      expect(waveFunction("sine", 0.25)).toBeCloseTo(sine(0.25), 5);
    });

    it("dispatches to triangle", () => {
      expect(waveFunction("triangle", 0.25)).toBeCloseTo(triangle(0.25), 5);
    });

    it("dispatches to saw", () => {
      expect(waveFunction("saw", 0.25)).toBeCloseTo(saw(0.25), 5);
    });
  });

  describe("computeBaseLfo", () => {
    const config: RowLfoConfig = {
      frequency: 0.12,
      phase: 0.0,
      spatialFreq: 0.3,
      wave: "sine",
    };

    it("returns a value in 0..1 range", () => {
      const v = computeBaseLfo(0, 0, 0, config, 1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });

    it("varies with time", () => {
      const v1 = computeBaseLfo(0, 0, 0, config, 1);
      const v2 = computeBaseLfo(0, 0, 5, config, 1);
      // Should produce different values at different times
      expect(v1).not.toBeCloseTo(v2, 2);
    });

    it("varies across columns", () => {
      const v1 = computeBaseLfo(0, 0, 1, config, 1);
      const v2 = computeBaseLfo(7, 0, 1, config, 1);
      expect(v1).not.toBeCloseTo(v2, 2);
    });
  });

  describe("computeProximityBoost", () => {
    const radiusSq = 12;
    const intensity = 0.6;

    it("returns max intensity at mouse position", () => {
      const boost = computeProximityBoost(5, 5, 5, 5, radiusSq, intensity);
      expect(boost).toBeCloseTo(intensity, 5);
    });

    it("returns 0 when far from mouse", () => {
      const boost = computeProximityBoost(0, 0, 20, 20, radiusSq, intensity);
      expect(boost).toBe(0);
    });

    it("falls off with distance", () => {
      const close = computeProximityBoost(5, 5, 6, 5, radiusSq, intensity);
      const far = computeProximityBoost(5, 5, 8, 5, radiusSq, intensity);
      expect(close).toBeGreaterThan(far);
    });

    it("returns 0 beyond radius", () => {
      // Distance squared = 25, which > radiusSq of 12
      const boost = computeProximityBoost(0, 0, 5, 0, radiusSq, intensity);
      expect(boost).toBe(0);
    });

    it("is symmetric", () => {
      const a = computeProximityBoost(3, 5, 5, 5, radiusSq, intensity);
      const b = computeProximityBoost(7, 5, 5, 5, radiusSq, intensity);
      expect(a).toBeCloseTo(b, 5);
    });
  });

  describe("computeRippleBoost", () => {
    const speed = 8;
    const width = 1.5;
    const duration = 1.2;

    it("returns 0 with no ripples", () => {
      const boost = computeRippleBoost(5, 5, 10, [], speed, width, duration);
      expect(boost).toBe(0);
    });

    it("returns positive value on the ripple ring", () => {
      const ripple: Ripple = { col: 5, row: 5, startTime: 10 };
      // At t=10.5, radius = 0.5 * 8 = 4
      // LED at distance 4 from center should be on the ring
      const boost = computeRippleBoost(
        9,
        5,
        10.5,
        [ripple],
        speed,
        width,
        duration,
      );
      expect(boost).toBeGreaterThan(0);
    });

    it("returns 0 for expired ripples", () => {
      const ripple: Ripple = { col: 5, row: 5, startTime: 0 };
      // duration is 1.2, so at time 2.0 it's expired
      const boost = computeRippleBoost(
        5,
        5,
        2.0,
        [ripple],
        speed,
        width,
        duration,
      );
      expect(boost).toBe(0);
    });

    it("fades over time", () => {
      const ripple: Ripple = { col: 5, row: 5, startTime: 10 };
      // Check at center right after start vs later
      const early = computeRippleBoost(
        5,
        5,
        10.01,
        [ripple],
        speed,
        width,
        duration,
      );
      const late = computeRippleBoost(
        5,
        5,
        11.0,
        [ripple],
        speed,
        width,
        duration,
      );
      expect(early).toBeGreaterThan(late);
    });

    it("handles multiple ripples and takes the max", () => {
      const ripples: Ripple[] = [
        { col: 5, row: 5, startTime: 10 },
        { col: 5, row: 5, startTime: 10.1 },
      ];
      const boost = computeRippleBoost(
        5,
        5,
        10.15,
        ripples,
        speed,
        width,
        duration,
      );
      // Should be at least as much as either single ripple
      const single = computeRippleBoost(
        5,
        5,
        10.15,
        [ripples[1]],
        speed,
        width,
        duration,
      );
      expect(boost).toBeGreaterThanOrEqual(single);
    });
  });

  describe("applyLedStyle", () => {
    it("sets opacity on element", () => {
      const el = document.createElement("div");
      applyLedStyle(el, 0.3, "224, 90, 96");
      expect(el.style.opacity).toBe("0.3");
    });

    it("clamps brightness to 0..1", () => {
      const el = document.createElement("div");
      applyLedStyle(el, 1.5, "224, 90, 96");
      expect(el.style.opacity).toBe("1");
    });

    it("adds glow box-shadow for bright LEDs", () => {
      const el = document.createElement("div");
      applyLedStyle(el, 0.8, "224, 90, 96");
      expect(el.style.boxShadow).toContain("rgba(224, 90, 96");
    });

    it("sets box-shadow to none for dim LEDs", () => {
      const el = document.createElement("div");
      applyLedStyle(el, 0.3, "224, 90, 96");
      expect(el.style.boxShadow).toBe("none");
    });
  });

  describe("readGlowColor", () => {
    beforeEach(() => {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "#e05a60",
      } as unknown as CSSStyleDeclaration);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("parses hex CSS variable to RGB string", () => {
      expect(readGlowColor()).toBe("224, 90, 96");
    });

    it("returns default when CSS variable is empty", () => {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "",
      } as unknown as CSSStyleDeclaration);
      expect(readGlowColor()).toBe("224, 90, 96");
    });
  });
});
