import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  cardSampleFileName,
  MAX_CARD_FILE_NAME_LENGTH,
  voiceOfCardFile,
} from "../rampleCardLayout";

describe("rampleCardLayout", () => {
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
});
