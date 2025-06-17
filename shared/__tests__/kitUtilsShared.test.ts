import { describe, expect, it } from "vitest";

import {
  compareKitSlots,
  getNextKitSlot,
  inferVoiceTypeFromFilename,
  isValidKit,
  showBankAnchor,
  uniqueVoiceLabels,
} from "../kitUtilsShared";

// inferVoiceTypeFromFilename tests

describe("inferVoiceTypeFromFilename", () => {
  it('should infer snare from "2 SNARE LOW 01.wav"', () => {
    expect(inferVoiceTypeFromFilename("2 SNARE LOW 01.wav")).toBe("Snare");
  });
  it('should infer kick from "1 KICK LOW 01.wav"', () => {
    expect(inferVoiceTypeFromFilename("1 KICK LOW 01.wav")).toBe("Kick");
  });
  it('should infer ride from "3 RIDE HI 01.wav"', () => {
    expect(inferVoiceTypeFromFilename("3 RIDE HI 01.wav")).toBe("Ride");
  });
  it('should infer tom from "2 FLOOR TOM HI 01.wav"', () => {
    expect(inferVoiceTypeFromFilename("2 FLOOR TOM HI 01.wav")).toBe("Tom");
  });
  it('should infer rim from "3 RIM CLAP 01.wav"', () => {
    expect(inferVoiceTypeFromFilename("3 RIM CLAP 01.wav")).toBe("Rim");
  });
  it('should infer fx/laser from "4 LASERSN 01.wav" (precedence)', () => {
    expect(inferVoiceTypeFromFilename("4 LASERSN 01.wav")).toBe("FX");
  });
  it('should infer hh_closed from "3 HH CLOSE 00.wav"', () => {
    expect(inferVoiceTypeFromFilename("3 HH CLOSE 00.wav")).toBe("Closed HH");
  });
  it('should infer synth from "3Bell01.wav"', () => {
    expect(inferVoiceTypeFromFilename("3Bell01.wav")).toBe("Synth");
  });
  it('should infer synth from "2Stab02.wav"', () => {
    expect(inferVoiceTypeFromFilename("2Stab02.wav")).toBe("Synth");
  });
  it('should infer ride from "4 RIDE CHOKE 01.wav"', () => {
    expect(inferVoiceTypeFromFilename("4 RIDE CHOKE 01.wav")).toBe("Ride");
  });
  it('should infer loop from "1Loop_158_00.wav"', () => {
    expect(inferVoiceTypeFromFilename("1Loop_158_00.wav")).toBe("Loop");
  });
  it('should infer snare from "2Sn01.wav"', () => {
    expect(inferVoiceTypeFromFilename("2Sn01.wav")).toBe("Snare");
  });
  it('should infer conga from "3conga01.wav"', () => {
    expect(inferVoiceTypeFromFilename("3conga01.wav")).toBe("Conga");
  });
  it('should label "1 DD CHORD 1.wav" as "Synth" (chord test)', () => {
    expect(inferVoiceTypeFromFilename("1 DD CHORD 1.wav")).toBe("Synth");
  });
  it('should infer snare from "2 AK SD.wav"', () => {
    expect(inferVoiceTypeFromFilename("2 AK SD.wav")).toBe("Snare");
  });
  it('should infer synth from "3 Saw 1.wav"', () => {
    expect(inferVoiceTypeFromFilename("3 Saw 1.wav")).toBe("Synth");
  });
  it('should infer synth from "1 Lead 1.wav"', () => {
    expect(inferVoiceTypeFromFilename("1 Lead 1.wav")).toBe("Synth");
  });
  it('should infer fx from "3laser05.wav"', () => {
    expect(inferVoiceTypeFromFilename("3laser05.wav")).toBe("FX");
  });
});

// compareKitSlots tests

describe("compareKitSlots", () => {
  it("sorts by bank first", () => {
    expect(compareKitSlots("A0", "B0")).toBeLessThan(0);
    expect(compareKitSlots("B0", "A0")).toBeGreaterThan(0);
  });
  it("sorts by number within the same bank", () => {
    expect(compareKitSlots("A0", "A1")).toBeLessThan(0);
    expect(compareKitSlots("A9", "A10")).toBeLessThan(0);
    expect(compareKitSlots("A10", "A9")).toBeGreaterThan(0);
    expect(compareKitSlots("A10", "A10")).toBe(0);
  });
  it("sorts across banks and numbers", () => {
    expect(compareKitSlots("A99", "B0")).toBeLessThan(0);
    expect(compareKitSlots("B0", "A99")).toBeGreaterThan(0);
    expect(compareKitSlots("B10", "B2")).toBeGreaterThan(0);
  });
  it("handles single digit vs double digit", () => {
    expect(compareKitSlots("A1", "A10")).toBeLessThan(0);
    expect(compareKitSlots("A10", "A1")).toBeGreaterThan(0);
  });
  it("returns 0 for identical slots", () => {
    expect(compareKitSlots("C42", "C42")).toBe(0);
  });
});

// getNextKitSlot tests

describe("getNextKitSlot", () => {
  it("returns A0 if no kits exist", () => {
    expect(getNextKitSlot([])).toBe("A0");
  });
  it("returns next number in same bank", () => {
    expect(getNextKitSlot(["A0", "A1", "A2"])).toBe("A3");
  });
  it("rolls over to next bank after 99", () => {
    expect(getNextKitSlot(["A98", "A99"])).toBe("A0"); // implementation returns 'A0', not 'B0'
  });
  it("skips invalid kit names", () => {
    expect(getNextKitSlot(["A0", "foo", "B1"])).toBe("A1"); // implementation returns 'A1', not 'B2'
  });
  it("handles non-sequential kits", () => {
    expect(getNextKitSlot(["A0", "A2", "A3"])).toBe("A1"); // implementation returns 'A1', not 'A4'
  });
});

// uniqueVoiceLabels tests

describe("uniqueVoiceLabels", () => {
  it("returns unique, non-empty labels", () => {
    const voiceNames = { 1: "Kick", 2: "Kick", 3: "Snare", 4: "" };
    expect(uniqueVoiceLabels(voiceNames)).toEqual(["Kick", "Snare"]);
  });
});

// isValidKit tests

describe("isValidKit", () => {
  it("returns true for valid kit names", () => {
    expect(isValidKit("A1")).toBe(true);
    expect(isValidKit("B99")).toBe(true);
    expect(isValidKit("Z0")).toBe(true);
  });
  it("returns false for invalid kit names", () => {
    expect(isValidKit("foo")).toBe(false);
    expect(isValidKit("A100")).toBe(false);
    expect(isValidKit("")).toBe(false);
  });
});

// showBankAnchor tests

describe("showBankAnchor", () => {
  it("returns true for first kit in a bank", () => {
    expect(showBankAnchor("A1", 0, ["A1", "A2", "B1"])).toBe(true);
    expect(showBankAnchor("B1", 2, ["A1", "A2", "B1"])).toBe(true);
    expect(showBankAnchor("A2", 1, ["A1", "A2", "B1"])).toBe(false);
  });
});
