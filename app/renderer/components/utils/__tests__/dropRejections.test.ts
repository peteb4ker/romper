import { describe, expect, it } from "vitest";

import { formatDropRejections, listFileNames } from "../dropRejections";

describe("[UC-19] [UC-36] dropRejections (RE-40)", () => {
  describe("formatDropRejections", () => {
    it("returns null when nothing was rejected", () => {
      expect(formatDropRejections([], 2)).toBeNull();
    });

    it("names one file and says the voice is full", () => {
      expect(
        formatDropRejections([{ fileName: "kick.wav", reason: "full" }], 2),
      ).toEqual({
        text: "kick.wav wasn't added: voice 2 is full (12 samples). Delete one to make room.",
        type: "warning",
      });
    });

    it("says a duplicate is already in the voice", () => {
      expect(
        formatDropRejections(
          [{ fileName: "snare.wav", reason: "duplicate" }],
          3,
        )?.text,
      ).toBe("snare.wav wasn't added: it's already in voice 3.");
    });

    it("says only WAV files can be added", () => {
      expect(
        formatDropRejections([{ fileName: "notes.txt", reason: "notWav" }], 1)
          ?.text,
      ).toBe("notes.txt wasn't added: only WAV files can be added.");
    });

    it("says an unreadable WAV couldn't be read", () => {
      expect(
        formatDropRejections(
          [{ fileName: "broken.wav", reason: "unreadable" }],
          1,
        )?.text,
      ).toBe(
        "broken.wav wasn't added: it couldn't be read as WAV audio. Check the file and try again.",
      );
    });

    it("makes a failed check an error and asks to try again", () => {
      expect(
        formatDropRejections(
          [{ fileName: "kick.wav", reason: "checkFailed" }],
          1,
        ),
      ).toEqual({
        text: "kick.wav wasn't added: Romper couldn't check it. Try again.",
        type: "error",
      });
    });

    it("gives one message for several files, grouped by reason", () => {
      const message = formatDropRejections(
        [
          { fileName: "a.txt", reason: "notWav" },
          { fileName: "kick.wav", reason: "duplicate" },
          { fileName: "b.txt", reason: "notWav" },
          { fileName: "hat.wav", reason: "full" },
          { fileName: "tom.wav", reason: "full" },
        ],
        4,
      );
      expect(message).toEqual({
        text:
          "hat.wav and tom.wav weren't added: voice 4 is full (12 samples). Delete one to make room. " +
          "kick.wav wasn't added: it's already in voice 4. " +
          "a.txt and b.txt weren't added: only WAV files can be added.",
        type: "warning",
      });
    });

    it("uses plural wording for several files with one reason", () => {
      expect(
        formatDropRejections(
          [
            { fileName: "a.wav", reason: "unreadable" },
            { fileName: "b.wav", reason: "unreadable" },
          ],
          1,
        )?.text,
      ).toBe(
        "a.wav and b.wav weren't added: they couldn't be read as WAV audio. Check the files and try again.",
      );
      expect(
        formatDropRejections(
          [
            { fileName: "a.wav", reason: "duplicate" },
            { fileName: "b.wav", reason: "duplicate" },
          ],
          1,
        )?.text,
      ).toBe("a.wav and b.wav weren't added: they're already in voice 1.");
    });

    it("has no error prefix or raw error text", () => {
      const reasons = [
        "checkFailed",
        "duplicate",
        "full",
        "notWav",
        "unreadable",
      ] as const;
      for (const reason of reasons) {
        const text = formatDropRejections(
          [{ fileName: "x.wav", reason }],
          1,
        )?.text;
        expect(text).not.toMatch(/^Error|Error:|undefined|null/);
      }
    });
  });

  describe("listFileNames", () => {
    it("lists one, two and three names", () => {
      expect(listFileNames(["a.wav"])).toBe("a.wav");
      expect(listFileNames(["a.wav", "b.wav"])).toBe("a.wav and b.wav");
      expect(listFileNames(["a.wav", "b.wav", "c.wav"])).toBe(
        "a.wav, b.wav and c.wav",
      );
    });

    it("counts the names past three", () => {
      expect(listFileNames(["a", "b", "c", "d"])).toBe(
        "a, b, c and 1 more file",
      );
      expect(listFileNames(["a", "b", "c", "d", "e"])).toBe(
        "a, b, c and 2 more files",
      );
    });
  });
});
