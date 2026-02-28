import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createRomperDbFile } from "../../utils/dbUtilities.js";
import { addKit, getKit, getKits } from "../kitCrudOperations.js";
import {
  combineKitWithRelations,
  createKitLookups,
  type KitLookups,
  type KitRelatedData,
} from "../kitRelationalHelpers.js";
import { addSample } from "../sampleCrudOperations.js";

describe("Kit Relational Helpers - Integration Tests", () => {
  let tempDir: string;
  let dbDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "romper-kit-rel-"));
    dbDir = join(tempDir, ".romperdb");
    createRomperDbFile(dbDir);
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  describe("createKitLookups", () => {
    test("creates lookup maps from related data", () => {
      const relatedData: KitRelatedData = {
        banks: [
          {
            artist: "Artist A",
            letter: "A",
            rtf_filename: null,
            scanned_at: null,
          },
          {
            artist: "Artist B",
            letter: "B",
            rtf_filename: null,
            scanned_at: null,
          },
        ],
        samples: [
          {
            filename: "kick.wav",
            id: 1,
            is_stereo: false,
            kit_name: "A0",
            slot_number: 0,
            source_path: "/samples/kick.wav",
            voice_number: 1,
            wav_bit_depth: null,
            wav_bitrate: null,
            wav_channels: null,
            wav_sample_rate: null,
          },
        ],
        voices: [
          {
            id: 1,
            kit_name: "A0",
            stereo_mode: false,
            voice_alias: null,
            voice_number: 1,
          },
        ],
      };

      const lookups = createKitLookups(relatedData);

      expect(lookups.bankLookup.size).toBe(2);
      expect(lookups.bankLookup.get("A")!.artist).toBe("Artist A");

      expect(lookups.voicesLookup.size).toBe(1);
      expect(lookups.voicesLookup.get("A0")).toHaveLength(1);

      expect(lookups.samplesLookup.size).toBe(1);
      expect(lookups.samplesLookup.get("A0")).toHaveLength(1);
    });

    test("groups multiple voices and samples by kit name", () => {
      const relatedData: KitRelatedData = {
        banks: [],
        samples: [
          {
            filename: "s1.wav",
            id: 1,
            is_stereo: false,
            kit_name: "A0",
            slot_number: 0,
            source_path: "/s1.wav",
            voice_number: 1,
            wav_bit_depth: null,
            wav_bitrate: null,
            wav_channels: null,
            wav_sample_rate: null,
          },
          {
            filename: "s2.wav",
            id: 2,
            is_stereo: false,
            kit_name: "A0",
            slot_number: 1,
            source_path: "/s2.wav",
            voice_number: 1,
            wav_bit_depth: null,
            wav_bitrate: null,
            wav_channels: null,
            wav_sample_rate: null,
          },
          {
            filename: "s3.wav",
            id: 3,
            is_stereo: false,
            kit_name: "B0",
            slot_number: 0,
            source_path: "/s3.wav",
            voice_number: 1,
            wav_bit_depth: null,
            wav_bitrate: null,
            wav_channels: null,
            wav_sample_rate: null,
          },
        ],
        voices: [
          {
            id: 1,
            kit_name: "A0",
            stereo_mode: false,
            voice_alias: null,
            voice_number: 1,
          },
          {
            id: 2,
            kit_name: "A0",
            stereo_mode: false,
            voice_alias: null,
            voice_number: 2,
          },
          {
            id: 3,
            kit_name: "B0",
            stereo_mode: false,
            voice_alias: null,
            voice_number: 1,
          },
        ],
      };

      const lookups = createKitLookups(relatedData);

      expect(lookups.samplesLookup.get("A0")).toHaveLength(2);
      expect(lookups.samplesLookup.get("B0")).toHaveLength(1);
      expect(lookups.voicesLookup.get("A0")).toHaveLength(2);
      expect(lookups.voicesLookup.get("B0")).toHaveLength(1);
    });
  });

  describe("combineKitWithRelations", () => {
    test("combines kit with its related data from lookups", () => {
      // Use a real database to get a proper Kit object
      addKit(dbDir, { bank_letter: "A", name: "A0" });
      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });

      // Get the kit via getKit to have a properly-typed Kit object
      const kitResult = getKit(dbDir, "A0");
      const kit = kitResult.data!;

      // Build lookups manually for the test
      const lookups: KitLookups = {
        bankLookup: new Map([
          [
            "A",
            {
              artist: "Test Artist",
              letter: "A",
              rtf_filename: null,
              scanned_at: null,
            },
          ],
        ]),
        samplesLookup: new Map([
          [
            "A0",
            [
              {
                filename: "kick.wav",
                id: 1,
                is_stereo: false,
                kit_name: "A0",
                slot_number: 0,
                source_path: "/samples/kick.wav",
                voice_number: 1,
                wav_bit_depth: null,
                wav_bitrate: null,
                wav_channels: null,
                wav_sample_rate: null,
              },
            ],
          ],
        ]),
        voicesLookup: new Map([
          [
            "A0",
            [
              {
                id: 1,
                kit_name: "A0",
                stereo_mode: false,
                voice_alias: null,
                voice_number: 1,
              },
            ],
          ],
        ]),
      };

      const combined = combineKitWithRelations(kit, lookups);

      expect(combined.name).toBe("A0");
      expect(combined.bank).not.toBeNull();
      expect(combined.bank!.artist).toBe("Test Artist");
      expect(combined.samples).toHaveLength(1);
      expect(combined.voices).toHaveLength(1);
    });

    test("returns null bank when kit has no bank_letter", () => {
      addKit(dbDir, { bank_letter: null, name: "NoBankKit" });
      const kitResult = getKit(dbDir, "NoBankKit");
      const kit = kitResult.data!;

      const lookups: KitLookups = {
        bankLookup: new Map(),
        samplesLookup: new Map(),
        voicesLookup: new Map(),
      };

      const combined = combineKitWithRelations(kit, lookups);
      expect(combined.bank).toBeNull();
      expect(combined.samples).toEqual([]);
      expect(combined.voices).toEqual([]);
    });
  });

  describe("fetchKitRelatedData (via getKits integration)", () => {
    test("getKits correctly fetches and combines related data for multiple kits", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });
      addKit(dbDir, { bank_letter: "B", name: "B0" });

      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });
      addSample(dbDir, {
        filename: "snare.wav",
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/samples/snare.wav",
        voice_number: 2,
      });
      addSample(dbDir, {
        filename: "hat.wav",
        is_stereo: false,
        kit_name: "B0",
        slot_number: 0,
        source_path: "/samples/hat.wav",
        voice_number: 1,
      });

      const result = getKits(dbDir);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);

      const kitA = result.data!.find((k) => k.name === "A0")!;
      expect(kitA.voices).toHaveLength(4);
      expect(kitA.samples).toHaveLength(2);

      const kitB = result.data!.find((k) => k.name === "B0")!;
      expect(kitB.voices).toHaveLength(4);
      expect(kitB.samples).toHaveLength(1);
    });

    test("each kit gets its own samples - no cross-contamination", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });
      addKit(dbDir, { bank_letter: "B", name: "B0" });

      addSample(dbDir, {
        filename: "only-in-a.wav",
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/samples/only-in-a.wav",
        voice_number: 1,
      });

      const result = getKits(dbDir);
      const kitA = result.data!.find((k) => k.name === "A0")!;
      const kitB = result.data!.find((k) => k.name === "B0")!;

      expect(kitA.samples).toHaveLength(1);
      expect(kitA.samples![0].filename).toBe("only-in-a.wav");
      expect(kitB.samples).toHaveLength(0);
    });

    test("each kit gets its own voices - no cross-contamination", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });
      addKit(dbDir, { bank_letter: "B", name: "B0" });

      const result = getKits(dbDir);
      const kitA = result.data!.find((k) => k.name === "A0")!;
      const kitB = result.data!.find((k) => k.name === "B0")!;

      // Each kit should have exactly 4 voices belonging to it
      expect(kitA.voices!.every((v) => v.kit_name === "A0")).toBe(true);
      expect(kitB.voices!.every((v) => v.kit_name === "B0")).toBe(true);
    });
  });
});
