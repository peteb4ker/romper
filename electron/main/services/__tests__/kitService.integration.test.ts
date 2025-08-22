import type { NewKit, NewSample } from "@romper/shared/db/schema.js";

import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { InMemorySettings } from "../../types/settings.js";

import { deleteDbFileWithRetry } from "../../db/fileOperations.js";
import {
  addKit,
  addSample,
  createRomperDbFile,
  getKit,
  getKitSamples,
} from "../../db/romperDbCoreORM.js";
import { KitService } from "../kitService.js";
import { ScanService } from "../scanService.js";

// Test utilities
const TEST_DB_DIR = path.join(__dirname, "test-data");
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

describe("KitService Integration Tests", () => {
  let kitService: KitService;
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

    kitService = new KitService();
    scanService = new ScanService();
    mockInMemorySettings = {
      localStorePath: TEST_LOCAL_STORE_PATH,
    };
  });

  afterEach(async () => {
    await cleanupSqliteFiles(TEST_DB_DIR);
  });

  describe("Kit Duplication Integration", () => {
    it("should fully duplicate a kit with all samples", () => {
      // Setup: Create a source kit with multiple samples
      const sourceKitRecord: NewKit = {
        alias: "Test Source Kit",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: "1010101010101010",
      };

      const addKitResult = addKit(TEST_DB_PATH, sourceKitRecord);
      expect(addKitResult.success).toBe(true);

      // Add sample data to the source kit
      const sample1: NewSample = {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: "/test/path/kick.wav",
        voice_number: 1,
        wav_bitrate: 16,
        wav_sample_rate: 44100,
      };

      const sample2: NewSample = {
        filename: "snare.wav",
        is_stereo: true,
        kit_name: "A1",
        slot_number: 1,
        source_path: "/test/path/snare.wav",
        voice_number: 1,
        wav_bitrate: 24,
        wav_sample_rate: 48000,
      };

      const sample3: NewSample = {
        filename: "hat.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: "/test/path/hat.wav",
        voice_number: 2,
        wav_bitrate: 16,
        wav_sample_rate: 44100,
      };

      const addSample1Result = addSample(TEST_DB_PATH, sample1);
      const addSample2Result = addSample(TEST_DB_PATH, sample2);
      const addSample3Result = addSample(TEST_DB_PATH, sample3);

      expect(addSample1Result.success).toBe(true);
      expect(addSample2Result.success).toBe(true);
      expect(addSample3Result.success).toBe(true);

      // Verify source kit has samples before duplication
      const sourceSamplesBeforeCopy = getKitSamples(TEST_DB_PATH, "A1");
      expect(sourceSamplesBeforeCopy.success).toBe(true);
      expect(sourceSamplesBeforeCopy.data).toHaveLength(3);

      // Action: Duplicate the kit
      const copyResult = kitService.copyKit(mockInMemorySettings, "A1", "B5");
      expect(copyResult.success).toBe(true);

      // Verification: Check destination kit exists
      const destKitResult = getKit(TEST_DB_PATH, "B5");
      expect(destKitResult.success).toBe(true);
      expect(destKitResult.data).toBeTruthy();

      if (destKitResult.data) {
        expect(destKitResult.data.name).toBe("B5");
        expect(destKitResult.data.alias).toBe("Test Source Kit");
        expect(destKitResult.data.bank_letter).toBe("B");
        expect(destKitResult.data.editable).toBe(true);
        expect(destKitResult.data.locked).toBe(false);
        expect(destKitResult.data.step_pattern).toBe("1010101010101010");
      }

      // Verification: Check all samples were copied
      const destSamplesResult = getKitSamples(TEST_DB_PATH, "B5");
      expect(destSamplesResult.success).toBe(true);
      expect(destSamplesResult.data).toBeTruthy();
      expect(destSamplesResult.data).toHaveLength(3);

      if (destSamplesResult.data) {
        // Verify each sample was copied correctly
        const destSamples = destSamplesResult.data;

        // Find samples by voice and slot to verify they were copied
        const destKick = destSamples.find(
          (s) => s.voice_number === 1 && s.slot_number === 0,
        );
        const destSnare = destSamples.find(
          (s) => s.voice_number === 1 && s.slot_number === 1,
        );
        const destHat = destSamples.find(
          (s) => s.voice_number === 2 && s.slot_number === 0,
        );

        expect(destKick).toBeTruthy();
        expect(destSnare).toBeTruthy();
        expect(destHat).toBeTruthy();

        if (destKick) {
          expect(destKick.kit_name).toBe("B5");
          expect(destKick.filename).toBe("kick.wav");
          expect(destKick.source_path).toBe("/test/path/kick.wav");
          expect(destKick.is_stereo).toBe(false);
          expect(destKick.wav_bitrate).toBe(16);
          expect(destKick.wav_sample_rate).toBe(44100);
        }

        if (destSnare) {
          expect(destSnare.kit_name).toBe("B5");
          expect(destSnare.filename).toBe("snare.wav");
          expect(destSnare.source_path).toBe("/test/path/snare.wav");
          expect(destSnare.is_stereo).toBe(true);
          expect(destSnare.wav_bitrate).toBe(24);
          expect(destSnare.wav_sample_rate).toBe(48000);
        }

        if (destHat) {
          expect(destHat.kit_name).toBe("B5");
          expect(destHat.filename).toBe("hat.wav");
          expect(destHat.source_path).toBe("/test/path/hat.wav");
          expect(destHat.is_stereo).toBe(false);
          expect(destHat.wav_bitrate).toBe(16);
          expect(destHat.wav_sample_rate).toBe(44100);
        }
      }

      // Verification: Original kit should still exist and be unchanged
      const sourceSamplesAfterCopy = getKitSamples(TEST_DB_PATH, "A1");
      expect(sourceSamplesAfterCopy.success).toBe(true);
      expect(sourceSamplesAfterCopy.data).toHaveLength(3);
    });

    it("should handle kit duplication when source kit has no samples", () => {
      // Setup: Create a source kit with NO samples
      const sourceKitRecord: NewKit = {
        alias: "Empty Kit",
        bank_letter: "C",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "C1",
        step_pattern: null,
      };

      const addKitResult = addKit(TEST_DB_PATH, sourceKitRecord);
      expect(addKitResult.success).toBe(true);

      // Verify source kit has no samples
      const sourceSamplesBeforeCopy = getKitSamples(TEST_DB_PATH, "C1");
      expect(sourceSamplesBeforeCopy.success).toBe(true);
      expect(sourceSamplesBeforeCopy.data).toHaveLength(0);

      // Action: Duplicate the empty kit
      const copyResult = kitService.copyKit(mockInMemorySettings, "C1", "D2");
      expect(copyResult.success).toBe(true);

      // Verification: Check destination kit exists
      const destKitResult = getKit(TEST_DB_PATH, "D2");
      expect(destKitResult.success).toBe(true);
      expect(destKitResult.data).toBeTruthy();

      if (destKitResult.data) {
        expect(destKitResult.data.name).toBe("D2");
        expect(destKitResult.data.alias).toBe("Empty Kit");
        expect(destKitResult.data.bank_letter).toBe("D");
      }

      // Verification: Check destination has no samples (should be empty like source)
      const destSamplesResult = getKitSamples(TEST_DB_PATH, "D2");
      expect(destSamplesResult.success).toBe(true);
      expect(destSamplesResult.data).toHaveLength(0);
    });

    it("REGRESSION TEST: demonstrates rescanKit incompatibility with reference-only duplication", async () => {
      // This test documents the issue: rescanKit is incompatible with reference-only kit duplication
      // because it deletes sample references and expects physical directories.

      const sourceKitRecord: NewKit = {
        alias: "Source Kit",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: "1010101010101010",
      };

      const addKitResult = addKit(TEST_DB_PATH, sourceKitRecord);
      expect(addKitResult.success).toBe(true);

      const sample1: NewSample = {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: "/test/path/kick.wav",
        voice_number: 1,
        wav_bitrate: 16,
        wav_sample_rate: 44100,
      };

      const addSample1Result = addSample(TEST_DB_PATH, sample1);
      expect(addSample1Result.success).toBe(true);

      // Duplicate the kit successfully
      const copyResult = kitService.copyKit(mockInMemorySettings, "A1", "B5");
      expect(copyResult.success).toBe(true);

      // Verify duplication copied samples correctly
      const destSamplesAfterCopy = getKitSamples(TEST_DB_PATH, "B5");
      expect(destSamplesAfterCopy.success).toBe(true);
      expect(destSamplesAfterCopy.data).toHaveLength(1);

      // THIS IS THE BUG: rescanKit deletes all samples before scanning directory
      // Since duplicated kits don't have physical directories, this leaves them empty
      const rescanResult = await scanService.rescanKit(
        mockInMemorySettings,
        "B5",
      );
      expect(rescanResult.success).toBe(false);
      expect(rescanResult.error).toContain("Kit directory not found");

      // The bug: samples are deleted even when rescan fails
      const destSamplesAfterRescan = getKitSamples(TEST_DB_PATH, "B5");
      expect(destSamplesAfterRescan.success).toBe(true);
      expect(destSamplesAfterRescan.data).toHaveLength(0); // Samples are gone!

      // This demonstrates why rescanKit should not be called on duplicated kits
    });
  });
});
