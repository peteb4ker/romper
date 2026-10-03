import { describe, expect, it } from "vitest";

import {
  bpmError,
  firstError,
  gainError,
  sampleModeError,
  slotNumberError,
  voiceNumberError,
  volumeError,
} from "../ipcValidation.js";

// RE-25: main had no range or enum checks, so a glitch in the renderer could
// save a setting the Rample can't use.
describe("[Q-02] IPC setting validation (RE-25)", () => {
  const notNumbers = [Number.NaN, Infinity, -Infinity, "50", null, undefined];

  describe("volume", () => {
    it.each([0, 1, 50, 100])("accepts %s", (v) => {
      expect(volumeError(v)).toBeNull();
    });
    it.each([-1, 101, 50.5, 1000, ...notNumbers])("refuses %s", (v) => {
      expect(volumeError(v)).toMatch(/^Volume must be a whole number/);
    });
  });

  describe("gain", () => {
    it.each([-24, -6.5, 0, 0.25, 12])("accepts %s dB", (v) => {
      expect(gainError(v)).toBeNull();
    });
    it.each([-24.1, 12.01, -100, 99, ...notNumbers])("refuses %s", (v) => {
      expect(gainError(v)).toMatch(/^Gain must be from -24 to \+12 dB/);
    });
  });

  describe("tempo", () => {
    it.each([30, 120, 180])("accepts %s BPM", (v) => {
      expect(bpmError(v)).toBeNull();
    });
    it.each([29, 181, 120.5, 0, ...notNumbers])("refuses %s", (v) => {
      expect(bpmError(v)).toMatch(
        /^Tempo must be a whole number from 30 to 180/,
      );
    });
  });

  describe("sample mode", () => {
    it.each(["first", "random", "round-robin"])("accepts %s", (mode) => {
      expect(sampleModeError(mode)).toBeNull();
    });
    it.each(["First", "roundrobin", "", "last", 1, null, undefined])(
      "refuses %j",
      (mode) => {
        expect(sampleModeError(mode)).toMatch(
          /^Sample mode must be first, random, round-robin/,
        );
      },
    );
  });

  describe("voice and slot numbers", () => {
    it.each([1, 2, 3, 4])("accepts voice %s", (v) => {
      expect(voiceNumberError(v)).toBeNull();
    });
    it.each([0, 5, 1.5, -1, ...notNumbers])("refuses voice %s", (v) => {
      expect(voiceNumberError(v)).toMatch(/^Voice must be a whole number/);
    });
    it.each([0, 5, 11])("accepts slot %s", (s) => {
      expect(slotNumberError(s)).toBeNull();
    });
    it.each([-1, 12, 2.5, ...notNumbers])("refuses slot %s", (s) => {
      expect(slotNumberError(s)).toMatch(/^Slot must be a whole number/);
    });
  });

  it("names the value it refuses", () => {
    expect(volumeError(150)).toBe(
      "Volume must be a whole number from 0 to 100, not 150",
    );
    expect(sampleModeError("loop")).toBe(
      'Sample mode must be first, random, round-robin, not "loop"',
    );
    expect(bpmError(undefined)).toBe(
      "Tempo must be a whole number from 30 to 180 BPM, not undefined",
    );
  });

  describe("firstError", () => {
    it("returns null when every check passes", () => {
      expect(firstError(null, null)).toBeNull();
    });
    it("returns the first error as a failed result", () => {
      expect(firstError(null, "first", "second")).toEqual({
        error: "first",
        success: false,
      });
    });
  });
});
