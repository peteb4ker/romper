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
  getKit,
  getKitSamples,
} from "../../db/romperDbCoreORM.js";
import { KitService } from "../kitService.js";

/**
 * Extended integration tests for KitService
 *
 * Tests the currently uncovered methods: createKit, deleteKit,
 * getKitDeleteSummary, copyKit edge cases, and validation.
 * Uses a real SQLite database following the same pattern as
 * kitService.integration.test.ts.
 */

const TEST_DB_DIR = path.join(__dirname, "test-data-kit-extended");
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

describe("KitService Extended Integration Tests", () => {
  let kitService: KitService;
  let mockInMemorySettings: InMemorySettings;

  beforeEach(async () => {
    if (!fs.existsSync(TEST_DB_DIR)) {
      fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }
    await cleanupSqliteFiles(TEST_DB_DIR);
    createRomperDbFile(TEST_DB_PATH);

    kitService = new KitService();
    mockInMemorySettings = {
      localStorePath: TEST_LOCAL_STORE_PATH,
    };
  });

  afterEach(async () => {
    await cleanupSqliteFiles(TEST_DB_DIR);
  });

  describe("createKit", () => {
    it("should create a new kit with 4 default voices", () => {
      const result = kitService.createKit(mockInMemorySettings, "A1");

      expect(result.success).toBe(true);

      // Verify kit was created in the database
      const kit = getKit(TEST_DB_PATH, "A1");
      expect(kit.success).toBe(true);
      expect(kit.data).toBeTruthy();
      expect(kit.data!.name).toBe("A1");
      expect(kit.data!.bank_letter).toBe("A");
      expect(kit.data!.editable).toBe(true);
      expect(kit.data!.locked).toBe(false);
      expect(kit.data!.alias).toBeNull();
      expect(kit.data!.step_pattern).toBeNull();

      // Verify 4 voices were created
      expect(kit.data!.voices).toHaveLength(4);
      const voiceNumbers = kit.data!.voices.map((v) => v.voice_number).sort();
      expect(voiceNumbers).toEqual([1, 2, 3, 4]);
    });

    it("should return error when creating a kit that already exists", () => {
      // Create kit first
      const first = kitService.createKit(mockInMemorySettings, "B1");
      expect(first.success).toBe(true);

      // Try to create again
      const second = kitService.createKit(mockInMemorySettings, "B1");
      expect(second.success).toBe(false);
      expect(second.error).toContain("already exists");
    });

    it("should return error when localStorePath is not configured", () => {
      const result = kitService.createKit({ localStorePath: null }, "A1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("should create kits in different banks", () => {
      const resultA = kitService.createKit(mockInMemorySettings, "A0");
      const resultB = kitService.createKit(mockInMemorySettings, "B5");
      const resultZ = kitService.createKit(mockInMemorySettings, "Z99");

      expect(resultA.success).toBe(true);
      expect(resultB.success).toBe(true);
      expect(resultZ.success).toBe(true);

      const kitA = getKit(TEST_DB_PATH, "A0");
      expect(kitA.data!.bank_letter).toBe("A");

      const kitB = getKit(TEST_DB_PATH, "B5");
      expect(kitB.data!.bank_letter).toBe("B");

      const kitZ = getKit(TEST_DB_PATH, "Z99");
      expect(kitZ.data!.bank_letter).toBe("Z");
    });
  });

  describe("deleteKit", () => {
    it("should delete a kit and all its samples", () => {
      // Setup: Create kit with samples
      const kitRecord: NewKit = {
        alias: "Deletable Kit",
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
        source_path: "/test/kick.wav",
        voice_number: 1,
        wav_bitrate: 16,
        wav_sample_rate: 44100,
      };
      addSample(TEST_DB_PATH, sample);

      // Verify kit and sample exist before delete
      const beforeDelete = getKit(TEST_DB_PATH, "A1");
      expect(beforeDelete.success).toBe(true);
      expect(beforeDelete.data).toBeTruthy();

      const samplesBeforeDelete = getKitSamples(TEST_DB_PATH, "A1");
      expect(samplesBeforeDelete.data).toHaveLength(1);

      // Delete the kit
      const result = kitService.deleteKit(mockInMemorySettings, "A1");
      expect(result.success).toBe(true);

      // Verify kit and all samples are gone
      const afterDelete = getKit(TEST_DB_PATH, "A1");
      expect(afterDelete.data).toBeNull();

      const samplesAfterDelete = getKitSamples(TEST_DB_PATH, "A1");
      expect(samplesAfterDelete.data).toHaveLength(0);
    });

    it("should return error when deleting a non-existent kit", () => {
      const result = kitService.deleteKit(mockInMemorySettings, "Z1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should return error when deleting a locked kit", () => {
      // Create a locked kit
      const kitRecord: NewKit = {
        alias: "Locked Kit",
        bank_letter: "C",
        editable: false,
        locked: true,
        modified_since_sync: false,
        name: "C1",
        step_pattern: null,
      };
      addKit(TEST_DB_PATH, kitRecord);

      const result = kitService.deleteKit(mockInMemorySettings, "C1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("locked");
    });

    it("should return error when localStorePath is not configured", () => {
      const result = kitService.deleteKit({ localStorePath: null }, "A1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("should delete a kit with many samples across multiple voices", () => {
      // Create a kit with samples across all 4 voices
      const kitRecord: NewKit = {
        alias: "Full Kit",
        bank_letter: "D",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "D1",
        step_pattern: null,
      };
      addKit(TEST_DB_PATH, kitRecord);

      // Add samples to all 4 voices, multiple slots
      for (let voice = 1; voice <= 4; voice++) {
        for (let slot = 0; slot < 3; slot++) {
          addSample(TEST_DB_PATH, {
            filename: `voice${voice}_slot${slot}.wav`,
            is_stereo: false,
            kit_name: "D1",
            slot_number: slot,
            source_path: `/test/voice${voice}_slot${slot}.wav`,
            voice_number: voice,
            wav_bitrate: 16,
            wav_sample_rate: 44100,
          });
        }
      }

      // Verify 12 samples exist
      const samplesBefore = getKitSamples(TEST_DB_PATH, "D1");
      expect(samplesBefore.data).toHaveLength(12);

      // Delete
      const result = kitService.deleteKit(mockInMemorySettings, "D1");
      expect(result.success).toBe(true);

      // Verify everything is gone
      const kitAfter = getKit(TEST_DB_PATH, "D1");
      expect(kitAfter.data).toBeNull();

      const samplesAfter = getKitSamples(TEST_DB_PATH, "D1");
      expect(samplesAfter.data).toHaveLength(0);
    });

    it("should not affect other kits when deleting one", () => {
      // Create two kits
      addKit(TEST_DB_PATH, {
        alias: "Kit to Delete",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      });

      addKit(TEST_DB_PATH, {
        alias: "Kit to Keep",
        bank_letter: "B",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "B1",
        step_pattern: null,
      });

      addSample(TEST_DB_PATH, {
        filename: "a-sample.wav",
        is_stereo: false,
        kit_name: "A1",
        slot_number: 0,
        source_path: "/test/a.wav",
        voice_number: 1,
        wav_bitrate: 16,
        wav_sample_rate: 44100,
      });

      addSample(TEST_DB_PATH, {
        filename: "b-sample.wav",
        is_stereo: false,
        kit_name: "B1",
        slot_number: 0,
        source_path: "/test/b.wav",
        voice_number: 1,
        wav_bitrate: 16,
        wav_sample_rate: 44100,
      });

      // Delete A1
      kitService.deleteKit(mockInMemorySettings, "A1");

      // B1 should still exist with its sample
      const kitB = getKit(TEST_DB_PATH, "B1");
      expect(kitB.success).toBe(true);
      expect(kitB.data).toBeTruthy();
      expect(kitB.data!.name).toBe("B1");

      const samplesB = getKitSamples(TEST_DB_PATH, "B1");
      expect(samplesB.data).toHaveLength(1);
      expect(samplesB.data![0].filename).toBe("b-sample.wav");
    });
  });

  describe("getKitDeleteSummary", () => {
    it("should return summary with sample and voice counts", () => {
      // Create kit with voices and samples
      addKit(TEST_DB_PATH, {
        alias: "Summary Kit",
        bank_letter: "E",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "E1",
        step_pattern: null,
      });

      addSample(TEST_DB_PATH, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "E1",
        slot_number: 0,
        source_path: "/test/kick.wav",
        voice_number: 1,
        wav_bitrate: 16,
        wav_sample_rate: 44100,
      });

      addSample(TEST_DB_PATH, {
        filename: "snare.wav",
        is_stereo: false,
        kit_name: "E1",
        slot_number: 0,
        source_path: "/test/snare.wav",
        voice_number: 2,
        wav_bitrate: 16,
        wav_sample_rate: 44100,
      });

      const result = kitService.getKitDeleteSummary(mockInMemorySettings, "E1");

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.kitName).toBe("E1");
      expect(result.data!.locked).toBe(false);
      expect(result.data!.sampleCount).toBe(2);
      expect(result.data!.voiceCount).toBe(4); // addKit creates 4 voices
    });

    it("should return summary for kit with no samples", () => {
      addKit(TEST_DB_PATH, {
        alias: null,
        bank_letter: "F",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "F1",
        step_pattern: null,
      });

      const result = kitService.getKitDeleteSummary(mockInMemorySettings, "F1");

      expect(result.success).toBe(true);
      expect(result.data!.sampleCount).toBe(0);
      expect(result.data!.voiceCount).toBe(4);
    });

    it("should correctly report locked status", () => {
      addKit(TEST_DB_PATH, {
        alias: null,
        bank_letter: "G",
        editable: false,
        locked: true,
        modified_since_sync: false,
        name: "G1",
        step_pattern: null,
      });

      const result = kitService.getKitDeleteSummary(mockInMemorySettings, "G1");

      expect(result.success).toBe(true);
      expect(result.data!.locked).toBe(true);
    });

    it("should return error for non-existent kit", () => {
      const result = kitService.getKitDeleteSummary(mockInMemorySettings, "Z9");

      expect(result.success).toBe(false);
    });

    it("should return error when localStorePath is not configured", () => {
      const result = kitService.getKitDeleteSummary(
        { localStorePath: null },
        "A1",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });
  });

  describe("copyKit - additional edge cases", () => {
    it("should return error when source kit does not exist", () => {
      const result = kitService.copyKit(mockInMemorySettings, "A1", "B1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Source kit does not exist");
    });

    it("should return error when destination kit already exists", () => {
      addKit(TEST_DB_PATH, {
        alias: "Source",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      });

      addKit(TEST_DB_PATH, {
        alias: "Dest",
        bank_letter: "B",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "B1",
        step_pattern: null,
      });

      const result = kitService.copyKit(mockInMemorySettings, "A1", "B1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Destination kit already exists");
    });

    it("should return error when localStorePath is not configured", () => {
      const result = kitService.copyKit({ localStorePath: null }, "A1", "B1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("should preserve step_pattern during copy", () => {
      const stepPattern = "1010101010101010";
      addKit(TEST_DB_PATH, {
        alias: "Patterned Kit",
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: stepPattern,
      });

      kitService.copyKit(mockInMemorySettings, "A1", "B1");

      const copiedKit = getKit(TEST_DB_PATH, "B1");
      expect(copiedKit.data!.step_pattern).toBe(stepPattern);
    });

    it("should set copied kit as editable and unlocked", () => {
      // Create a locked source kit
      addKit(TEST_DB_PATH, {
        alias: "Locked Source",
        bank_letter: "A",
        editable: false,
        locked: true,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      });

      const result = kitService.copyKit(mockInMemorySettings, "A1", "B1");
      expect(result.success).toBe(true);

      const copiedKit = getKit(TEST_DB_PATH, "B1");
      expect(copiedKit.data!.editable).toBe(true);
      expect(copiedKit.data!.locked).toBe(false);
    });
  });

  describe("Validation edge cases", () => {
    it("should throw on invalid kit slot format: lowercase letters", () => {
      expect(() => {
        kitService.createKit(mockInMemorySettings, "a1");
      }).toThrow("Invalid kit slot");
    });

    it("should throw on invalid kit slot format: missing number", () => {
      expect(() => {
        kitService.createKit(mockInMemorySettings, "A");
      }).toThrow("Invalid kit slot");
    });

    it("should throw on invalid kit slot format: too many digits", () => {
      expect(() => {
        kitService.createKit(mockInMemorySettings, "A100");
      }).toThrow("Invalid kit slot");
    });

    it("should throw on invalid kit slot format: special characters", () => {
      expect(() => {
        kitService.createKit(mockInMemorySettings, "A#1");
      }).toThrow("Invalid kit slot");
    });

    it("should throw on empty kit slot", () => {
      expect(() => {
        kitService.createKit(mockInMemorySettings, "");
      }).toThrow("Invalid kit slot");
    });

    it("should accept single-digit kit numbers", () => {
      const result = kitService.createKit(mockInMemorySettings, "A0");
      expect(result.success).toBe(true);
    });

    it("should accept double-digit kit numbers", () => {
      const result = kitService.createKit(mockInMemorySettings, "A99");
      expect(result.success).toBe(true);
    });
  });

  describe("createKit then deleteKit roundtrip", () => {
    it("should create and then fully delete a kit", () => {
      // Create
      const createResult = kitService.createKit(mockInMemorySettings, "H1");
      expect(createResult.success).toBe(true);

      // Verify exists
      const kit = getKit(TEST_DB_PATH, "H1");
      expect(kit.data).toBeTruthy();
      expect(kit.data!.voices).toHaveLength(4);

      // Delete
      const deleteResult = kitService.deleteKit(mockInMemorySettings, "H1");
      expect(deleteResult.success).toBe(true);

      // Verify gone
      const deleted = getKit(TEST_DB_PATH, "H1");
      expect(deleted.data).toBeNull();
    });

    it("should allow re-creating a kit after deletion", () => {
      // Create
      kitService.createKit(mockInMemorySettings, "I1");

      // Delete
      kitService.deleteKit(mockInMemorySettings, "I1");

      // Re-create
      const result = kitService.createKit(mockInMemorySettings, "I1");
      expect(result.success).toBe(true);

      const kit = getKit(TEST_DB_PATH, "I1");
      expect(kit.data).toBeTruthy();
      expect(kit.data!.name).toBe("I1");
    });
  });

  describe("copyKit then getKitDeleteSummary", () => {
    it("should report correct counts after copying a kit with samples", () => {
      // Create source with samples
      addKit(TEST_DB_PATH, {
        alias: "Original",
        bank_letter: "J",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "J1",
        step_pattern: null,
      });

      for (let voice = 1; voice <= 3; voice++) {
        addSample(TEST_DB_PATH, {
          filename: `v${voice}.wav`,
          is_stereo: false,
          kit_name: "J1",
          slot_number: 0,
          source_path: `/test/v${voice}.wav`,
          voice_number: voice,
          wav_bitrate: 16,
          wav_sample_rate: 44100,
        });
      }

      // Copy
      kitService.copyKit(mockInMemorySettings, "J1", "K1");

      // Get delete summary for the copy
      const summary = kitService.getKitDeleteSummary(
        mockInMemorySettings,
        "K1",
      );

      expect(summary.success).toBe(true);
      expect(summary.data!.kitName).toBe("K1");
      expect(summary.data!.sampleCount).toBe(3);
      expect(summary.data!.voiceCount).toBe(4); // addKit creates 4 voices
      expect(summary.data!.locked).toBe(false);
    });
  });
});
