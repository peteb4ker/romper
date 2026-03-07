import { afterEach, describe, expect, it } from "vitest";

import {
  clearAllLevels,
  clearVoiceLevel,
  getAllLevels,
  getVoiceLevel,
  hasActiveVoices,
  setVoiceLevel,
} from "../audioLevels";

describe("audioLevels", () => {
  afterEach(() => {
    clearAllLevels();
  });

  it("returns undefined for unset voice", () => {
    expect(getVoiceLevel(1)).toBeUndefined();
  });

  it("sets and gets voice level", () => {
    setVoiceLevel(1, { isStereo: false, left: 0.5, right: 0.5 });
    const level = getVoiceLevel(1);
    expect(level).toEqual({ isStereo: false, left: 0.5, right: 0.5 });
  });

  it("clears a specific voice level", () => {
    setVoiceLevel(1, { isStereo: false, left: 0.5, right: 0.5 });
    setVoiceLevel(2, { isStereo: false, left: 0.3, right: 0.3 });
    clearVoiceLevel(1);
    expect(getVoiceLevel(1)).toBeUndefined();
    expect(getVoiceLevel(2)).toBeDefined();
  });

  it("reports hasActiveVoices correctly", () => {
    expect(hasActiveVoices()).toBe(false);
    setVoiceLevel(1, { isStereo: false, left: 0.5, right: 0.5 });
    expect(hasActiveVoices()).toBe(true);
    clearVoiceLevel(1);
    expect(hasActiveVoices()).toBe(false);
  });

  it("clears all levels", () => {
    setVoiceLevel(1, { isStereo: false, left: 0.5, right: 0.5 });
    setVoiceLevel(2, { isStereo: false, left: 0.3, right: 0.3 });
    clearAllLevels();
    expect(hasActiveVoices()).toBe(false);
    expect(getVoiceLevel(1)).toBeUndefined();
    expect(getVoiceLevel(2)).toBeUndefined();
  });

  it("overwrites existing voice level", () => {
    setVoiceLevel(1, { isStereo: false, left: 0.5, right: 0.5 });
    setVoiceLevel(1, { isStereo: true, left: 0.8, right: 0.2 });
    expect(getVoiceLevel(1)).toEqual({ isStereo: true, left: 0.8, right: 0.2 });
  });

  it("getAllLevels returns the internal map", () => {
    setVoiceLevel(1, { isStereo: false, left: 0.5, right: 0.5 });
    setVoiceLevel(3, { isStereo: false, left: 0.7, right: 0.7 });
    const all = getAllLevels();
    expect(all.size).toBe(2);
    expect(all.has(1)).toBe(true);
    expect(all.has(3)).toBe(true);
  });
});
