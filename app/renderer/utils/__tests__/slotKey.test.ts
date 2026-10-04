import { describe, expect, it } from "vitest";

import { slotKey, slotSampleSource } from "../slotKey";

describe("slotKey", () => {
  it("keys by voice and slot", () => {
    expect(slotKey(2, 0)).toBe("2:0");
  });
});

describe("[UC-29] [UC-33] slotSampleSource (#575)", () => {
  const row = { filename: "dup.wav", source_path: "/a/dup.wav" };

  it("is the row's file when the row holds the slot's file", () => {
    expect(slotSampleSource(row, "dup.wav")).toBe("/a/dup.wav");
  });

  it("tells same-named files from different folders apart", () => {
    expect(
      slotSampleSource({ ...row, source_path: "/b/dup.wav" }, "dup.wav"),
    ).toBe("/b/dup.wav");
  });

  it("is unknown while the rows lag the slot", () => {
    expect(slotSampleSource(row, "kick.wav")).toBeNull();
    expect(slotSampleSource(undefined, "dup.wav")).toBeNull();
  });

  it("is unknown for an empty slot", () => {
    expect(slotSampleSource(row, null)).toBeNull();
    expect(slotSampleSource(row, "")).toBeNull();
  });
});
