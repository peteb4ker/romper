import type { NewKit, NewSample } from "@romper/shared/db/schema.js";

import fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InMemorySettings } from "../../types/settings.js";

import { createStoreDb } from "../../../../tests/integration/support/storeDb.js";
import {
  createTempStore,
  removeTempStore,
} from "../../../../tests/integration/support/tempStore.js";
import { addKit, addSample, getKitSamples } from "../../db/romperDbCoreORM.js";
import { ScanService } from "../scanService.js";

// Test utilities
// Each test gets its own local store under the OS temp dir (see beforeEach),
// so nothing is written into the source tree.
let TEST_DB_DIR: string;
let TEST_LOCAL_STORE_PATH: string;
let TEST_DB_PATH: string;

/**
 * Create a minimal valid WAV file for testing
 */
function createTestWavFile(
  filePath: string,
  options: { channels?: number; sampleRate?: number } = {},
): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sampleRate = options.sampleRate ?? 44100;
  const bitsPerSample = 16;
  const numChannels = options.channels ?? 1;
  const dataSize = 4;
  const headerSize = 44;
  const fileSize = headerSize + dataSize - 8;

  const buffer = Buffer.alloc(headerSize + dataSize);
  let offset = 0;

  buffer.write("RIFF", offset);
  offset += 4;
  buffer.writeUInt32LE(fileSize, offset);
  offset += 4;
  buffer.write("WAVE", offset);
  offset += 4;
  buffer.write("fmt ", offset);
  offset += 4;
  buffer.writeUInt32LE(16, offset);
  offset += 4;
  buffer.writeUInt16LE(1, offset);
  offset += 2;
  buffer.writeUInt16LE(numChannels, offset);
  offset += 2;
  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4;
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), offset);
  offset += 4;
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), offset);
  offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset);
  offset += 2;
  buffer.write("data", offset);
  offset += 4;
  buffer.writeUInt32LE(dataSize, offset);

  fs.writeFileSync(filePath, buffer);
}

describe("ScanService Integration Tests", () => {
  let scanService: ScanService;
  let mockInMemorySettings: InMemorySettings;

  beforeEach(() => {
    TEST_DB_DIR = createTempStore("romper-scan-service-");
    TEST_LOCAL_STORE_PATH = TEST_DB_DIR;
    TEST_DB_PATH = path.join(TEST_DB_DIR, ".romperdb");

    // Create fresh database
    createStoreDb(TEST_DB_PATH);

    scanService = new ScanService();
    mockInMemorySettings = {
      localStorePath: TEST_LOCAL_STORE_PATH,
    };
  });

  afterEach(() => {
    removeTempStore(TEST_DB_DIR);
  });

  describe("[UC-13] rescanKit", () => {
    it("should return error when localStorePath is not configured", async () => {
      const result = await scanService.rescanKit({}, "A1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("should return error when kit directory does not exist", async () => {
      const result = await scanService.rescanKit(
        mockInMemorySettings,
        "NONEXISTENT",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Kit directory not found");
    });

    it("should scan an empty kit directory and find no samples", async () => {
      // Create kit in database
      const kitRecord: NewKit = {
        alias: "Empty Kit",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      };
      addKit(TEST_DB_PATH, kitRecord);

      // Create empty kit directory
      const kitDir = path.join(TEST_DB_DIR, "A1");
      fs.mkdirSync(kitDir, { recursive: true });

      const result = await scanService.rescanKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data!.scannedSamples).toBe(0);
    });

    it("should scan a kit directory with WAV files grouped by voice", async () => {
      // Create kit in database
      const kitRecord: NewKit = {
        alias: "Full Kit",
        bank_letter: "A",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      };
      addKit(TEST_DB_PATH, kitRecord);

      // Create kit directory with WAV files named by voice (Rample convention: 1-kick.wav, 2-snare.wav, etc.)
      const kitDir = path.join(TEST_DB_DIR, "A1");
      fs.mkdirSync(kitDir, { recursive: true });

      createTestWavFile(path.join(kitDir, "1-kick.wav"));
      createTestWavFile(path.join(kitDir, "1-kick2.wav"));
      createTestWavFile(path.join(kitDir, "2-snare.wav"));
      createTestWavFile(path.join(kitDir, "3-hat.wav"));

      const result = await scanService.rescanKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data!.scannedSamples).toBe(4);

      // Verify samples were added to database
      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      expect(samplesResult.success).toBe(true);
      expect(samplesResult.data).toHaveLength(4);
    });

    it("keeps existing samples and their user data, adding only new files (RE-04)", async () => {
      addKit(TEST_DB_PATH, {
        alias: "Factory Kit",
        bank_letter: "A",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      });

      const kitDir = path.join(TEST_DB_DIR, "A1");
      fs.mkdirSync(kitDir, { recursive: true });
      createTestWavFile(path.join(kitDir, "1-kick.wav"));
      createTestWavFile(path.join(kitDir, "1-new-kick.wav"), { channels: 2 });

      // A store sample the user trimmed, and a sample added in-app from
      // outside the store (reference-only, so it has no file in the kit folder)
      const userSamples: NewSample[] = [
        {
          filename: "1-kick.wav",
          gain_db: -4.5,
          kit_name: "A1",
          slot_number: 0,
          source_path: path.join(kitDir, "1-kick.wav"),
          voice_number: 1,
        },
        {
          filename: "my-snare.wav",
          gain_db: 3,
          kit_name: "A1",
          slot_number: 0,
          source_path: path.join(TEST_DB_DIR, "elsewhere", "my-snare.wav"),
          voice_number: 2,
        },
      ];
      userSamples.forEach((sample) => addSample(TEST_DB_PATH, sample));

      const result = await scanService.rescanKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        addedSamples: 1,
        missingSamples: [
          {
            filename: "my-snare.wav",
            slotNumber: 0,
            sourcePath: path.join(TEST_DB_DIR, "elsewhere", "my-snare.wav"),
            voiceNumber: 2,
          },
        ],
        scannedSamples: 2,
      });

      const rows = getKitSamples(TEST_DB_PATH, "A1").data!;
      expect(rows).toHaveLength(3);
      expect(rows.find((r) => r.filename === "1-kick.wav")).toMatchObject({
        gain_db: -4.5,
        slot_number: 0,
        voice_number: 1,
      });
      expect(rows.find((r) => r.filename === "my-snare.wav")).toMatchObject({
        gain_db: 3,
        voice_number: 2,
      });
      expect(rows.find((r) => r.filename === "1-new-kick.wav")).toMatchObject({
        slot_number: 1,
        voice_number: 1,
        wav_channels: 2,
        wav_sample_rate: 44100,
      });
    });

    it("scanning twice changes nothing the second time", async () => {
      addKit(TEST_DB_PATH, {
        bank_letter: "A",
        editable: false,
        name: "A1",
      });
      const kitDir = path.join(TEST_DB_DIR, "A1");
      createTestWavFile(path.join(kitDir, "1-kick.wav"));
      createTestWavFile(path.join(kitDir, "2-snare.wav"));

      await scanService.rescanKit(mockInMemorySettings, "A1");
      const before = getKitSamples(TEST_DB_PATH, "A1").data;
      const second = await scanService.rescanKit(mockInMemorySettings, "A1");

      expect(second.data?.addedSamples).toBe(0);
      expect(getKitSamples(TEST_DB_PATH, "A1").data).toEqual(before);
    });

    it("should ignore non-WAV files in the kit directory", async () => {
      const kitRecord: NewKit = {
        alias: "Mixed Files Kit",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      };
      addKit(TEST_DB_PATH, kitRecord);

      const kitDir = path.join(TEST_DB_DIR, "A1");
      fs.mkdirSync(kitDir, { recursive: true });

      // Create WAV and non-WAV files
      createTestWavFile(path.join(kitDir, "1-kick.wav"));
      fs.writeFileSync(path.join(kitDir, "readme.txt"), "notes");
      fs.writeFileSync(path.join(kitDir, "cover.png"), "image data");
      fs.writeFileSync(path.join(kitDir, "1-kick.mp3"), "mp3 data");

      const result = await scanService.rescanKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(true);
      expect(result.data!.scannedSamples).toBe(1);
    });

    it("should preserve samples when kit directory is missing (no destructive delete)", async () => {
      const kitRecord: NewKit = {
        alias: "Protected Kit",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      };
      addKit(TEST_DB_PATH, kitRecord);

      const sample: NewSample = {
        filename: "kick.wav",
        kit_name: "A1",
        slot_number: 0,
        source_path: "/test/path/kick.wav",
        voice_number: 1,
      };
      addSample(TEST_DB_PATH, sample);

      // Do NOT create kit directory - it should fail gracefully
      const result = await scanService.rescanKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Kit directory not found");

      // Samples should be preserved since we bail before deleting
      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      expect(samplesResult.success).toBe(true);
      expect(samplesResult.data).toHaveLength(1);
    });

    it("should handle case-insensitive WAV extension", async () => {
      const kitRecord: NewKit = {
        alias: "Case Test Kit",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      };
      addKit(TEST_DB_PATH, kitRecord);

      const kitDir = path.join(TEST_DB_DIR, "A1");
      fs.mkdirSync(kitDir, { recursive: true });

      createTestWavFile(path.join(kitDir, "1-kick.WAV"));
      createTestWavFile(path.join(kitDir, "2-snare.Wav"));

      const result = await scanService.rescanKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(true);
      expect(result.data!.scannedSamples).toBe(2);
    });
  });

  // [Q-03] rescanKitsWithMissingMetadata is gone; rescanKit still backfills
  // WAV metadata for rows saved before the columns existed.
  describe("[Q-03] rescanKit metadata backfill", () => {
    it("fills in missing WAV metadata without replacing the row", async () => {
      addKit(TEST_DB_PATH, {
        alias: "Kit Missing Metadata",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A2",
        step_pattern: null,
      });
      addSample(TEST_DB_PATH, {
        filename: "1-pad.wav",
        kit_name: "A2",
        slot_number: 0,
        source_path: path.join(TEST_DB_DIR, "A2", "1-pad.wav"),
        voice_number: 1,
      });
      const kitDir = path.join(TEST_DB_DIR, "A2");
      fs.mkdirSync(kitDir, { recursive: true });
      createTestWavFile(path.join(kitDir, "1-pad.wav"));
      const [before] = getKitSamples(TEST_DB_PATH, "A2").data!;
      expect(before.wav_sample_rate).toBeNull();

      const result = await scanService.rescanKit(mockInMemorySettings, "A2");

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        addedSamples: 0,
        metadataUpdated: 1,
      });
      const rows = getKitSamples(TEST_DB_PATH, "A2").data!;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        filename: "1-pad.wav",
        id: before.id,
        wav_sample_rate: 44100,
      });
    });
  });

  describe("[Q-01] rescanKit's file reads are asynchronous (#821)", () => {
    /** A read-only kit A1 with one tracked file (kick) and a folder to scan */
    function readOnlyKit() {
      addKit(TEST_DB_PATH, {
        alias: null,
        bank_letter: "A",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      });
      const kitDir = path.join(TEST_DB_DIR, "A1");
      const kick = path.join(kitDir, "1-kick.wav");
      createTestWavFile(kick);
      addSample(TEST_DB_PATH, {
        filename: "1-kick.wav",
        kit_name: "A1",
        slot_number: 0,
        source_path: kick,
        voice_number: 1,
      });
      return { kick, kitDir };
    }

    it("makes no sync fs call while it reads the folder and the files", async () => {
      const { kitDir } = readOnlyKit();
      createTestWavFile(path.join(kitDir, "2-snare.wav"));
      const calls: string[] = [];
      const names = [
        "existsSync",
        "lstatSync",
        "openSync",
        "readdirSync",
        "readFileSync",
        "readSync",
        "realpathSync",
        "statSync",
      ] as const;
      const originals = names.map((name) => [name, fs[name]] as const);
      for (const [name, original] of originals) {
        (fs as unknown as Record<string, unknown>)[name] = (
          ...args: unknown[]
        ) => {
          calls.push(name);
          return (original as (...a: unknown[]) => unknown)(...args);
        };
      }
      let result;
      try {
        result = await scanService.rescanKit(mockInMemorySettings, "A1");
      } finally {
        for (const [name, original] of originals) {
          (fs as unknown as Record<string, unknown>)[name] = original;
        }
      }

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ addedSamples: 1 });
      expect(calls).toEqual([]);
    });

    it("reads only the headers the merge needs: a known-readable, unchanged file is only stat-ed", async () => {
      const { kick } = readOnlyKit();
      // The first scan reads the kick's header and records its size and time
      await scanService.rescanKit(mockInMemorySettings, "A1");
      const opened: string[] = [];
      const realOpen = fs.promises.open.bind(fs.promises);
      const spy = vi.spyOn(fs.promises, "open").mockImplementation(((
        p: string,
        ...rest: unknown[]
      ) => {
        opened.push(p);
        return realOpen(p, ...(rest as []));
      }) as typeof fs.promises.open);
      try {
        const again = await scanService.rescanKit(mockInMemorySettings, "A1");
        expect(again.success).toBe(true);
        expect(opened).toEqual([]);

        // Changed on disk: read again
        createTestWavFile(kick, { channels: 2 });
        fs.utimesSync(kick, new Date(), new Date(Date.now() + 5000));
        await scanService.rescanKit(mockInMemorySettings, "A1");
        expect(opened).toEqual([kick]);
      } finally {
        spy.mockRestore();
      }
      expect(getKitSamples(TEST_DB_PATH, "A1").data![0].wav_channels).toBe(2);
    });

    it("tries the merge again when the kit's rows change while its files are read", async () => {
      const { kitDir } = readOnlyKit();
      createTestWavFile(path.join(kitDir, "1-added.wav"));
      // A sample lands between the scan reading the rows and the transaction
      let landed = false;
      const realStat = fs.promises.stat.bind(fs.promises);
      const spy = vi.spyOn(fs.promises, "stat").mockImplementation(((
        p: string,
        ...rest: unknown[]
      ) => {
        if (!landed) {
          landed = true;
          createTestWavFile(path.join(kitDir, "3-landed.wav"));
          addSample(TEST_DB_PATH, {
            filename: "3-landed.wav",
            kit_name: "A1",
            slot_number: 0,
            source_path: path.join(kitDir, "3-landed.wav"),
            voice_number: 3,
          });
        }
        return realStat(p, ...(rest as []));
      }) as typeof fs.promises.stat);
      let result;
      try {
        result = await scanService.rescanKit(mockInMemorySettings, "A1");
      } finally {
        spy.mockRestore();
      }

      expect(result.success).toBe(true);
      const rows = getKitSamples(TEST_DB_PATH, "A1").data!;
      expect(rows.map((r) => r.filename).sort()).toEqual([
        "1-added.wav",
        "1-kick.wav",
        "3-landed.wav",
      ]);
      // The row that landed was read too, not left unchecked
      expect(rows.every((r) => r.source_status === "readable")).toBe(true);
    });

    it("reports a kit that isn't in the database", async () => {
      fs.mkdirSync(path.join(TEST_DB_DIR, "A9"));

      const result = await scanService.rescanKit(mockInMemorySettings, "A9");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Kit not found in database: A9");
    });
  });
});
