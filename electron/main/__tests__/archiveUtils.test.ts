import { describe, expect, it } from "vitest";

import { isValidEntry } from "../archiveUtils";

describe("isValidEntry", () => {
  it("returns false for __MACOSX/ entries", () => {
    expect(isValidEntry("__MACOSX/._foo.wav")).toBe(false);
    expect(isValidEntry("__MACOSX/foo.wav")).toBe(false);
    expect(isValidEntry("foo/__MACOSX/bar.wav")).toBe(false);
  });

  it("returns false for dot-underscore files anywhere in path", () => {
    expect(isValidEntry("._foo.wav")).toBe(false);
    expect(isValidEntry("foo/._bar.wav")).toBe(false);
    expect(isValidEntry("foo/bar/._baz.wav")).toBe(false);
  });

  it("returns true for normal files and directories", () => {
    expect(isValidEntry("foo.wav")).toBe(true);
    expect(isValidEntry("foo/bar.wav")).toBe(true);
    expect(isValidEntry("foo/bar/baz.wav")).toBe(true);
    expect(isValidEntry("folder/normalfile.txt")).toBe(true);
  });
});
