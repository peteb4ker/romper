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
}

export interface SampleRecord {
  kit_id: number;
  filename: string;
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
      plan_enabled BOOLEAN NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kit_id INTEGER,
      filename TEXT NOT NULL,
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
        try {
          await forceCloseDbConnection(dbPath);
          await deleteDbFileWithRetry(dbPath);
        } catch (deleteError) {
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
      return;
    } catch (error) {
      lastError = error as Error;

      // If deletion fails, try renaming first (common Windows issue)
      if (process.platform === "win32" && i < maxRetries - 1) {
        try {
          const backupPath = `${dbPath}.backup.${Date.now()}.${i}`;
          fs.renameSync(dbPath, backupPath);
          return;
        } catch (renameError) {
          // Wait and retry
          await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
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
  } catch {
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
      "INSERT INTO kits (name, alias, artist, plan_enabled) VALUES (?, ?, ?, ?)",
    );
    const result = stmt.run(
      kit.name,
      kit.alias || null,
      kit.artist || null,
      booleanToSqlite(kit.plan_enabled),
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
      "INSERT INTO samples (kit_id, filename, slot_number, is_stereo) VALUES (?, ?, ?, ?)",
    );
    const result = stmt.run(
      sample.kit_id,
      sample.filename,
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
