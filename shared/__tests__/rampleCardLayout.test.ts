import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  cardKitFolders,
  cardSampleFileName,
  DEVICE_SAVE_FOLDER,
  isBankLetter,
  isDeviceSaveFolderName,
  isKitName,
  kitNameOfCardFolder,
  MAX_CARD_FILE_NAME_LENGTH,
  parseBankNameFile,
  voiceOfCardFile,
} from "../rampleCardLayout";

describe("[UC-34] rampleCardLayout", () => {
  describe("cardSampleFileName", () => {
    it("puts the voice first and a 1-based, zero-padded slot after it", () => {
      expect(cardSampleFileName(1, 0, "kick.wav")).toBe("1-01 kick.wav");
      expect(cardSampleFileName(4, 11, "crash.wav")).toBe("4-12 crash.wav");
    });

    it("drops the voice prefix of factory-style names", () => {
      expect(cardSampleFileName(1, 0, "1 KICK LOW 01.wav")).toBe(
        "1-01 KICK LOW 01.wav",
      );
      expect(cardSampleFileName(3, 1, "3_hat.wav")).toBe("3-02 hat.wav");
      expect(cardSampleFileName(4, 0, "4KICK.wav")).toBe("4-01 KICK.wav");
      expect(cardSampleFileName(2, 0, "2.wav")).toBe("2-01.wav");
    });

    it("doesn't prefix a name it already wrote a second time", () => {
      const once = cardSampleFileName(1, 0, "KICK.wav");
      expect(cardSampleFileName(2, 4, once)).toBe("2-05 KICK.wav");
    });

    it("keeps a leading digit that isn't a voice", () => {
      expect(cardSampleFileName(1, 0, "808 boom.wav")).toBe(
        "1-01 808 boom.wav",
      );
      expect(cardSampleFileName(1, 0, "5 hits.wav")).toBe("1-01 5 hits.wav");
    });

    it("always writes a lower-case .wav extension", () => {
      expect(cardSampleFileName(1, 0, "KICK.WAV")).toBe("1-01 KICK.wav");
    });

    it("replaces characters FAT32 can't store", () => {
      expect(cardSampleFileName(1, 0, 'a:b*c?"d<e>f|g\\h.wav')).toBe(
        "1-01 a_b_c__d_e_f_g_h.wav",
      );
    });

    it("trims leading and trailing spaces and dots", () => {
      expect(cardSampleFileName(1, 0, "  .snap wbl .wav")).toBe(
        "1-01 snap wbl.wav",
      );
    });

    it("keeps spaces and dots inside the name", () => {
      expect(cardSampleFileName(1, 0, ". snap. .wbl. .wav")).toBe(
        "1-01 snap. .wbl.wav",
      );
    });

    it("writes only the prefix for a name of nothing but spaces and dots", () => {
      expect(cardSampleFileName(1, 0, " . .. .wav")).toBe("1-01.wav");
      expect(cardSampleFileName(1, 0, "....wav")).toBe("1-01.wav");
    });

    it("writes only the prefix for an empty name", () => {
      expect(cardSampleFileName(1, 0, ".wav")).toBe("1-01.wav");
      expect(cardSampleFileName(1, 0, "")).toBe("1-01.wav");
    });

    it("shortens long names to the length limit", () => {
      const name = cardSampleFileName(1, 0, `${"x".repeat(200)}.wav`);
      expect(name).toHaveLength(MAX_CARD_FILE_NAME_LENGTH);
      expect(name).toMatch(/^1-01 x+\.wav$/);
    });

    it("rejects voices and slots outside the card's range", () => {
      expect(() => cardSampleFileName(0, 0, "a.wav")).toThrow(/Voice/);
      expect(() => cardSampleFileName(5, 0, "a.wav")).toThrow(/Voice/);
      expect(() => cardSampleFileName(1, -1, "a.wav")).toThrow(/Slot/);
      expect(() => cardSampleFileName(1, 1.5, "a.wav")).toThrow(/Slot/);
    });

    describe("properties", () => {
      const voiceArb = fc.integer({ max: 4, min: 1 });
      const slotArb = fc.integer({ max: 11, min: 0 });

      it("is a valid card sample for its voice, within the length limit", () => {
        fc.assert(
          fc.property(voiceArb, slotArb, fc.string(), (voice, slot, name) => {
            const fileName = cardSampleFileName(voice, slot, name);
            expect(voiceOfCardFile(fileName)).toBe(voice);
            expect(fileName).toMatch(/\.wav$/);
            expect(fileName.length).toBeLessThanOrEqual(
              MAX_CARD_FILE_NAME_LENGTH,
            );
            expect(fileName).not.toMatch(/[\u0000-\u001f"*/:<>?\\|]/);
          }),
        );
      });

      it("orders a voice's layers by slot under any sort", () => {
        fc.assert(
          fc.property(
            voiceArb,
            fc.array(fc.string(), { maxLength: 12, minLength: 2 }),
            (voice, names) => {
              const fileNames = names.map((name, slot) =>
                cardSampleFileName(voice, slot, name),
              );
              const byCharacter = [...fileNames].sort();
              const natural = [...fileNames].sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true }),
              );
              const slotsOf = (sorted: string[]) =>
                sorted.map((f) => f.slice(2, 4));
              const inOrder = fileNames.map((f) => f.slice(2, 4));
              expect(slotsOf(byCharacter)).toEqual(inOrder);
              expect(slotsOf(natural)).toEqual(inOrder);
            },
          ),
        );
      });

      it("renaming a card file again keeps only the new prefix", () => {
        fc.assert(
          fc.property(
            voiceArb,
            slotArb,
            voiceArb,
            slotArb,
            fc.string(),
            (voice, slot, otherVoice, otherSlot, name) => {
              const once = cardSampleFileName(otherVoice, otherSlot, name);
              expect(cardSampleFileName(voice, slot, once)).toBe(
                cardSampleFileName(voice, slot, cardSampleFileName(1, 0, name)),
              );
            },
          ),
        );
      });
    });
  });

  describe("voiceOfCardFile", () => {
    it("reads the voice from the first character", () => {
      expect(voiceOfCardFile("1 KICK.wav")).toBe(1);
      expect(voiceOfCardFile("4-12 crash.wav")).toBe(4);
    });

    it("returns null for names that don't start with 1-4", () => {
      expect(voiceOfCardFile("0kick.wav")).toBeNull();
      expect(voiceOfCardFile("5kick.wav")).toBeNull();
      expect(voiceOfCardFile("kick.wav")).toBeNull();
      expect(voiceOfCardFile("")).toBeNull();
    });
  });

  // #564: setup reads the card's bank names with the pattern the write
  // uses to find them
  describe("[UC-12] parseBankNameFile", () => {
    it("reads the letter, upper-cased, and the name", () => {
      expect(parseBankNameFile("A - ALWIS.rtf")).toEqual({
        letter: "A",
        name: "ALWIS",
      });
      expect(parseBankNameFile("z - Late Night - Mix.RTF")).toEqual({
        letter: "Z",
        name: "Late Night - Mix",
      });
    });

    it.each([
      "AB - Two letters.rtf",
      "1 - Digit.rtf",
      "É - Accent.rtf",
      "A-NoSpaces.rtf",
      "A - .rtf",
      "A - Text.txt",
      "A0",
    ])("isn't a bank name file: %s", (fileName) => {
      expect(parseBankNameFile(fileName)).toBeNull();
    });
  });

  // #573: one rule for kit names and bank letters, which setup, the write
  // and every kit or bank check use
  describe("[Q-04] the device's save folder (#787)", () => {
    it("is named _save", () => {
      expect(DEVICE_SAVE_FOLDER).toBe("_save");
    });

    it.each(["_save", "_SAVE", "_Save", "_save.", "_save .", "_save "])(
      "%j is the save folder",
      (name) => {
        expect(isDeviceSaveFolderName(name)).toBe(true);
      },
    );

    it.each(["save", "_saved", ".save", "_save/A0.rpl", "A0", ""])(
      "%j isn't",
      (name) => {
        expect(isDeviceSaveFolderName(name)).toBe(false);
      },
    );

    it("isn't a kit folder or a bank name file", () => {
      expect(kitNameOfCardFolder(DEVICE_SAVE_FOLDER)).toBeNull();
      expect(parseBankNameFile(DEVICE_SAVE_FOLDER)).toBeNull();
    });
  });

  describe("[Q-04] kit names and bank letters", () => {
    it.each(["A0", "A1", "B10", "Z99", "A01"])("%s is a kit name", (name) => {
      expect(isKitName(name)).toBe(true);
    });

    it.each(["a0", "Ä1", "A100", "A", "0A", "AA1", "A-1", "", " A1", "A1 "])(
      "%s isn't a kit name",
      (name) => {
        expect(isKitName(name)).toBe(false);
      },
    );

    it("isn't fooled by a value that isn't a string", () => {
      expect(isKitName(undefined)).toBe(false);
      expect(isBankLetter(65)).toBe(false);
    });

    it("takes one capital A to Z as a bank letter", () => {
      expect(isBankLetter("A")).toBe(true);
      expect(isBankLetter("Z")).toBe(true);
      for (const letter of ["a", "Ä", "É", "AA", "1", "", ".*"]) {
        expect(isBankLetter(letter)).toBe(false);
      }
    });

    it("reads a kit folder in either case as the kit's upper-case name", () => {
      expect(kitNameOfCardFolder("A5")).toBe("A5");
      expect(kitNameOfCardFolder("a5")).toBe("A5");
      expect(kitNameOfCardFolder("z99")).toBe("Z99");
    });

    it.each(["Ä1", "A100", "Drums", "_save", "A - ALWIS.rtf"])(
      "%s isn't a kit folder",
      (folder) => {
        expect(kitNameOfCardFolder(folder)).toBeNull();
      },
    );

    it("lists a card's kit folders with their kits, in the order given", () => {
      expect(
        cardKitFolders(["_save", "b1", "A0", "Ä1", "notes.txt", "A100"]),
      ).toEqual([
        { folder: "b1", kitName: "B1" },
        { folder: "A0", kitName: "A0" },
      ]);
    });

    it("takes the upper-case folder when two hold one kit", () => {
      expect(cardKitFolders(["a5", "A5"])).toEqual([
        { folder: "A5", kitName: "A5" },
      ]);
      expect(cardKitFolders(["A5", "a5"])).toEqual([
        { folder: "A5", kitName: "A5" },
      ]);
    });
  });
});
