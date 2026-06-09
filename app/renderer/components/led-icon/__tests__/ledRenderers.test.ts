import { beforeEach, describe, expect, it } from "vitest";

import type { Ripple } from "../../dialogs/led-grid/ledMath";

import { renderAmbientLed, renderVuLed } from "../ledRenderers";
import {
  VU_BORDER_BRIGHTNESS,
  VU_LIT_MIN_BRIGHTNESS,
  VU_PEAK_BRIGHTNESS,
  VU_UNLIT_BRIGHTNESS,
} from "../vuMeterConstants";

const GLOW = "224, 90, 96";
const VOICE_GLOW = "10, 20, 30";

const baseVuOptions = {
  ambientMix: 0,
  defaultGlowColor: GLOW,
  rawTime: 100,
  ripples: [] as Ripple[],
  time: 1,
  voiceBarHeights: { 1: 0, 2: 0, 3: 0, 4: 0 },
  voiceGlowColors: { 1: VOICE_GLOW },
  voicePeakRows: { 1: -1, 2: -1, 3: -1, 4: -1 },
};

describe("ledRenderers", () => {
  let el: HTMLDivElement;

  beforeEach(() => {
    el = document.createElement("div");
  });

  describe("renderVuLed", () => {
    it("paints border columns dim with no voice colour", () => {
      renderVuLed({ ...baseVuOptions, col: 0, el, row: 2 });

      expect(el.style.opacity).toBe(String(VU_BORDER_BRIGHTNESS));
      expect(el.style.backgroundColor).toBe("");
      expect(el.style.boxShadow).toBe("none");
    });

    it("paints unlit voice LEDs at the unlit floor with a faint voice colour", () => {
      // Col 1 belongs to voice 1; bar height 0 means nothing is lit
      renderVuLed({ ...baseVuOptions, col: 1, el, row: 0 });

      expect(el.style.opacity).toBe(String(VU_UNLIT_BRIGHTNESS));
      // Unlit LEDs keep a faint 0.05-alpha wash of the voice colour
      expect(el.style.backgroundColor).toContain("0.05");
    });

    it("paints lit voice LEDs with brightness from the bar height", () => {
      // Full bar on voice 1: bottom row is the dimmest lit LED
      renderVuLed({
        ...baseVuOptions,
        col: 1,
        el,
        row: 4,
        voiceBarHeights: { ...baseVuOptions.voiceBarHeights, 1: 5 },
      });

      expect(Number(el.style.opacity)).toBeCloseTo(VU_LIT_MIN_BRIGHTNESS);
      expect(el.style.backgroundColor).not.toBe("");
    });

    it("paints the peak row at full brightness", () => {
      renderVuLed({
        ...baseVuOptions,
        col: 1,
        el,
        row: 1,
        voicePeakRows: { ...baseVuOptions.voicePeakRows, 1: 1 },
      });

      expect(Number(el.style.opacity)).toBe(VU_PEAK_BRIGHTNESS);
      // Full brightness exceeds the 0.5 glow threshold
      expect(el.style.boxShadow).not.toBe("none");
    });

    it("clears the voice colour and blends toward ambient when the cross-fade passes half", () => {
      renderVuLed({
        ...baseVuOptions,
        ambientMix: 0.8,
        col: 1,
        el,
        row: 1,
        voicePeakRows: { ...baseVuOptions.voicePeakRows, 1: 1 },
      });

      expect(el.style.backgroundColor).toBe("");
      // Blended: well below the pure peak brightness of 1
      expect(Number(el.style.opacity)).toBeLessThan(VU_PEAK_BRIGHTNESS);
      expect(Number(el.style.opacity)).toBeGreaterThan(0);
    });

    it("adds ripple boost on top of the base brightness", () => {
      const without = document.createElement("div");
      renderVuLed({ ...baseVuOptions, col: 1, el: without, row: 0 });

      const ripple: Ripple = { col: 1, row: 0, startTime: 100 };
      renderVuLed({ ...baseVuOptions, col: 1, el, ripples: [ripple], row: 0 });

      expect(Number(el.style.opacity)).toBeGreaterThan(
        Number(without.style.opacity),
      );
    });
  });

  describe("renderAmbientLed", () => {
    const baseAmbientOptions = {
      col: 3,
      glowColor: GLOW,
      isHovered: false,
      mouse: null,
      rawTime: 100,
      ripples: [] as Ripple[],
      row: 2,
      time: 1,
    };

    it("paints a base LFO brightness with no background colour", () => {
      renderAmbientLed({ ...baseAmbientOptions, el });

      expect(el.style.backgroundColor).toBe("");
      const opacity = Number(el.style.opacity);
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThanOrEqual(1);
    });

    it("boosts brightness near the hovered cell", () => {
      const idle = document.createElement("div");
      renderAmbientLed({ ...baseAmbientOptions, el: idle });

      renderAmbientLed({
        ...baseAmbientOptions,
        el,
        isHovered: true,
        mouse: { col: 3, row: 2 },
      });

      expect(Number(el.style.opacity)).toBeGreaterThan(
        Number(idle.style.opacity),
      );
    });

    it("ignores the mouse position when not hovered", () => {
      const idle = document.createElement("div");
      renderAmbientLed({ ...baseAmbientOptions, el: idle });

      renderAmbientLed({
        ...baseAmbientOptions,
        el,
        mouse: { col: 3, row: 2 },
      });

      expect(el.style.opacity).toBe(idle.style.opacity);
    });
  });
});
