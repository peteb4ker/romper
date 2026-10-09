// @vitest-environment node
/* eslint-disable perfectionist/sort-maps -- Map order is the file's key order, which these tests set on purpose */
import type { RampleRawValue } from "@romper/shared/rampleSave";

import { describe, expect, it } from "vitest";

import {
  hex,
  syntheticGlobalAssign,
  syntheticKitSave,
  syntheticSaveFolder,
  syntheticSettings,
} from "../../../../tests/factories/rampleSave.factory";
import { CborDecodeError, decodeCbor, encodeCbor, isOpaqueItem } from "../cbor";

const decodeError = (bytes: Uint8Array): CborDecodeError => {
  try {
    decodeCbor(bytes);
  } catch (error) {
    if (error instanceof CborDecodeError) return error;
    throw error;
  }
  throw new Error("decoded without an error");
};

// global_assign.rpl as firmware 2.00 writes it: four {param, voice} maps
const GLOBAL_ASSIGN = hex(`
  84
  a2 65 706172616d 09 65 766f696365 00
  a2 65 706172616d 09 65 766f696365 01
  a2 65 706172616d 09 65 766f696365 02
  a2 65 706172616d 09 65 766f696365 03
`);

describe("[Q-08] the _save CBOR codec (#788)", () => {
  describe("the subset the Rample writes", () => {
    it.each<[string, RampleRawValue, string]>([
      ["0", 0, "00"],
      ["23, the largest one-byte integer", 23, "17"],
      ["24", 24, "18 18"],
      ["127, a knob's middle", 127, "18 7f"],
      ["255", 255, "18 ff"],
      ["256, above a byte", 256, "19 0100"],
      ["65536", 65536, "1a 00010000"],
      ["2^32", 2 ** 32, "1b 0000000100000000"],
      ["-1", -1, "20"],
      ["-25", -25, "38 18"],
      ["empty text", "", "60"],
      ["text", "env", "63 656e76"],
      ["false", false, "f4"],
      ["true", true, "f5"],
      ["null", null, "f6"],
      ["an empty array", [], "80"],
      ["an array", [1, 2], "82 01 02"],
      ["a map", new Map([["a", 1]]), "a1 61 61 01"],
    ])("decodes and encodes %s", (_name, value, bytes) => {
      expect(decodeCbor(hex(bytes))).toEqual(value);
      expect(encodeCbor(value)).toEqual(hex(bytes));
    });

    it("writes text over 23 bytes with a one-byte length, as the device does", () => {
      const key = "pitch_tracking_chromatic";
      expect(encodeCbor(key).subarray(0, 2)).toEqual(hex("78 18"));
      expect(decodeCbor(encodeCbor(key))).toBe(key);
    });

    it("decodes text as UTF-8", () => {
      expect(decodeCbor(hex("62 c3a9"))).toBe("é");
      expect(encodeCbor("é")).toEqual(hex("62 c3a9"));
    });

    it("decodes maps to Map, never to plain objects", () => {
      const value = decodeCbor(hex("a1 61 61 01"));
      expect(value).toBeInstanceOf(Map);
    });
  });

  describe("byte-identical round trips", () => {
    it("re-encodes global_assign.rpl exactly, and builds it from values", () => {
      const decoded = decodeCbor(GLOBAL_ASSIGN);

      expect(decoded).toEqual(syntheticGlobalAssign());
      expect(encodeCbor(decoded)).toEqual(GLOBAL_ASSIGN);
      expect(encodeCbor(syntheticGlobalAssign())).toEqual(GLOBAL_ASSIGN);
    });

    it.each(
      Object.entries(syntheticSaveFolder()).filter(
        ([, bytes]) => bytes.length > 0,
      ),
    )("re-encodes the synthetic %s byte for byte", (_name, bytes) => {
      expect(encodeCbor(decodeCbor(bytes))).toEqual(bytes);
    });

    it("re-encodes values above 255 and true in a mute group exactly", () => {
      const bytes = encodeCbor(
        syntheticKitSave({
          level: [300, 127, 127, 127],
          mute_group: [
            [false, true, false, false],
            [false, false, false, false],
            [false, false, false, false],
            [false, false, false, false],
          ],
        }),
      );
      expect(encodeCbor(decodeCbor(bytes))).toEqual(bytes);
    });

    it("keeps an opaque item's bytes when re-encoding the file around it", () => {
      // {a: 1.0 as a half float, b: h'0102', c: tag 1(0), d: undefined}
      const bytes = hex("a4 61 61 f9 3c00 61 62 42 0102 61 63 c1 00 61 64 f7");
      expect(encodeCbor(decodeCbor(bytes))).toEqual(bytes);
    });
  });

  describe("key order", () => {
    it("keeps the file's key order: plain byte order, not RFC 8949's", () => {
      const kit = syntheticKitSave();
      const bytes = encodeCbor(kit);

      const decoded = decodeCbor(bytes) as Map<string, RampleRawValue>;
      expect([...decoded.keys()]).toEqual([...kit.keys()]);
      // assignments comes before env, as on the device
      const keys = [...decoded.keys()];
      expect(keys.indexOf("assignments")).toBeLessThan(keys.indexOf("env"));

      // RFC 8949 §4.2.1's deterministic order (shorter keys first, then
      // bytewise) puts env first, which would change the device's bytes
      const canonical = new Map(
        [...kit].sort(([a], [b]) => a.length - b.length || (a < b ? -1 : 1)),
      );
      expect([...canonical.keys()][0]).toBe("env");
      expect(encodeCbor(canonical)).not.toEqual(bytes);
      expect(encodeCbor(decoded)).toEqual(bytes);
    });

    it("keeps layerMode before layer_modes, and integer-like keys in place", () => {
      const settings = decodeCbor(encodeCbor(syntheticSettings())) as Map<
        string,
        RampleRawValue
      >;
      const keys = [...settings.keys()];
      expect(keys.indexOf("layerMode")).toBeLessThan(
        keys.indexOf("midi_velocity"),
      );

      const bytes = encodeCbor(
        new Map<string, RampleRawValue>([
          ["b", 1],
          ["1", 2],
        ]),
      );
      const decoded = decodeCbor(bytes) as Map<string, RampleRawValue>;
      expect([...decoded.keys()]).toEqual(["b", "1"]);
      expect(encodeCbor(decoded)).toEqual(bytes);
    });
  });

  describe("items outside the subset", () => {
    it.each([
      ["a half float", "f9 3c00", 7],
      ["a double", "fb 3ff0000000000000", 7],
      ["a byte string", "43 010203", 2],
      ["a tag", "c1 1a 5f5e1000", 6],
      ["undefined", "f7", 7],
      ["a one-byte simple value", "f8 20", 7],
      ["an integer beyond a safe number", "1b ffffffffffffffff", 0],
      ["a negative integer beyond a safe number", "3b ffffffffffffffff", 1],
      ["a map with a non-text key", "a1 01 02", 5],
    ])("keeps %s whole, with its bytes", (_name, bytes, majorType) => {
      const value = decodeCbor(hex(bytes));

      expect(isOpaqueItem(value)).toBe(true);
      expect(value).toEqual({ bytes: hex(bytes), majorType, opaque: true });
      expect(encodeCbor(value)).toEqual(hex(bytes));
    });

    it("isn't fooled by values that aren't opaque items", () => {
      expect(isOpaqueItem(null)).toBe(false);
      expect(isOpaqueItem(new Map())).toBe(false);
      expect(isOpaqueItem(3)).toBe(false);
    });
  });

  describe("input it refuses", () => {
    it("refuses a file cut short at every byte", () => {
      const bytes = encodeCbor(syntheticKitSave());
      for (let length = 0; length < bytes.length; length++) {
        const error = decodeError(bytes.subarray(0, length));
        expect(error.offset).toBeGreaterThanOrEqual(0);
        expect(error.offset).toBeLessThanOrEqual(length);
      }
    });

    it("refuses bytes after the item, naming where they start", () => {
      const bytes = hex("01 00");
      const error = decodeError(bytes);
      expect(error.message).toMatch(/1 bytes follow the item \(at byte 1\)/);
      expect(error.offset).toBe(1);
    });

    it.each([
      ["an indefinite array", "9f 01 ff"],
      ["an indefinite map", "bf 61 61 01 ff"],
      ["indefinite text", "7f 61 61 ff"],
      ["an indefinite byte string", "5f 41 01 ff"],
      ["an indefinite integer", "1f"],
      ["a lone break", "ff"],
      ["a reserved head", "1c"],
      ["a reserved simple head", "fc"],
    ])("refuses %s", (_name, bytes) => {
      expect(decodeError(hex(bytes))).toBeInstanceOf(CborDecodeError);
    });

    it("refuses a key that appears twice", () => {
      const error = decodeError(hex("a2 61 61 01 61 61 02"));
      expect(error.message).toMatch(/"a" appears twice/);
      expect(error.offset).toBe(4);
    });

    it("refuses text that isn't UTF-8", () => {
      expect(decodeError(hex("62 c328")).message).toMatch(/UTF-8/);
    });

    it("refuses a count the file can't hold, without allocating it", () => {
      // An array of 2^32 items in a 9-byte file
      expect(decodeError(hex("9b 0000000100000000")).message).toMatch(
        /declares 4294967296/,
      );
      expect(decodeError(hex("b9 ffff 00")).message).toMatch(/declares 65535/);
      expect(decodeError(hex("78 ff 61")).offset).toBe(0);
    });

    it("refuses nesting deeper than the limit", () => {
      const nested = (depth: number) =>
        new Uint8Array([...new Array<number>(depth).fill(0x81), 0x00]);
      expect(decodeCbor(nested(16))).toBeDefined();
      expect(decodeError(nested(17)).message).toMatch(/nested more than 16/);
      // A tag counts as a level too
      expect(
        decodeError(new Uint8Array([...new Array<number>(17).fill(0xc1), 0])),
      ).toBeInstanceOf(CborDecodeError);
    });

    it("refuses an empty file and one over the size limit", () => {
      expect(decodeError(new Uint8Array(0)).message).toMatch(/empty/);
      expect(() =>
        decodeCbor(hex("82 00 00"), { maxBytes: 2, maxDepth: 16 }),
      ).toThrow(/3 bytes, more than the 2 allowed/);
    });
  });

  describe("forms the device doesn't write", () => {
    it("reads a longer integer than needed, but can't write it back the same", () => {
      // 127 as 0x19 0x00 0x7f (hardware check 17)
      const long = hex("19 007f");
      expect(decodeCbor(long)).toBe(127);
      expect(encodeCbor(decodeCbor(long))).toEqual(hex("18 7f"));
    });

    it("won't encode a number that isn't a safe integer", () => {
      expect(() => encodeCbor(1.5)).toThrow(TypeError);
      expect(() => encodeCbor(Number.NaN)).toThrow(TypeError);
      expect(() => encodeCbor(2 ** 60)).toThrow(TypeError);
    });
  });
});
