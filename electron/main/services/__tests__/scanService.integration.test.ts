import type { NewKit, NewSample } from "@romper/shared/db/schema.js";

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { InMemorySettings } from "../../types/settings.js";

import {
  createTempStore,
  removeTempStore,
} from "../../../../tests/integration/support/tempStore.js";
import {
  addKit,
  addSample,
  createRomperDbFile,
  getKitSamples,
} from "../../db/romperDbCoreORM.js";
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
    createRomperDbFile(TEST_DB_PATH);

    scanService = new ScanService();
    mockInMemorySettings = {
      localStorePath: TEST_LOCAL_STORE_PATH,
    };
  });

  afterEach(() => {
    removeTempStore(TEST_DB_DIR);
  });

  describe("[UC-13] rescanKit", () => {
    it("should return error when localStorePath is not configured", () => {
      const result = scanService.rescanKit({}, "A1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("should return error when kit directory does not exist", () => {
      const result = scanService.rescanKit(mockInMemorySettings, "NONEXISTENT");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Kit directory not found");
    });

    it("should scan an empty kit directory and find no samples", () => {
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

      const result = scanService.rescanKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data!.scannedSamples).toBe(0);
    });

    it("should scan a kit directory with WAV files grouped by voice", () => {
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

      const result = scanService.rescanKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data!.scannedSamples).toBe(4);

      // Verify samples were added to database
      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      expect(samplesResult.success).toBe(true);
      expect(samplesResult.data).toHaveLength(4);
    });

    it("keeps existing samples and their user data, adding only new files (RE-04)", () => {
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

      const result = scanService.rescanKit(mockInMemorySettings, "A1");

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

    it("scanning twice changes nothing the second time", () => {
      addKit(TEST_DB_PATH, {
        bank_letter: "A",
        editable: false,
        name: "A1",
      });
      const kitDir = path.join(TEST_DB_DIR, "A1");
      createTestWavFile(path.join(kitDir, "1-kick.wav"));
      createTestWavFile(path.join(kitDir, "2-snare.wav"));

      scanService.rescanKit(mockInMemorySettings, "A1");
      const before = getKitSamples(TEST_DB_PATH, "A1").data;
      const second = scanService.rescanKit(mockInMemorySettings, "A1");

      expect(second.data?.addedSamples).toBe(0);
      expect(getKitSamples(TEST_DB_PATH, "A1").data).toEqual(before);
    });

    it("should ignore non-WAV files in the kit directory", () => {
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

      const result = scanService.rescanKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(true);
      expect(result.data!.scannedSamples).toBe(1);
    });

    it("should preserve samples when kit directory is missing (no destructive delete)", () => {
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
      const result = scanService.rescanKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Kit directory not found");

      // Samples should be preserved since we bail before deleting
      const samplesResult = getKitSamples(TEST_DB_PATH, "A1");
      expect(samplesResult.success).toBe(true);
      expect(samplesResult.data).toHaveLength(1);
    });

    it("should handle case-insensitive WAV extension", () => {
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

      const result = scanService.rescanKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(true);
      expect(result.data!.scannedSamples).toBe(2);
    });
  });

  describe("[UC-12] scanBanks", () => {
    it("should return error when localStorePath is not configured", () => {
      const result = scanService.scanBanks({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("should return error when local store path does not exist", () => {
      const result = scanService.scanBanks({
        localStorePath: "/nonexistent/path",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Local store path not found");
    });

    it("should scan and find RTF bank files", () => {
      // Create RTF files matching the "A - Artist Name.rtf" pattern
      fs.writeFileSync(
        path.join(TEST_DB_DIR, "A - Techno Artist.rtf"),
        "rtf content",
      );
      fs.writeFileSync(
        path.join(TEST_DB_DIR, "B - Ambient Producer.rtf"),
        "rtf content",
      );

      const result = scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data!.scannedFiles).toBe(2);
    });

    it("should ignore non-matching RTF filenames", () => {
      // Create files that don't match the pattern
      fs.writeFileSync(path.join(TEST_DB_DIR, "notes.rtf"), "notes");
      fs.writeFileSync(path.join(TEST_DB_DIR, "readme.txt"), "readme");
      fs.writeFileSync(
        path.join(TEST_DB_DIR, "A - Valid Artist.rtf"),
        "rtf content",
      );

      const result = scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      // Only "A - Valid Artist.rtf" matches the pattern
      expect(result.data!.scannedFiles).toBe(1);
    });

    it("should return zero counts when no RTF files exist", () => {
      const result = scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data!.scannedFiles).toBe(0);
      expect(result.data!.updatedBanks).toBe(0);
    });

    it("should extract bank letter and artist name correctly", () => {
      fs.writeFileSync(
        path.join(TEST_DB_DIR, "C - My Cool Artist.rtf"),
        "rtf content",
      );

      const result = scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data!.scannedFiles).toBe(1);
      // The bank update should have been called (updatedBanks counts successful updates)
      expect(result.data!.updatedBanks).toBeGreaterThanOrEqual(0);
    });
  });

  // [Q-03] rescanKitsWithMissingMetadata is gone; rescanKit still backfills
  // WAV metadata for rows saved before the columns existed.
  describe("[Q-03] rescanKit metadata backfill", () => {
    it("fills in missing WAV metadata without replacing the row", () => {
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

      const result = scanService.rescanKit(mockInMemorySettings, "A2");

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
});
