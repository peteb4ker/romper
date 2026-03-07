import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createRomperDbFile } from "../../utils/dbUtilities.js";
import {
  addKit,
  deleteKit,
  getKit,
  getKitDeleteSummary,
  getKits,
  getKitsMetadata,
  updateKit,
} from "../kitCrudOperations.js";
import { addSample } from "../sampleCrudOperations.js";

describe("Kit CRUD Operations - Integration Tests", () => {
  let tempDir: string;
  let dbDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "romper-kit-crud-"));
    dbDir = join(tempDir, ".romperdb");
    createRomperDbFile(dbDir);
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  describe("addKit", () => {
    test("creates a kit with 4 voices", () => {
      const result = addKit(dbDir, {
        bank_letter: "A",
        name: "A0",
      });

      expect(result.success).toBe(true);

      const kit = getKit(dbDir, "A0");
      expect(kit.success).toBe(true);
      expect(kit.data).not.toBeNull();
      expect(kit.data!.name).toBe("A0");
      expect(kit.data!.bank_letter).toBe("A");
      expect(kit.data!.voices).toHaveLength(4);
      expect(kit.data!.voices!.map((v) => v.voice_number)).toEqual([
        1, 2, 3, 4,
      ]);
    });

    test("creates a kit with optional fields", () => {
      const result = addKit(dbDir, {
        alias: "My Kit",
        bank_letter: "B",
        bpm: 140,
        editable: true,
        is_favorite: true,
        locked: false,
        name: "B3",
        step_pattern: [[1, 0, 1, 0]],
      });

      expect(result.success).toBe(true);

      const kit = getKit(dbDir, "B3");
      expect(kit.data!.alias).toBe("My Kit");
      expect(kit.data!.bpm).toBe(140);
      expect(kit.data!.editable).toBe(true);
      expect(kit.data!.is_favorite).toBe(true);
      expect(kit.data!.locked).toBe(false);
      expect(kit.data!.step_pattern).toEqual([[1, 0, 1, 0]]);
    });

    test("uses default values for optional fields", () => {
      addKit(dbDir, { bank_letter: "A", name: "A1" });

      const kit = getKit(dbDir, "A1");
      expect(kit.data!.bpm).toBe(120);
      expect(kit.data!.editable).toBe(false);
      expect(kit.data!.is_favorite).toBe(false);
      expect(kit.data!.locked).toBe(false);
      expect(kit.data!.modified_since_sync).toBe(false);
    });

    test("fails when adding duplicate kit name", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });
      const result = addKit(dbDir, { bank_letter: "A", name: "A0" });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getKit", () => {
    test("returns kit with voices and samples", () => {
      addKit(dbDir, { bank_letter: "A", editable: true, name: "A0" });
      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });

      const result = getKit(dbDir, "A0");
      expect(result.success).toBe(true);
      expect(result.data!.voices).toHaveLength(4);
      expect(result.data!.samples).toHaveLength(1);
      expect(result.data!.samples![0].filename).toBe("kick.wav");
    });

    test("returns null for non-existent kit", () => {
      const result = getKit(dbDir, "NonExistent");
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    test("returns samples ordered by voice_number then slot_number", () => {
      addKit(dbDir, { bank_letter: "A", editable: true, name: "A0" });

      // Add samples in non-sequential order
      addSample(dbDir, {
        filename: "v2s0.wav",
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/samples/v2s0.wav",
        voice_number: 2,
      });
      addSample(dbDir, {
        filename: "v1s1.wav",
        is_stereo: false,
        kit_name: "A0",
        slot_number: 1,
        source_path: "/samples/v1s1.wav",
        voice_number: 1,
      });
      addSample(dbDir, {
        filename: "v1s0.wav",
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/samples/v1s0.wav",
        voice_number: 1,
      });

      const result = getKit(dbDir, "A0");
      const sampleOrder = result.data!.samples!.map((s) => s.filename);
      expect(sampleOrder).toEqual(["v1s0.wav", "v1s1.wav", "v2s0.wav"]);
    });
  });

  describe("getKits", () => {
    test("returns empty array when no kits exist", () => {
      const result = getKits(dbDir);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    test("returns all kits with voices and samples", () => {
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

      const result = getKits(dbDir);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);

      const kitA0 = result.data!.find((k) => k.name === "A0");
      expect(kitA0!.voices).toHaveLength(4);
      expect(kitA0!.samples).toHaveLength(1);

      const kitB0 = result.data!.find((k) => k.name === "B0");
      expect(kitB0!.voices).toHaveLength(4);
      expect(kitB0!.samples).toHaveLength(0);
    });
  });

  describe("getKitsMetadata", () => {
    test("returns metadata without voices or samples", () => {
      addKit(dbDir, {
        alias: "Cool Kit",
        bank_letter: "A",
        bpm: 140,
        editable: true,
        is_favorite: true,
        name: "A0",
      });

      const result = getKitsMetadata(dbDir);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);

      const meta = result.data![0];
      expect(meta.name).toBe("A0");
      expect(meta.bank_letter).toBe("A");
      expect(meta.alias).toBe("Cool Kit");
      expect(meta.bpm).toBe(140);
      expect(meta.editable).toBe(true);
      expect(meta.is_favorite).toBe(true);
      // Metadata should not include voices or samples
      expect((meta as Record<string, unknown>).voices).toBeUndefined();
      expect((meta as Record<string, unknown>).samples).toBeUndefined();
    });

    test("returns empty array when no kits exist", () => {
      const result = getKitsMetadata(dbDir);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("updateKit", () => {
    test("updates kit bpm", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });

      const result = updateKit(dbDir, "A0", { bpm: 160 });
      expect(result.success).toBe(true);

      const kit = getKit(dbDir, "A0");
      expect(kit.data!.bpm).toBe(160);
    });

    test("updates multiple kit properties at once", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });

      updateKit(dbDir, "A0", {
        bpm: 90,
        editable: true,
        is_favorite: true,
      });

      const kit = getKit(dbDir, "A0");
      expect(kit.data!.bpm).toBe(90);
      expect(kit.data!.editable).toBe(true);
      expect(kit.data!.is_favorite).toBe(true);
    });

    test("fails when updating non-existent kit", () => {
      const result = updateKit(dbDir, "NonExistent", { bpm: 120 });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("getKitDeleteSummary", () => {
    test("returns correct counts for a kit with samples", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });
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

      const result = getKitDeleteSummary(dbDir, "A0");
      expect(result.success).toBe(true);
      expect(result.data!.kitName).toBe("A0");
      expect(result.data!.voiceCount).toBe(4);
      expect(result.data!.sampleCount).toBe(2);
      expect(result.data!.locked).toBe(false);
    });

    test("returns locked status for locked kit", () => {
      addKit(dbDir, { bank_letter: "A", locked: true, name: "A0" });

      const result = getKitDeleteSummary(dbDir, "A0");
      expect(result.success).toBe(true);
      expect(result.data!.locked).toBe(true);
    });

    test("fails for non-existent kit", () => {
      const result = getKitDeleteSummary(dbDir, "Z9");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("deleteKit", () => {
    test("deletes kit and all child records", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });
      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });

      const result = deleteKit(dbDir, "A0");
      expect(result.success).toBe(true);

      // Verify kit is gone
      const kit = getKit(dbDir, "A0");
      expect(kit.data).toBeNull();

      // Verify other kits are not affected
      const allKits = getKits(dbDir);
      expect(allKits.data).toHaveLength(0);
    });

    test("does not affect other kits", () => {
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
        filename: "bass.wav",
        is_stereo: false,
        kit_name: "B0",
        slot_number: 0,
        source_path: "/samples/bass.wav",
        voice_number: 1,
      });

      deleteKit(dbDir, "A0");

      const kitB = getKit(dbDir, "B0");
      expect(kitB.data).not.toBeNull();
      expect(kitB.data!.voices).toHaveLength(4);
      expect(kitB.data!.samples).toHaveLength(1);
    });

    test("fails for non-existent kit", () => {
      const result = deleteKit(dbDir, "Z9");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    test("deletes kit with no samples", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });

      const result = deleteKit(dbDir, "A0");
      expect(result.success).toBe(true);

      const kit = getKit(dbDir, "A0");
      expect(kit.data).toBeNull();
    });
  });
});
