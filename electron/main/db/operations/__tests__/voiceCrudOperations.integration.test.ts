import * as schema from "@romper/shared/db/schema.js";
import { eq } from "drizzle-orm";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createStoreDb } from "../../../../../tests/integration/support/storeDb.js";
import {
  createTempStore,
  removeTempStore,
} from "../../../../../tests/integration/support/tempStore.js";
import { withDb } from "../../utils/dbUtilities.js";
import { addKit, getKit, updateKit } from "../kitCrudOperations.js";
import { markKitAsSynced } from "../kitSyncOperations.js";
import {
  updateVoiceAlias,
  updateVoiceSampleMode,
  updateVoiceSliceSettings,
  updateVoiceStereoMode,
  updateVoiceVolume,
} from "../voiceCrudOperations.js";

describe("Voice CRUD Operations - Integration Tests", () => {
  let tempDir: string;
  let dbDir: string;
  const testKitName = "TestKit";

  beforeEach(() => {
    tempDir = createTempStore("romper-voice-crud-");
    dbDir = join(tempDir, ".romperdb");
    createStoreDb(dbDir);

    addKit(dbDir, {
      bank_letter: "A",
      editable: true,
      name: testKitName,
    });
  });

  afterEach(() => {
    removeTempStore(tempDir);
  });

  // #510: a kit has one row per voice, and the database itself refuses a
  // second one
  describe("[Q-02] one row per voice", () => {
    const voiceRows = (voiceNumber: number) =>
      getKit(dbDir, testKitName).data!.voices!.filter(
        (v) => v.voice_number === voiceNumber,
      );

    test("adds a missing voice row only once, however many edits create it", () => {
      withDb(dbDir, (db) =>
        db
          .delete(schema.voices)
          .where(eq(schema.voices.kit_name, testKitName))
          .run(),
      );

      expect(updateVoiceVolume(dbDir, testKitName, 2, 70).success).toBe(true);
      expect(
        updateVoiceSampleMode(dbDir, testKitName, 2, "random").success,
      ).toBe(true);
      expect(updateVoiceAlias(dbDir, testKitName, 2, "Snare").success).toBe(
        true,
      );

      const rows = voiceRows(2);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        sample_mode: "random",
        voice_alias: "Snare",
        voice_volume: 70,
      });
    });

    test("refuses a second row for the same voice", () => {
      const result = withDb(dbDir, (db) =>
        db
          .insert(schema.voices)
          .values({ kit_name: testKitName, voice_number: 1 })
          .run(),
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/UNIQUE constraint failed/);
      expect(voiceRows(1)).toHaveLength(1);
    });
  });

  describe("[UC-27] updateVoiceAlias", () => {
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

  describe("updateVoiceStereoMode", () => {
    test("[UC-28] links and unlinks a voice, marking the kit modified each time", () => {
      markKitAsSynced(dbDir, testKitName);
      expect(updateVoiceStereoMode(dbDir, testKitName, 1, true).success).toBe(
        true,
      );
      let kit = getKit(dbDir, testKitName).data!;
      expect(kit.voices!.find((v) => v.voice_number === 1)!.stereo_mode).toBe(
        true,
      );
      expect(kit.modified_since_sync).toBe(true);

      // Unlinking changes the next write too: stereo files go out as mono
      markKitAsSynced(dbDir, testKitName);
      expect(updateVoiceStereoMode(dbDir, testKitName, 1, false).success).toBe(
        true,
      );
      kit = getKit(dbDir, testKitName).data!;
      expect(kit.voices!.find((v) => v.voice_number === 1)!.stereo_mode).toBe(
        false,
      );
      expect(kit.modified_since_sync).toBe(true);
    });
  });

  describe("[UC-32] updateVoiceVolume", () => {
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

  describe("[UC-32] updateVoiceSampleMode", () => {
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

  describe("[UC-33] updateVoiceSliceSettings", () => {
    test("new voices default to slice mode off with default roll settings", () => {
      const kit = getKit(dbDir, testKitName);
      const voice1 = kit.data!.voices!.find((v) => v.voice_number === 1);
      expect(voice1!.slice_enabled).toBe(false);
      expect(voice1!.slice_roll_amount).toBe(100);
      expect(voice1!.slice_vary_length).toBe(false);
      expect(voice1!.slice_max_length).toBe(2);
    });

    test("updates only the provided fields", () => {
      updateVoiceSliceSettings(dbDir, testKitName, 2, { enabled: true });
      const result = updateVoiceSliceSettings(dbDir, testKitName, 2, {
        maxLength: 4,
        rollAmount: 25,
        varyLength: true,
      });
      expect(result.success).toBe(true);

      const kit = getKit(dbDir, testKitName);
      const voice2 = kit.data!.voices!.find((v) => v.voice_number === 2);
      expect(voice2!.slice_enabled).toBe(true);
      expect(voice2!.slice_roll_amount).toBe(25);
      expect(voice2!.slice_vary_length).toBe(true);
      expect(voice2!.slice_max_length).toBe(4);

      const voice1 = kit.data!.voices!.find((v) => v.voice_number === 1);
      expect(voice1!.slice_enabled).toBe(false);
    });

    test("an empty update succeeds without changing anything", () => {
      const result = updateVoiceSliceSettings(dbDir, testKitName, 1, {});
      expect(result.success).toBe(true);
    });
  });

  describe("[UC-33] kit slicer fields", () => {
    test("default to /16 and no slice data", () => {
      const kit = getKit(dbDir, testKitName);
      expect(kit.data!.slicer_division).toBe(16);
      expect(kit.data!.slice_steps).toBeNull();
    });

    test("round-trip slicer division and slice steps", () => {
      const sliceSteps = Array.from({ length: 4 }, () =>
        new Array(16).fill(null),
      );
      sliceSteps[0][2] = { length: 24, locked: true, random: false, start: 96 };
      updateKit(dbDir, testKitName, {
        slice_steps: sliceSteps,
        slicer_division: 32,
      });

      const kit = getKit(dbDir, testKitName);
      expect(kit.data!.slicer_division).toBe(32);
      expect(kit.data!.slice_steps![0][2]).toEqual({
        length: 24,
        locked: true,
        random: false,
        start: 96,
      });
      expect(kit.data!.slice_steps![1][0]).toBeNull();
    });
  });
});
