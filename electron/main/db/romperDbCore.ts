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
}

export interface SampleRecord {
  kit_id: number;
  filename: string;
  voice_number: number;
  slot_number: number;
  is_stereo: boolean;
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

export function getDbSchema(): string {
  return `
    CREATE TABLE IF NOT EXISTS kits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      alias TEXT,
      artist TEXT,
      plan_enabled BOOLEAN NOT NULL DEFAULT 0,
      locked BOOLEAN NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kit_id INTEGER,
      filename TEXT NOT NULL,
      voice_number INTEGER NOT NULL CHECK(voice_number BETWEEN 1 AND 4),
      slot_number INTEGER NOT NULL CHECK(slot_number BETWEEN ${MIN_SLOT_NUMBER} AND ${MAX_SLOT_NUMBER}),
      is_stereo BOOLEAN NOT NULL DEFAULT 0,
      FOREIGN KEY(kit_id) REFERENCES kits(id)
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
    const tempDb = createDbConnection(dbPath);
    tempDb.close();
  } catch {
    // Ignore errors from temp connection
  }

  // On Windows, give extra time for file handles to be released
  if (process.platform === "win32") {
    await new Promise((resolve) => setTimeout(resolve, 200));
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
            "[Romper Electron] Successfully deleted corrupted DB file",
          );

          // Additional verification that file is gone
          if (fs.existsSync(dbPath)) {
            throw new Error("Corrupted DB file still exists after deletion");
          }
        } catch (deleteError) {
          console.error(
            "[Romper Electron] Failed to delete corrupted DB file:",
            deleteError,
          );
          return { success: false, error: msg };
        }
        continue;
      }
      return { success: false, error: msg };
    }
  }
}

async function deleteDbFileWithRetry(
  dbPath: string,
  maxRetries = 5,
): Promise<void> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
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
          const backupPath = `${dbPath}.backup.${Date.now()}.${i}`;
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
          // Wait longer on Windows and retry
          await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
        }
      } else if (i < maxRetries - 1) {
        // Wait and retry on other platforms
        await new Promise((resolve) => setTimeout(resolve, 50 * (i + 1)));
      }
    }
  }

  // Final attempt: try renaming instead of deleting
  try {
    const backupPath = `${dbPath}.backup.${Date.now()}`;
    fs.renameSync(dbPath, backupPath);
    console.log("[Romper Electron] Final rename attempt succeeded");

    // Verify original file is gone
    if (!fs.existsSync(dbPath)) {
      console.log(
        `[Romper Electron] Verified original DB file is gone after final rename`,
      );
      return;
    } else {
      throw new Error("Original file still exists after final rename");
    }
  } catch {
    console.error("[Romper Electron] All deletion/rename attempts failed");
    throw lastError || new Error("Could not delete or rename database file");
  }
}

export function insertKitRecord(
  dbDir: string,
  kit: KitRecord,
): { success: boolean; kitId?: number; error?: string } {
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
    const stmt = db.prepare(
      "INSERT INTO kits (name, alias, artist, plan_enabled, locked) VALUES (?, ?, ?, ?, ?)",
    );
    const result = stmt.run(
      kit.name,
      kit.alias || null,
      kit.artist || null,
      booleanToSqlite(kit.plan_enabled),
      booleanToSqlite(kit.locked || false),
    );

    console.log("[Romper Electron] Kit inserted, id:", result.lastInsertRowid);
    return { success: true, kitId: Number(result.lastInsertRowid) };
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

export function insertSampleRecord(
  dbDir: string,
  sample: SampleRecord,
): { success: boolean; sampleId?: number; error?: string } {
  const dbPath = getDbPath(dbDir);
  let db: BetterSqlite3.Database | null = null;

  try {
    db = createDbConnection(dbPath);
    const stmt = db.prepare(
      "INSERT INTO samples (kit_id, filename, voice_number, slot_number, is_stereo) VALUES (?, ?, ?, ?, ?)",
    );
    const result = stmt.run(
      sample.kit_id,
      sample.filename,
      sample.voice_number,
      sample.slot_number,
      booleanToSqlite(sample.is_stereo),
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
