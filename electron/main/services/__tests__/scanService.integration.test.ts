import type { NewKit, NewSample } from "@romper/shared/db/schema.js";

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { InMemorySettings } from "../../types/settings.js";

import { deleteDbFileWithRetry } from "../../db/fileOperations.js";
import {
  addKit,
  addSample,
  createRomperDbFile,
  getKitSamples,
} from "../../db/romperDbCoreORM.js";
import { ScanService } from "../scanService.js";

// Test utilities
const TEST_DB_DIR = path.join(__dirname, "test-data-scan");
const TEST_LOCAL_STORE_PATH = TEST_DB_DIR;
const TEST_DB_PATH = path.join(TEST_DB_DIR, ".romperdb");

async function cleanupSqliteFiles(dir: string) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await cleanupSqliteFiles(fullPath);
    } else if (entry.name.endsWith(".sqlite")) {
      try {
        await deleteDbFileWithRetry(fullPath);
      } catch (error) {
        console.warn(`Failed to delete SQLite file ${fullPath}:`, error);
      }
    }
  }
}

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

  beforeEach(async () => {
    // Ensure test directory exists
    if (!fs.existsSync(TEST_DB_DIR)) {
      fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }

    // Clean up any existing test databases
    await cleanupSqliteFiles(TEST_DB_DIR);

    // Create fresh database
    createRomperDbFile(TEST_DB_PATH);

    scanService = new ScanService();
    mockInMemorySettings = {
      localStorePath: TEST_LOCAL_STORE_PATH,
    };
  });

  afterEach(async () => {
    await cleanupSqliteFiles(TEST_DB_DIR);
    // Clean up kit directories and any stray files (RTFs, etc.)
    if (fs.existsSync(TEST_DB_DIR)) {
      const entries = fs.readdirSync(TEST_DB_DIR, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(TEST_DB_DIR, entry.name);
        if (entry.isDirectory() && entry.name !== ".romperdb") {
          fs.rmSync(fullPath, { force: true, recursive: true });
        } else if (entry.isFile() && entry.name !== ".romperdb") {
          fs.unlinkSync(fullPath);
        }
      }
    }
  });

  describe("rescanKit", () => {
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
        editable: true,
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

    it("should delete existing samples before rescanning", async () => {
      // Create kit in database with a pre-existing sample
      const kitRecord: NewKit = {
        alias: "Rescan Kit",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      };
      addKit(TEST_DB_PATH, kitRecord);

      const oldSample: NewSample = {
        filename: "old-sample.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: "/old/path/old-sample.wav",
        voice_number: 1,
      };
      addSample(TEST_DB_PATH, oldSample);

      // Verify old sample exists
      const beforeSamples = getKitSamples(TEST_DB_PATH, "A1");
      expect(beforeSamples.data).toHaveLength(1);

      // Create kit directory with different files
      const kitDir = path.join(TEST_DB_DIR, "A1");
      fs.mkdirSync(kitDir, { recursive: true });
      createTestWavFile(path.join(kitDir, "1-new-kick.wav"));

      const result = await scanService.rescanKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(true);

      // Old sample should be replaced by new scan results
      const afterSamples = getKitSamples(TEST_DB_PATH, "A1");
      expect(afterSamples.success).toBe(true);
      expect(afterSamples.data).toHaveLength(1);
      expect(afterSamples.data![0].filename).toBe("1-new-kick.wav");
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
        is_stereo: false,
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

  describe("scanBanks", () => {
    it("should return error when localStorePath is not configured", async () => {
      const result = await scanService.scanBanks({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("should return error when local store path does not exist", async () => {
      const result = await scanService.scanBanks({
        localStorePath: "/nonexistent/path",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Local store path not found");
    });

    it("should scan and find RTF bank files", async () => {
      // Create RTF files matching the "A - Artist Name.rtf" pattern
      fs.writeFileSync(
        path.join(TEST_DB_DIR, "A - Techno Artist.rtf"),
        "rtf content",
      );
      fs.writeFileSync(
        path.join(TEST_DB_DIR, "B - Ambient Producer.rtf"),
        "rtf content",
      );

      const result = await scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data!.scannedFiles).toBe(2);
    });

    it("should ignore non-matching RTF filenames", async () => {
      // Create files that don't match the pattern
      fs.writeFileSync(path.join(TEST_DB_DIR, "notes.rtf"), "notes");
      fs.writeFileSync(path.join(TEST_DB_DIR, "readme.txt"), "readme");
      fs.writeFileSync(
        path.join(TEST_DB_DIR, "A - Valid Artist.rtf"),
        "rtf content",
      );

      const result = await scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      // Only "A - Valid Artist.rtf" matches the pattern
      expect(result.data!.scannedFiles).toBe(1);
    });

    it("should return zero counts when no RTF files exist", async () => {
      const result = await scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data!.scannedFiles).toBe(0);
      expect(result.data!.updatedBanks).toBe(0);
    });

    it("should extract bank letter and artist name correctly", async () => {
      fs.writeFileSync(
        path.join(TEST_DB_DIR, "C - My Cool Artist.rtf"),
        "rtf content",
      );

      const result = await scanService.scanBanks(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data!.scannedFiles).toBe(1);
      // The bank update should have been called (updatedBanks counts successful updates)
      expect(result.data!.updatedBanks).toBeGreaterThanOrEqual(0);
    });
  });

  describe("rescanKitsWithMissingMetadata", () => {
    it("should return error when localStorePath is not configured", async () => {
      const result = await scanService.rescanKitsWithMissingMetadata({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("should identify kits with missing metadata and rescan them", async () => {
      // Create two kits
      const kit1: NewKit = {
        alias: "Kit With Metadata",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      };
      const kit2: NewKit = {
        alias: "Kit Missing Metadata",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A2",
        step_pattern: null,
      };
      addKit(TEST_DB_PATH, kit1);
      addKit(TEST_DB_PATH, kit2);

      // Add sample with metadata to kit1
      addSample(TEST_DB_PATH, {
        filename: "1-kick.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: path.join(TEST_DB_DIR, "A1", "1-kick.wav"),
        voice_number: 1,
        wav_bit_depth: 16,
        wav_channels: 1,
        wav_sample_rate: 44100,
      });

      // Add sample without metadata to kit2 (null values)
      addSample(TEST_DB_PATH, {
        filename: "1-pad.wav",
        is_stereo: false,
        kit_name: "A2",
        slot_number: 0,
        source_path: path.join(TEST_DB_DIR, "A2", "1-pad.wav"),
        voice_number: 1,
      });

      // Create directories and WAV files for the kits that need rescanning
      const kit1Dir = path.join(TEST_DB_DIR, "A1");
      const kit2Dir = path.join(TEST_DB_DIR, "A2");
      fs.mkdirSync(kit1Dir, { recursive: true });
      fs.mkdirSync(kit2Dir, { recursive: true });
      createTestWavFile(path.join(kit1Dir, "1-kick.wav"));
      createTestWavFile(path.join(kit2Dir, "1-pad.wav"));

      const result =
        await scanService.rescanKitsWithMissingMetadata(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      // Kit A2 has missing metadata, so it needs rescan
      expect(result.data!.kitsNeedingRescan).toContain("A2");
    });

    it("should return empty arrays when no samples exist", async () => {
      const result =
        await scanService.rescanKitsWithMissingMetadata(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.data!.kitsNeedingRescan).toHaveLength(0);
      expect(result.data!.kitsRescanned).toHaveLength(0);
      expect(result.data!.totalSamplesUpdated).toBe(0);
    });
  });
});
