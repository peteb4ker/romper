import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTempStore,
  removeTempStore,
} from "../../../tests/integration/support/tempStore.js";
import { cardFileHolds, cardFileMatches } from "../cardFileMatch.js";

// #650: a write leaves a card file alone only when it holds exactly the
// bytes the write would put there.

/** Bytes that differ at every offset, longer than one compare chunk */
function pattern(length: number, seed = 0): Buffer {
  const bytes = Buffer.alloc(length);
  for (let i = 0; i < length; i++) bytes[i] = (i * 31 + seed) & 0xff;
  return bytes;
}

describe("[UC-34] cardFileMatch", () => {
  let dir: string;
  let source: string;
  let card: string;
  const big = pattern(2.5 * 1024 * 1024);

  beforeEach(() => {
    dir = createTempStore("romper-card-match-");
    source = path.join(dir, "source.wav");
    card = path.join(dir, "card.wav");
    fs.writeFileSync(source, big);
  });

  afterEach(() => {
    removeTempStore(dir);
  });

  describe("cardFileMatches", () => {
    it("matches a card file with the same bytes", async () => {
      fs.writeFileSync(card, big);
      expect(await cardFileMatches(source, card)).toBe(true);
    });

    it("matches two empty files", async () => {
      fs.writeFileSync(source, "");
      fs.writeFileSync(card, "");
      expect(await cardFileMatches(source, card)).toBe(true);
    });

    it("doesn't match when the card has no file there", async () => {
      expect(await cardFileMatches(source, card)).toBe(false);
    });

    it("doesn't match a file of another size", async () => {
      fs.writeFileSync(card, big.subarray(1));
      expect(await cardFileMatches(source, card)).toBe(false);
    });

    it("doesn't match a file that differs in its last chunk", async () => {
      const changed = Buffer.from(big);
      changed[changed.length - 1] ^= 0xff;
      fs.writeFileSync(card, changed);
      expect(await cardFileMatches(source, card)).toBe(false);
    });

    it("doesn't match a folder where the file should be", async () => {
      fs.mkdirSync(card);
      expect(await cardFileMatches(source, card)).toBe(false);
    });

    it("doesn't match when the source is missing", async () => {
      fs.writeFileSync(card, big);
      fs.rmSync(source);
      expect(await cardFileMatches(source, card)).toBe(false);
    });
  });

  describe("cardFileHolds", () => {
    it("matches a card file holding the bytes", async () => {
      fs.writeFileSync(card, big);
      expect(await cardFileHolds(card, big)).toBe(true);
    });

    it("doesn't match different bytes of the same length", async () => {
      fs.writeFileSync(card, pattern(big.length, 1));
      expect(await cardFileHolds(card, big)).toBe(false);
    });

    it("doesn't match when the card has no file there", async () => {
      expect(await cardFileHolds(card, big)).toBe(false);
    });
  });
});
