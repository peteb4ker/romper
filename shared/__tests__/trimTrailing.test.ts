import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { trimTrailing } from "../trimTrailing";

// The regexes trimTrailing replaced (SonarCloud S8786), as the reference
const REGEX_FOR: Record<string, RegExp> = {
  " .": /[ .]+$/,
  "/": /\/+$/,
  "\\": /\\+$/,
};

describe("[UC-34] [Q-07] trimTrailing", () => {
  it("drops a trailing run of any of the characters", () => {
    expect(trimTrailing("snap. . ", " .")).toBe("snap");
  });

  it("keeps the characters inside the text", () => {
    expect(trimTrailing(". snap. .wbl. ", " .")).toBe(". snap. .wbl");
  });

  it("returns an empty string for text of only those characters", () => {
    expect(trimTrailing(" . .. ", " .")).toBe("");
    expect(trimTrailing("....", ".")).toBe("");
  });

  it("returns an empty string for empty text", () => {
    expect(trimTrailing("", " .")).toBe("");
  });

  it("returns the text unchanged when it doesn't end in one", () => {
    expect(trimTrailing("snap", " .")).toBe("snap");
  });

  it("drops only the given separator from a path ending in mixed slashes", () => {
    expect(trimTrailing("C:\\Samples\\//", "/")).toBe("C:\\Samples\\");
    expect(trimTrailing("/Users/me/\\\\", "\\")).toBe("/Users/me/");
  });

  it("matches the regex it replaced on any text", () => {
    const text = fc.string({
      unit: fc.constantFrom(" ", ".", "/", "\\", "a"),
    });
    const chars = fc.constantFrom(...Object.keys(REGEX_FOR));
    fc.assert(
      fc.property(text, chars, (t, c) => {
        expect(trimTrailing(t, c)).toBe(t.replace(REGEX_FOR[c], ""));
      }),
    );
  });
});
