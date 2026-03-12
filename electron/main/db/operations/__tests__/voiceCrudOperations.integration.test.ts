import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createRomperDbFile } from "../../utils/dbUtilities.js";
import { addKit, getKit } from "../kitCrudOperations.js";
import {
  updateVoiceAlias,
  updateVoiceSampleMode,
  updateVoiceVolume,
} from "../voiceCrudOperations.js";

describe("Voice CRUD Operations - Integration Tests", () => {
  let tempDir: string;
  let dbDir: string;
  const testKitName = "TestKit";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "romper-voice-crud-"));
    dbDir = join(tempDir, ".romperdb");
    createRomperDbFile(dbDir);

    addKit(dbDir, {
      bank_letter: "A",
      editable: true,
      name: testKitName,
    });
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  describe("updateVoiceAlias", () => {
    test("sets voice alias for a specific voice", () => {
      const result = updateVoiceAlias(dbDir, testKitName, 1, "Kick");
      expect(result.success).toBe(true);

      const kit = getKit(dbDir, testKitName);
      const voice1 = kit.data!.voices!.find((v) => v.voice_number === 1);
      expect(voice1!.voice_alias).toBe("Kick");
    });

    test("sets different aliases for different voices", () => {
      updateVoiceAlias(dbDir, testKitName, 1, "Kick");
      updateVoiceAlias(dbDir, testKitName, 2, "Snare");
      updateVoiceAlias(dbDir, testKitName, 3, "Hi-Hat");
      updateVoiceAlias(dbDir, testKitName, 4, "Bass");

      const kit = getKit(dbDir, testKitName);
      const aliases = kit
        .data!.voices!.sort((a, b) => a.voice_number - b.voice_number)
        .map((v) => v.voice_alias);

      expect(aliases).toEqual(["Kick", "Snare", "Hi-Hat", "Bass"]);
    });

    test("overwrites existing alias", () => {
      updateVoiceAlias(dbDir, testKitName, 1, "Kick");
      updateVoiceAlias(dbDir, testKitName, 1, "Bass Drum");

      const kit = getKit(dbDir, testKitName);
      const voice1 = kit.data!.voices!.find((v) => v.voice_number === 1);
      expect(voice1!.voice_alias).toBe("Bass Drum");
    });

    test("does not affect other voices in the same kit", () => {
      updateVoiceAlias(dbDir, testKitName, 1, "Kick");

      const kit = getKit(dbDir, testKitName);
      const voice2 = kit.data!.voices!.find((v) => v.voice_number === 2);
      expect(voice2!.voice_alias).toBeNull();
    });

    test("does not affect voices in other kits", () => {
      addKit(dbDir, { bank_letter: "B", name: "OtherKit" });
      updateVoiceAlias(dbDir, testKitName, 1, "Kick");

      const otherKit = getKit(dbDir, "OtherKit");
      const voice1 = otherKit.data!.voices!.find((v) => v.voice_number === 1);
      expect(voice1!.voice_alias).toBeNull();
    });
  });

  describe("updateVoiceVolume", () => {
    test("sets voice volume for a specific voice", () => {
      const result = updateVoiceVolume(dbDir, testKitName, 1, 75);
      expect(result.success).toBe(true);

      const kit = getKit(dbDir, testKitName);
      const voice1 = kit.data!.voices!.find((v) => v.voice_number === 1);
      expect(voice1!.voice_volume).toBe(75);
    });

    test("creates voice row if it does not exist (ensureVoiceRow)", () => {
      // Kit has no voice rows yet — updateVoiceVolume should create one
      const result = updateVoiceVolume(dbDir, testKitName, 3, 50);
      expect(result.success).toBe(true);

      const kit = getKit(dbDir, testKitName);
      const voice3 = kit.data!.voices!.find((v) => v.voice_number === 3);
      expect(voice3).toBeDefined();
      expect(voice3!.voice_volume).toBe(50);
    });

    test("updates volume on existing voice row without creating duplicates", () => {
      // Create voice row first via alias
      updateVoiceAlias(dbDir, testKitName, 1, "Kick");

      // Now update volume on the same voice
      const result = updateVoiceVolume(dbDir, testKitName, 1, 80);
      expect(result.success).toBe(true);

      const kit = getKit(dbDir, testKitName);
      const voice1Rows = kit.data!.voices!.filter((v) => v.voice_number === 1);
      // Should be exactly one row, not a duplicate
      expect(voice1Rows).toHaveLength(1);
      expect(voice1Rows[0].voice_volume).toBe(80);
      expect(voice1Rows[0].voice_alias).toBe("Kick"); // Alias preserved
    });
  });

  describe("updateVoiceSampleMode", () => {
    test("sets sample mode for a specific voice", () => {
      const result = updateVoiceSampleMode(dbDir, testKitName, 2, "random");
      expect(result.success).toBe(true);

      const kit = getKit(dbDir, testKitName);
      const voice2 = kit.data!.voices!.find((v) => v.voice_number === 2);
      expect(voice2!.sample_mode).toBe("random");
    });

    test("creates voice row if it does not exist (ensureVoiceRow)", () => {
      const result = updateVoiceSampleMode(
        dbDir,
        testKitName,
        4,
        "round-robin",
      );
      expect(result.success).toBe(true);

      const kit = getKit(dbDir, testKitName);
      const voice4 = kit.data!.voices!.find((v) => v.voice_number === 4);
      expect(voice4).toBeDefined();
      expect(voice4!.sample_mode).toBe("round-robin");
    });

    test("updates sample mode on existing voice row", () => {
      updateVoiceSampleMode(dbDir, testKitName, 1, "random");
      updateVoiceSampleMode(dbDir, testKitName, 1, "round-robin");

      const kit = getKit(dbDir, testKitName);
      const voice1 = kit.data!.voices!.find((v) => v.voice_number === 1);
      expect(voice1!.sample_mode).toBe("round-robin");
    });

    test("does not affect other voice settings", () => {
      updateVoiceVolume(dbDir, testKitName, 1, 60);
      updateVoiceSampleMode(dbDir, testKitName, 1, "random");

      const kit = getKit(dbDir, testKitName);
      const voice1 = kit.data!.voices!.find((v) => v.voice_number === 1);
      expect(voice1!.voice_volume).toBe(60); // Volume preserved
      expect(voice1!.sample_mode).toBe("random");
    });
  });
});
