// Core Romper DB logic for creation and record insertion (no Electron dependencies)
import BetterSqlite3 from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

import {
  DbResult,
  KitRecord,
  KitWithVoices,
  SampleRecord,
  VoiceRecord,
} from "../../../shared/dbTypesShared";
import { deleteDbFileWithRetry } from "./fileOperations";
import {
  encodeStepPatternToBlob,
  decodeStepPatternFromBlob,
} from "./stepPatternUtils";

// Re-export step pattern utilities for backward compatibility
export { encodeStepPatternToBlob, decodeStepPatternFromBlob };

// Constants
export const DB_FILENAME = "romper.sqlite";
export const MAX_SLOT_NUMBER = 12;
export const MIN_SLOT_NUMBER = 1;

// Logging utilities
const log = {
  info: (message: string, ...args: any[]) =>
    console.log(`[Romper Electron] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[Romper Electron] ${message}`, ...args),
};

/**
 * Utility function to convert JS boolean to SQLite integer (0/1) for database operations
 * SQLite doesn't support direct boolean binding
 */
function boolToSqliteInt(value: boolean | undefined | null): number {
  if (value === undefined || value === null) {
    return 0;
  }
  return value ? 1 : 0;
}

/**
 * Wraps database operations with connection handling and error handling
 * @param dbDir - The directory containing the database
 * @param operation - The operation to perform on the database
 * @returns A result containing the operation result or an error
 */
function withDb<T>(
  dbDir: string,
  operation: (db: BetterSqlite3.Database) => T,
): DbResult<T> {
  const dbPath = getDbPath(dbDir);
  let db: BetterSqlite3.Database | null = null;

  try {
    db = createDbConnection(dbPath);
    const result = operation(db);
    return { success: true, data: result };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Utility functions
export function getDbPath(dbDir: string): string {
  return path.join(dbDir, DB_FILENAME);
}

export function isDbCorruptionError(error: string): boolean {
  return /file is not a database|file is encrypted|malformed/i.test(error);
}

export function getDbSchema(): string {
  return `
    CREATE TABLE IF NOT EXISTS kits (
      name TEXT PRIMARY KEY,
      alias TEXT,
      artist TEXT,
      plan_enabled BOOLEAN NOT NULL DEFAULT 0,
      locked BOOLEAN NOT NULL DEFAULT 0,
      step_pattern BLOB
    );
    CREATE TABLE IF NOT EXISTS voices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kit_name TEXT NOT NULL,
      voice_number INTEGER NOT NULL CHECK(voice_number BETWEEN 1 AND 4),
      voice_alias TEXT,
      FOREIGN KEY(kit_name) REFERENCES kits(name),
      UNIQUE(kit_name, voice_number)
    );
    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kit_name TEXT,
      filename TEXT NOT NULL,
      voice_number INTEGER NOT NULL CHECK(voice_number BETWEEN 1 AND 4),
      slot_number INTEGER NOT NULL CHECK(slot_number BETWEEN ${MIN_SLOT_NUMBER} AND ${MAX_SLOT_NUMBER}),
      is_stereo BOOLEAN NOT NULL DEFAULT 0,
      wav_bitrate INTEGER,
      wav_sample_rate INTEGER,
      FOREIGN KEY(kit_name) REFERENCES kits(name)
    );
  `;
}

// Core database operations
export function createDbConnection(dbPath: string): BetterSqlite3.Database {
  return new BetterSqlite3(dbPath);
}

export function setupDbSchema(db: BetterSqlite3.Database): void {
  db.exec(getDbSchema());
}

export function ensureDbDirectory(dbDir: string): void {
  fs.mkdirSync(dbDir, { recursive: true });
}

export async function forceCloseDbConnection(dbPath: string): Promise<void> {
  try {
    // Try to open and immediately close to flush any pending operations
    const tempDb = createDbConnection(dbPath);
    tempDb.close();
  } catch {
    // Ignore errors from temp connection
  }

  // On Windows, SQLite files can remain locked longer due to antivirus/file system delays
  if (process.platform === "win32") {
    // Use multiple strategies to ensure file handles are released
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Increased wait time

    // Force garbage collection if available to help release file handles
    if (global.gc) {
      global.gc();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Additional Windows-specific delay for antivirus scanning
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export async function createRomperDbFile(dbDir: string): Promise<{
  success: boolean;
  dbPath?: string;
  error?: string;
}> {
  const dbPath = getDbPath(dbDir);
  log.info("createRomperDbFile called with dbDir:", dbDir, "dbPath:", dbPath);

  let triedRecreate = false;

  for (;;) {
    try {
      ensureDbDirectory(dbDir);
      const db = createDbConnection(dbPath);
      log.info("Opened DB at", dbPath);

      setupDbSchema(db);
      db.close();

      log.info("DB created and closed at", dbPath);
      return { success: true, dbPath };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error("Error in createRomperDbFile:", msg);

      if (!triedRecreate && isDbCorruptionError(msg)) {
        triedRecreate = true;
        log.info("DB corruption detected, attempting to recreate...");
        try {
          await forceCloseDbConnection(dbPath);
          await deleteDbFileWithRetry(dbPath);
          log.info("Successfully handled corrupted DB file");
        } catch (deleteError) {
          log.error("Failed to delete corrupted DB file:", deleteError);
          // On Windows, if we can't delete the file, we might still be able to recreate
          if (process.platform === "win32") {
            log.info(
              "Attempting to continue despite deletion failure on Windows",
            );
            // Try to continue anyway - sometimes SQLite can overwrite the file
          } else {
            return { success: false, error: msg };
          }
        }
        continue;
      }
      return { success: false, error: msg };
    }
  }
}


export function insertKitRecord(
  dbDir: string,
  kit: KitRecord,
): { success: boolean; error?: string } {
  log.info("insertKitRecord called with kit:", kit.name);

  return withDb(dbDir, (db) => {
    const kitStmt = db.prepare(
      "INSERT INTO kits (name, alias, artist, plan_enabled, locked, step_pattern) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const stepPatternBlob = encodeStepPatternToBlob(kit.step_pattern);
    kitStmt.run(
      kit.name,
      kit.alias || null,
      kit.artist || null,
      boolToSqliteInt(kit.plan_enabled),
      boolToSqliteInt(kit.locked || false),
      stepPatternBlob,
    );

    log.info("Kit inserted:", kit.name);

    // Create exactly 4 voice records for this kit
    const voiceStmt = db.prepare(
      "INSERT INTO voices (kit_name, voice_number, voice_alias) VALUES (?, ?, ?)",
    );

    for (let voiceNumber = 1; voiceNumber <= 4; voiceNumber++) {
      voiceStmt.run(kit.name, voiceNumber, null);
    }

    log.info("Created 4 voice records for kit:", kit.name);
    return { success: true };
  });
}

export function updateVoiceAlias(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  voiceAlias: string | null,
): DbResult<void> {
  return withDb<void>(dbDir, (db) => {
    const stmt = db.prepare(
      "UPDATE voices SET voice_alias = ? WHERE kit_name = ? AND voice_number = ?",
    );
    const result = stmt.run(voiceAlias, kitName, voiceNumber);

    if (result.changes === 0) {
      throw new Error("Voice not found");
    }

    log.info("Voice alias updated");
  });
}

export function updateStepPattern(
  dbDir: string,
  kitName: string,
  stepPattern: number[][] | undefined,
): DbResult<void> {
  return withDb<void>(dbDir, (db) => {
    const stmt = db.prepare("UPDATE kits SET step_pattern = ? WHERE name = ?");
    const stepPatternBlob = encodeStepPatternToBlob(stepPattern);
    const result = stmt.run(stepPatternBlob, kitName);

    if (result.changes === 0) {
      throw new Error("Kit not found");
    }

    log.info("Step pattern updated");
    return { success: true };
  });
}

export function insertSampleRecord(
  dbDir: string,
  sample: SampleRecord,
): DbResult<{ sampleId: number }> {
  return withDb<{ sampleId: number }>(dbDir, (db) => {
    const stmt = db.prepare(
      "INSERT INTO samples (kit_name, filename, voice_number, slot_number, is_stereo, wav_bitrate, wav_sample_rate) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const result = stmt.run(
      sample.kit_name,
      sample.filename,
      sample.voice_number,
      sample.slot_number,
      boolToSqliteInt(sample.is_stereo),
      sample.wav_bitrate || null,
      sample.wav_sample_rate || null,
    );

    return { sampleId: Number(result.lastInsertRowid) };
  });
}

/**
 * Maps a raw database row to a typed SampleRecord object
 * @param row - The database row representing a sample
 * @returns A properly typed SampleRecord object
 */
export function mapToSampleRecord(row: any): SampleRecord {
  return {
    kit_name: row.kit_name,
    filename: row.filename,
    voice_number: row.voice_number,
    slot_number: row.slot_number,
    is_stereo: Boolean(row.is_stereo),
    wav_bitrate: row.wav_bitrate,
    wav_sample_rate: row.wav_sample_rate,
  };
}

/**
 * Maps raw database rows to a typed KitWithVoices object
 * @param kitRow - The database row representing a kit
 * @param voiceRows - The database rows representing voices for this kit
 * @returns A properly typed KitWithVoices object
 */
export function mapToKitWithVoices(
  kitRow: any,
  voiceRows: any[],
): KitWithVoices {
  // Create voice map (voice_number -> voice_alias)
  const voices: { [voiceNumber: number]: string } = {};

  // Add all voice aliases from the voiceRows
  for (const voiceRow of voiceRows) {
    if (voiceRow.voice_number && voiceRow.voice_alias) {
      voices[voiceRow.voice_number] = voiceRow.voice_alias;
    }
  }

  return {
    name: kitRow.name,
    alias: kitRow.alias,
    artist: kitRow.artist,
    plan_enabled: Boolean(kitRow.plan_enabled),
    locked: Boolean(kitRow.locked),
    step_pattern: kitRow.step_pattern
      ? decodeStepPatternFromBlob(kitRow.step_pattern)
      : undefined,
    voices,
  };
}

// Query functions
export function getKitByName(
  dbDir: string,
  kitName: string,
): DbResult<KitWithVoices> {
  return withDb<KitWithVoices>(dbDir, (db) => {
    const kitStmt = db.prepare("SELECT * FROM kits WHERE name = ?");
    const kitRow = kitStmt.get(kitName) as any;

    if (!kitRow) {
      throw new Error("Kit not found");
    }

    const voiceStmt = db.prepare(
      "SELECT voice_number, voice_alias FROM voices WHERE kit_name = ?",
    );
    const voiceRows = voiceStmt.all(kitName) as any[];

    return mapToKitWithVoices(kitRow, voiceRows);
  });
}

export function updateKitMetadata(
  dbDir: string,
  kitName: string,
  updates: {
    alias?: string;
    artist?: string;
    tags?: string[];
    description?: string;
  },
): DbResult {
  return withDb<void>(dbDir, (db) => {
    // Build dynamic update query
    const setParts: string[] = [];
    const values: any[] = [];

    if (updates.alias !== undefined) {
      setParts.push("alias = ?");
      values.push(updates.alias);
    }
    if (updates.artist !== undefined) {
      setParts.push("artist = ?");
      values.push(updates.artist);
    }

    if (setParts.length === 0) {
      return; // No updates to make
    }

    values.push(kitName); // WHERE clause parameter

    const sql = `UPDATE kits SET ${setParts.join(", ")} WHERE name = ?`;
    const stmt = db.prepare(sql);
    const result = stmt.run(...values);

    if (result.changes === 0) {
      throw new Error("Kit not found");
    }
  });
}

export function getAllKits(dbDir: string): DbResult<KitWithVoices[]> {
  return withDb<KitWithVoices[]>(dbDir, (db) => {
    const kitStmt = db.prepare("SELECT * FROM kits ORDER BY name");
    const kitRows = kitStmt.all() as any[];

    const kits: KitWithVoices[] = [];

    for (const kitRow of kitRows) {
      // Get voice aliases for this kit
      const voiceStmt = db.prepare(
        "SELECT voice_number, voice_alias FROM voices WHERE kit_name = ?",
      );
      const voiceRows = voiceStmt.all(kitRow.name) as any[];

      const kit: KitWithVoices = mapToKitWithVoices(kitRow, voiceRows);

      kits.push(kit);
    }

    return kits;
  });
}

/**
 * Gets samples from the database with optional kit filtering.
 * @param dbDir - The directory containing the Romper database
 * @param kitName - Optional kit name to filter by. If not provided, returns all samples.
 * @returns A result containing an array of sample records if successful
 */
function getSamples(
  dbDir: string,
  kitName?: string,
): DbResult<SampleRecord[]> {
  return withDb<SampleRecord[]>(dbDir, (db) => {
    const sql = kitName
      ? "SELECT * FROM samples WHERE kit_name = ? ORDER BY voice_number, slot_number"
      : "SELECT * FROM samples ORDER BY kit_name, voice_number, slot_number";

    const sampleStmt = db.prepare(sql);
    const sampleRows = kitName
      ? sampleStmt.all(kitName) as any[]
      : sampleStmt.all() as any[];

    return sampleRows.map(mapToSampleRecord);
  });
}

/**
 * Gets all samples for a specific kit.
 */
export function getAllSamplesForKit(
  dbDir: string,
  kitName: string,
): DbResult<SampleRecord[]> {
  return getSamples(dbDir, kitName);
}

/**
 * Gets all samples from the database.
 */
export function getAllSamples(dbDir: string): DbResult<SampleRecord[]> {
  return getSamples(dbDir);
}

/**
 * Deletes all sample records for a specific kit.
 * Used during rescanning to clear existing samples before inserting current ones.
 */
export function deleteAllSamplesForKit(
  dbDir: string,
  kitName: string,
): DbResult<void> {
  return withDb<void>(dbDir, (db) => {
    const stmt = db.prepare("DELETE FROM samples WHERE kit_name = ?");
    const result = stmt.run(kitName);

    log.info(`Deleted ${result.changes} sample records for kit: ${kitName}`);
  });
}

/**
 * Rescans a kit by updating the database to match the current filesystem state.
 * This function:
 * 1. Deletes all existing sample records for the kit
 * 2. Scans the kit directory for current WAV files
 * 3. Inserts new sample records for found files
 * 4. Updates voice aliases based on file analysis
 */
export function rescanKitFromFilesystem(
  dbDir: string,
  localStorePath: string,
  kitName: string,
): DbResult<{ scannedSamples: number; updatedVoices: number }> {
  return withDb<{ scannedSamples: number; updatedVoices: number }>(dbDir, (db) => {
    // Step 1: Delete all existing samples for this kit
    const deleteStmt = db.prepare("DELETE FROM samples WHERE kit_name = ?");
    const deleteResult = deleteStmt.run(kitName);
    log.info(`Deleted ${deleteResult.changes} existing sample records for kit: ${kitName}`);

    // Step 2: Scan kit directory for current WAV files
    const kitPath = path.join(localStorePath, kitName);
    if (!fs.existsSync(kitPath)) {
      throw new Error(`Kit directory not found: ${kitPath}`);
    }

    let scannedSamples = 0;
    const files = fs.readdirSync(kitPath);
    const wavFiles = files.filter(file => file.toLowerCase().endsWith('.wav'));

    // Group files by voice (based on voice folder or naming convention)
    const samplesByVoice: { [voice: number]: string[] } = { 1: [], 2: [], 3: [], 4: [] };

    for (const wavFile of wavFiles) {
      // Try to determine voice from subdirectory structure first
      let voice = 1; // default voice

      // Check if the file is in a voice subdirectory (1/, 2/, 3/, 4/)
      const filePath = path.join(kitPath, wavFile);
      const relativePath = path.relative(kitPath, filePath);
      const pathParts = relativePath.split(path.sep);

      if (pathParts.length > 1) {
        const voiceDir = pathParts[0];
        const voiceMatch = voiceDir.match(/^([1-4])$/);
        if (voiceMatch) {
          voice = parseInt(voiceMatch[1]);
        }
      }

      // If no voice subdirectory, try to infer from filename
      if (voice === 1 && pathParts.length === 1) {
        // Simple heuristic: distribute files across voices by index
        const index = scannedSamples % 4;
        voice = index + 1;
      }

      samplesByVoice[voice].push(wavFile);
    }

    // Step 3: Insert new sample records
    const insertStmt = db.prepare(
      "INSERT INTO samples (kit_name, filename, voice_number, slot_number, is_stereo) VALUES (?, ?, ?, ?, ?)"
    );

    for (let voiceNum = 1; voiceNum <= 4; voiceNum++) {
      const voiceFiles = samplesByVoice[voiceNum];
      voiceFiles.forEach((filename, index) => {
        const slotNumber = index + 1; // 1-indexed slots
        if (slotNumber <= MAX_SLOT_NUMBER) {
          // Simple stereo detection based on filename
          const isStereo = filename.toLowerCase().includes('stereo') ||
                          filename.toLowerCase().includes('_s.wav') ||
                          filename.toLowerCase().includes('_st.wav');

          insertStmt.run(kitName, filename, voiceNum, slotNumber, boolToSqliteInt(isStereo));
          scannedSamples++;
        }
      });
    }

    log.info(`Inserted ${scannedSamples} new sample records for kit: ${kitName}`);

    // Step 4: Update voice aliases based on filenames (simple inference)
    let updatedVoices = 0;
    const voiceUpdateStmt = db.prepare(
      "UPDATE voices SET voice_alias = ? WHERE kit_name = ? AND voice_number = ?"
    );

    for (let voiceNum = 1; voiceNum <= 4; voiceNum++) {
      const voiceFiles = samplesByVoice[voiceNum];
      if (voiceFiles.length > 0) {
        // Simple voice name inference from first filename
        const firstFile = voiceFiles[0].toLowerCase();
        let voiceAlias = null;

        if (firstFile.includes('kick') || firstFile.includes('bd')) voiceAlias = 'Kick';
        else if (firstFile.includes('snare') || firstFile.includes('sd')) voiceAlias = 'Snare';
        else if (firstFile.includes('hihat') || firstFile.includes('hh')) voiceAlias = 'HH';
        else if (firstFile.includes('clap') || firstFile.includes('cp')) voiceAlias = 'Clap';
        else if (firstFile.includes('crash') || firstFile.includes('cy')) voiceAlias = 'Crash';
        else if (firstFile.includes('ride')) voiceAlias = 'Ride';
        else if (firstFile.includes('tom')) voiceAlias = 'Tom';
        else if (firstFile.includes('perc')) voiceAlias = 'Perc';

        if (voiceAlias) {
          const result = voiceUpdateStmt.run(voiceAlias, kitName, voiceNum);
          if (result.changes > 0) {
            updatedVoices++;
            log.info(`Updated voice ${voiceNum} alias to: ${voiceAlias}`);
          }
        }
      }
    }

    return { scannedSamples, updatedVoices };
  });
}
