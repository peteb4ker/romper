import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createRomperDbFile } from "../../utils/dbUtilities.js";
import { addKit, getKit } from "../kitCrudOperations.js";
import { updateVoiceAlias } from "../voiceCrudOperations.js";

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
});
