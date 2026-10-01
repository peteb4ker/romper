import BetterSqlite3 from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { KitScanIo } from "../kitScanOperations.js";

import { createRomperDbFile, DB_FILENAME } from "../../utils/dbUtilities.js";
import { addKit, getKit, updateKit } from "../kitCrudOperations.js";
import { mergeKitScan } from "../kitScanOperations.js";
import { addSample, getKitSamples } from "../sampleCrudOperations.js";
import { updateVoiceAlias } from "../voiceCrudOperations.js";

const METADATA = {
  wav_bit_depth: 16,
  wav_bitrate: 705600,
  wav_channels: 1,
  wav_sample_rate: 44100,
};

describe("[UC-13] mergeKitScan - Integration Tests", () => {
  let tempDir: string;
  let dbDir: string;
  let kitPath: string;
  let missingPaths: Set<string>;
  let io: KitScanIo;

  const folder = (voice1: string[], voice2: string[] = []) => ({
    filesByVoice: { 1: voice1, 2: voice2, 3: [], 4: [] },
    kitPath,
  });

  const samplesByPath = () =>
    new Map(
      (getKitSamples(dbDir, "A0").data ?? []).map((s) => [s.source_path, s]),
    );

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "romper-kit-scan-"));
    dbDir = join(tempDir, ".romperdb");
    kitPath = join(tempDir, "A0");
    createRomperDbFile(dbDir);
    addKit(dbDir, { bank_letter: "A", editable: false, name: "A0" });

    missingPaths = new Set();
    io = {
      fileExists: (p) => !missingPaths.has(p),
      readMetadata: () => METADATA,
    };
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  test("adds new files and keeps user rows, gain and external paths intact", () => {
    addSample(dbDir, {
      filename: "1 kick.wav",
      gain_db: -3,
      kit_name: "A0",
      slot_number: 0,
      source_path: join(kitPath, "1 kick.wav"),
      voice_number: 1,
      ...METADATA,
    });
    addSample(dbDir, {
      filename: "my clap.wav",
      gain_db: 6,
      kit_name: "A0",
      slot_number: 1,
      source_path: "/Users/me/Samples/my clap.wav",
      voice_number: 1,
      ...METADATA,
    });

    const result = mergeKitScan(
      dbDir,
      "A0",
      folder(["1 kick.wav", "1 snare.wav"]),
      io,
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      addedSamples: 1,
      locked: false,
      missingSamples: [],
      scannedSamples: 2,
      skippedFiles: [],
    });

    const rows = samplesByPath();
    expect(rows.size).toBe(3);
    expect(rows.get(join(kitPath, "1 kick.wav"))).toMatchObject({
      gain_db: -3,
      slot_number: 0,
    });
    expect(rows.get("/Users/me/Samples/my clap.wav")).toMatchObject({
      gain_db: 6,
      slot_number: 1,
      voice_number: 1,
    });
    expect(rows.get(join(kitPath, "1 snare.wav"))).toMatchObject({
      gain_db: 0,
      slot_number: 2,
      voice_number: 1,
      ...METADATA,
    });

    // New samples aren't on the card yet
    expect(getKit(dbDir, "A0").data?.modified_since_sync).toBe(true);
  });

  test("keeps and reports rows whose file has disappeared", () => {
    const gonePath = join(kitPath, "1 gone.wav");
    addSample(dbDir, {
      filename: "1 gone.wav",
      kit_name: "A0",
      slot_number: 0,
      source_path: gonePath,
      voice_number: 1,
    });
    missingPaths.add(gonePath);

    const result = mergeKitScan(dbDir, "A0", folder([]), io);

    expect(result.data?.missingSamples).toEqual([
      {
        filename: "1 gone.wav",
        slotNumber: 0,
        sourcePath: gonePath,
        voiceNumber: 1,
      },
    ]);
    expect(samplesByPath().has(gonePath)).toBe(true);
    expect(getKit(dbDir, "A0").data?.modified_since_sync).toBe(false);
  });

  test("leaves a locked kit untouched", () => {
    updateKit(dbDir, "A0", { locked: true });
    addSample(dbDir, {
      filename: "1 kick.wav",
      kit_name: "A0",
      slot_number: 0,
      source_path: join(kitPath, "1 kick.wav"),
      voice_number: 1,
    });

    const result = mergeKitScan(
      dbDir,
      "A0",
      folder(["1 kick.wav", "1 new.wav"]),
      io,
    );

    expect(result.success).toBe(true);
    expect(result.data?.locked).toBe(true);
    expect(result.data?.addedSamples).toBe(0);
    const rows = [...samplesByPath().values()];
    expect(rows).toHaveLength(1);
    // Missing metadata is not filled in either
    expect(rows[0].wav_channels).toBeNull();
    const kit = getKit(dbDir, "A0").data;
    expect(kit?.modified_since_sync).toBe(false);
    expect(kit?.voices?.every((v) => v.voice_alias === null)).toBe(true);
  });

  test("caps a voice at 12 samples", () => {
    const files = Array.from(
      { length: 14 },
      (_, i) => `1 s${String(i).padStart(2, "0")}.wav`,
    );

    const result = mergeKitScan(dbDir, "A0", folder(files), io);

    expect(result.data?.addedSamples).toBe(12);
    expect(result.data?.skippedFiles.map((f) => f.filename)).toEqual([
      "1 s12.wav",
      "1 s13.wav",
    ]);
    const slots = [...samplesByPath().values()]
      .map((s) => s.slot_number)
      .sort((a, b) => a - b);
    expect(slots).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  test("[UC-13] [UC-27] infers names only for unnamed voices", () => {
    updateVoiceAlias(dbDir, "A0", 2, "My Snares");

    mergeKitScan(dbDir, "A0", folder(["1 kick.wav"], ["2 snare.wav"]), io);

    const voices = getKit(dbDir, "A0").data?.voices ?? [];
    const alias = (n: number) =>
      voices.find((v) => v.voice_number === n)?.voice_alias;
    expect(alias(1)).toBe("Kick");
    expect(alias(2)).toBe("My Snares");
  });

  test("rolls the whole kit back when a write fails part-way", () => {
    addSample(dbDir, {
      filename: "1 kick.wav",
      kit_name: "A0",
      slot_number: 0,
      source_path: join(kitPath, "1 kick.wav"),
      voice_number: 1,
    });

    // Fail the second insert, after the metadata update and first insert ran
    const sqlite = new BetterSqlite3(join(dbDir, DB_FILENAME));
    sqlite.exec(`
      CREATE TRIGGER fail_scan_insert BEFORE INSERT ON samples
      WHEN NEW.filename = '1 zz boom.wav'
      BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END;
    `);
    sqlite.close();

    const result = mergeKitScan(
      dbDir,
      "A0",
      folder(["1 a new.wav", "1 kick.wav", "1 zz boom.wav"]),
      io,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("simulated write failure");

    const rows = [...samplesByPath().values()];
    expect(rows.map((r) => r.filename)).toEqual(["1 kick.wav"]);
    expect(rows[0].wav_channels).toBeNull();
    const kit = getKit(dbDir, "A0").data;
    expect(kit?.modified_since_sync).toBe(false);
    expect(kit?.voices?.every((v) => v.voice_alias === null)).toBe(true);
  });

  test("fails without changes when the kit is not in the database", () => {
    const result = mergeKitScan(dbDir, "Z9", folder(["1 kick.wav"]), io);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Kit not found");
  });
});
