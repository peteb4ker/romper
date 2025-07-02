// Core Romper DB logic for creation and record insertion (no Electron dependencies)
import BetterSqlite3 from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

// Types
export interface DbResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface KitRecord {
  name: string;
  alias?: string;
  artist?: string;
  plan_enabled: boolean;
  locked?: boolean;
  step_pattern?: number[][];
}

export interface VoiceRecord {
  kit_name: string;
  voice_number: number;
  voice_alias?: string;
}

export interface SampleRecord {
  kit_name: string;
  filename: string;
  voice_number: number;
  slot_number: number;
  is_stereo: boolean;
  wav_bitrate?: number;
  wav_sample_rate?: number;
}

// Constants
export const DB_FILENAME = "romper.sqlite";
export const MAX_SLOT_NUMBER = 12;
export const MIN_SLOT_NUMBER = 1;

// Utility functions
export function getDbPath(dbDir: string): string {
  return path.join(dbDir, DB_FILENAME);
}

export function booleanToSqlite(value: boolean): number {
  return value ? 1 : 0;
}

export function isDbCorruptionError(error: string): boolean {
  return /file is not a database|file is encrypted|malformed/i.test(error);
}

// Step pattern encoding/decoding utilities for BLOB storage
// Each step pattern is stored as 64 bytes (16 steps x 4 voices)
// Each byte represents velocity (0-127) for that step/voice combination
// Layout: [step0_voice0, step0_voice1, step0_voice2, step0_voice3, step1_voice0, step1_voice1, ...]
export function encodeStepPatternToBlob(
  stepPattern: number[][] | null | undefined,
): Uint8Array | null {
  if (!stepPattern || stepPattern.length === 0) {
    return null;
  }

  // Create a 64-byte array (16 steps x 4 voices)
  const blob = new Uint8Array(64);

  for (let step = 0; step < 16; step++) {
    for (let voice = 0; voice < 4; voice++) {
      const index = step * 4 + voice;
      const velocity = stepPattern[voice]?.[step] || 0;
      // Ensure velocity is within valid range (0-127)
      blob[index] = Math.max(0, Math.min(127, velocity));
    }
  }

  return blob;
}

export function decodeStepPatternFromBlob(
  blob: Uint8Array | null,
): number[][] | null {
  if (!blob || blob.length !== 64) {
    return null;
  }

  // Create 4 voices x 16 steps pattern
  const stepPattern: number[][] = [[], [], [], []];

  for (let step = 0; step < 16; step++) {
    for (let voice = 0; voice < 4; voice++) {
      const index = step * 4 + voice;
      stepPattern[voice][step] = blob[index];
    }
  }

  return stepPattern;
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
  console.log(
    "[Romper Electron] createRomperDbFile called with dbDir:",
    dbDir,
    "dbPath:",
    dbPath,
  );

  let triedRecreate = false;

  for (;;) {
    try {
      ensureDbDirectory(dbDir);
      const db = createDbConnection(dbPath);
      console.log("[Romper Electron] Opened DB at", dbPath);

      setupDbSchema(db);
      db.close();

      console.log("[Romper Electron] DB created and closed at", dbPath);
      return { success: true, dbPath };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Romper Electron] Error in createRomperDbFile:", msg);

      if (!triedRecreate && isDbCorruptionError(msg)) {
        triedRecreate = true;
        console.log(
          "[Romper Electron] DB corruption detected, attempting to recreate...",
        );
        try {
          await forceCloseDbConnection(dbPath);
          await deleteDbFileWithRetry(dbPath);
          console.log(
            "[Romper Electron] Successfully handled corrupted DB file",
          );
        } catch (deleteError) {
          console.error(
            "[Romper Electron] Failed to delete corrupted DB file:",
            deleteError,
          );
          // On Windows, if we can't delete the file, we might still be able to recreate
          if (process.platform === "win32") {
            console.log(
              "[Romper Electron] Attempting to continue despite deletion failure on Windows",
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

async function deleteDbFileWithRetry(
  dbPath: string,
  maxRetries = 15, // Increase retries significantly for Windows
): Promise<void> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // On Windows, try unlinking after progressively longer delays
      if (process.platform === "win32" && i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200 * i));
      }

      fs.unlinkSync(dbPath);
      console.log(
        `[Romper Electron] Successfully deleted DB file on attempt ${i + 1}`,
      );

      // Verify file is actually gone
      if (!fs.existsSync(dbPath)) {
        console.log(`[Romper Electron] Verified DB file is deleted`);
        return;
      } else {
        console.log(
          `[Romper Electron] File still exists after deletion, retrying...`,
        );
        throw new Error("File still exists after deletion");
      }
    } catch (error) {
      lastError = error as Error;
      console.log(
        `[Romper Electron] Delete attempt ${i + 1} failed:`,
        lastError.message,
      );

      // If deletion fails, try renaming first (common Windows issue)
      if (process.platform === "win32" && i < maxRetries - 1) {
        try {
          const backupPath = `${dbPath}.corrupted.${Date.now()}.${i}`;
          fs.renameSync(dbPath, backupPath);
          console.log(
            `[Romper Electron] Successfully renamed DB file to backup on attempt ${i + 1}`,
          );

          // Verify original file is gone
          if (!fs.existsSync(dbPath)) {
            console.log(
              `[Romper Electron] Verified original DB file is gone after rename`,
            );
            return;
          } else {
            console.log(
              `[Romper Electron] Original file still exists after rename, retrying...`,
            );
            throw new Error("Original file still exists after rename");
          }
        } catch (renameError) {
          console.log(
            `[Romper Electron] Rename attempt ${i + 1} failed, waiting...`,
          );
          // Wait progressively longer on Windows
          await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
        }
      } else if (i < maxRetries - 1) {
        // Wait and retry on other platforms
        await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
      }
    }
  }

  // On Windows, as a last resort, just rename the file to get it out of the way
  // This allows the database creation to proceed even if we can't delete the old file
  if (process.platform === "win32") {
    try {
      const timestamp = Date.now();
      const backupPath = `${dbPath}.locked.${timestamp}`;
      fs.renameSync(dbPath, backupPath);
      console.log("[Romper Electron] Final rename attempt succeeded");

      // Verify original file is gone
      if (!fs.existsSync(dbPath)) {
        console.log(
          `[Romper Electron] Verified original DB file is gone after final rename`,
        );
        return;
      }
    } catch {
      // If even rename fails, we'll have to proceed anyway
      console.error(
        "[Romper Electron] All deletion/rename attempts failed, proceeding anyway",
      );
      // On Windows, sometimes we just have to accept that the file is locked
      // and try to overwrite it directly
      return;
    }
  }

  throw lastError || new Error("Could not delete or rename database file");
}

export function insertKitRecord(
  dbDir: string,
  kit: KitRecord,
): { success: boolean; error?: string } {
  const dbPath = getDbPath(dbDir);
  console.log(
    "[Romper Electron] insertKitRecord called with dbDir:",
    dbDir,
    "dbPath:",
    dbPath,
    "kit:",
    kit,
  );

  let db: BetterSqlite3.Database | null = null;
  try {
    db = createDbConnection(dbPath);

    // Insert the kit
    const kitStmt = db.prepare(
      "INSERT INTO kits (name, alias, artist, plan_enabled, locked, step_pattern) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const stepPatternBlob = encodeStepPatternToBlob(kit.step_pattern);
    const kitResult = kitStmt.run(
      kit.name,
      kit.alias || null,
      kit.artist || null,
      booleanToSqlite(kit.plan_enabled),
      booleanToSqlite(kit.locked || false),
      stepPatternBlob,
    );

    console.log("[Romper Electron] Kit inserted:", kit.name);

    // Create exactly 4 voice records for this kit
    const voiceStmt = db.prepare(
      "INSERT INTO voices (kit_name, voice_number, voice_alias) VALUES (?, ?, ?)",
    );

    for (let voiceNumber = 1; voiceNumber <= 4; voiceNumber++) {
      voiceStmt.run(kit.name, voiceNumber, null);
    }

    console.log("[Romper Electron] Created 4 voice records for kit:", kit.name);
    return { success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[Romper Electron] Error in insertKitRecord:", error);
    return { success: false, error };
  } finally {
    if (db) {
      db.close();
    }
  }
}

export function updateVoiceAlias(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  voiceAlias: string | null,
): { success: boolean; error?: string } {
  const dbPath = getDbPath(dbDir);
  console.log(
    "[Romper Electron] updateVoiceAlias to:",
    dbPath,
    "kitName:",
    kitName,
    "voiceNumber:",
    voiceNumber,
    "alias:",
    voiceAlias,
  );

  let db: BetterSqlite3.Database | null = null;
  try {
    db = createDbConnection(dbPath);
    const stmt = db.prepare(
      "UPDATE voices SET voice_alias = ? WHERE kit_name = ? AND voice_number = ?",
    );
    const result = stmt.run(voiceAlias, kitName, voiceNumber);

    if (result.changes === 0) {
      return { success: false, error: "Voice not found" };
    }

    console.log("[Romper Electron] Voice alias updated");
    return { success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[Romper Electron] Error in updateVoiceAlias:", error);
    return { success: false, error };
  } finally {
    if (db) {
      db.close();
    }
  }
}

export function updateStepPattern(
  dbDir: string,
  kitName: string,
  stepPattern: number[][] | null,
): { success: boolean; error?: string } {
  const dbPath = getDbPath(dbDir);
  console.log(
    "[Romper Electron] updateStepPattern to:",
    dbPath,
    "kitName:",
    kitName,
    "pattern:",
    stepPattern,
  );

  let db: BetterSqlite3.Database | null = null;
  try {
    db = createDbConnection(dbPath);
    const stmt = db.prepare("UPDATE kits SET step_pattern = ? WHERE name = ?");
    const stepPatternBlob = encodeStepPatternToBlob(stepPattern);
    const result = stmt.run(stepPatternBlob, kitName);

    if (result.changes === 0) {
      return { success: false, error: "Kit not found" };
    }

    console.log("[Romper Electron] Step pattern updated");
    return { success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[Romper Electron] Error in updateStepPattern:", error);
    return { success: false, error };
  } finally {
    if (db) {
      db.close();
    }
  }
}

export function insertSampleRecord(
  dbDir: string,
  sample: SampleRecord,
): { success: boolean; sampleId?: number; error?: string } {
  const dbPath = getDbPath(dbDir);
  let db: BetterSqlite3.Database | null = null;

  try {
    db = createDbConnection(dbPath);
    const stmt = db.prepare(
      "INSERT INTO samples (kit_name, filename, voice_number, slot_number, is_stereo, wav_bitrate, wav_sample_rate) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const result = stmt.run(
      sample.kit_name,
      sample.filename,
      sample.voice_number,
      sample.slot_number,
      booleanToSqlite(sample.is_stereo),
      sample.wav_bitrate || null,
      sample.wav_sample_rate || null,
    );

    return { success: true, sampleId: Number(result.lastInsertRowid) };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Query functions
export interface KitWithVoices {
  name: string;
  alias?: string;
  artist?: string;
  plan_enabled: boolean;
  locked: boolean;
  step_pattern?: number[][];
  voices: { [voiceNumber: number]: string };
}

export function getKitByName(
  dbDir: string,
  kitName: string,
): DbResult<KitWithVoices> {
  const dbPath = getDbPath(dbDir);
  let db: BetterSqlite3.Database | null = null;

  try {
    db = createDbConnection(dbPath);

    // Get kit record
    const kitStmt = db.prepare("SELECT * FROM kits WHERE name = ?");
    const kitRow = kitStmt.get(kitName) as any;

    if (!kitRow) {
      return { success: false, error: "Kit not found" };
    }

    // Get voice aliases
    const voiceStmt = db.prepare(
      "SELECT voice_number, voice_alias FROM voices WHERE kit_name = ?",
    );
    const voiceRows = voiceStmt.all(kitName) as any[];

    const voices: { [voiceNumber: number]: string } = {};
    for (const voice of voiceRows) {
      voices[voice.voice_number] = voice.voice_alias || "";
    }

    // Ensure all 4 voices exist
    for (let i = 1; i <= 4; i++) {
      if (!(i in voices)) {
        voices[i] = "";
      }
    }

    const kit: KitWithVoices = {
      name: kitRow.name,
      alias: kitRow.alias,
      artist: kitRow.artist,
      plan_enabled: Boolean(kitRow.plan_enabled),
      locked: Boolean(kitRow.locked),
      step_pattern: kitRow.step_pattern
        ? decodeStepPatternFromBlob(new Uint8Array(kitRow.step_pattern)) ||
          undefined
        : undefined,
      voices,
    };

    return { success: true, data: kit };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  } finally {
    if (db) {
      db.close();
    }
  }
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
  const dbPath = getDbPath(dbDir);
  let db: BetterSqlite3.Database | null = null;

  try {
    db = createDbConnection(dbPath);

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
      return { success: true }; // No updates to make
    }

    values.push(kitName); // WHERE clause parameter

    const sql = `UPDATE kits SET ${setParts.join(", ")} WHERE name = ?`;
    const stmt = db.prepare(sql);
    const result = stmt.run(...values);

    if (result.changes === 0) {
      return { success: false, error: "Kit not found" };
    }

    return { success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  } finally {
    if (db) {
      db.close();
    }
  }
}

export function getAllKits(dbDir: string): DbResult<KitWithVoices[]> {
  const dbPath = getDbPath(dbDir);
  let db: BetterSqlite3.Database | null = null;

  try {
    db = createDbConnection(dbPath);

    // Get all kits
    const kitStmt = db.prepare("SELECT * FROM kits ORDER BY name");
    const kitRows = kitStmt.all() as any[];

    const kits: KitWithVoices[] = [];

    for (const kitRow of kitRows) {
      // Get voice aliases for this kit
      const voiceStmt = db.prepare(
        "SELECT voice_number, voice_alias FROM voices WHERE kit_name = ?",
      );
      const voiceRows = voiceStmt.all(kitRow.name) as any[];

      const voices: { [voiceNumber: number]: string } = {};
      for (const voice of voiceRows) {
        voices[voice.voice_number] = voice.voice_alias || "";
      }

      // Ensure all 4 voices exist
      for (let i = 1; i <= 4; i++) {
        if (!(i in voices)) {
          voices[i] = "";
        }
      }

      const kit: KitWithVoices = {
        name: kitRow.name,
        alias: kitRow.alias,
        artist: kitRow.artist,
        plan_enabled: Boolean(kitRow.plan_enabled),
        locked: Boolean(kitRow.locked),
        step_pattern: kitRow.step_pattern
          ? decodeStepPatternFromBlob(new Uint8Array(kitRow.step_pattern)) ||
            undefined
          : undefined,
        voices,
      };

      kits.push(kit);
    }

    return { success: true, data: kits };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  } finally {
    if (db) {
      db.close();
    }
  }
}
