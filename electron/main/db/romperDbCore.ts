// Core Romper DB logic for creation and record insertion (no Electron dependencies)
import BetterSqlite3 from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

export async function createRomperDbFile(dbDir: string): Promise<{
  success: boolean;
  dbPath?: string;
  error?: string;
}> {
  const dbPath = path.join(dbDir, "romper.sqlite");
  console.log(
    "[Romper Electron] createRomperDbFile called with dbDir:",
    dbDir,
    "dbPath:",
    dbPath,
  );
  let triedRecreate = false;
  for (;;) {
    try {
      fs.mkdirSync(dbDir, { recursive: true });
      let db = new BetterSqlite3(dbPath);
      console.log("[Romper Electron] Opened DB at", dbPath);
      db.exec(`
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
          slot_number INTEGER NOT NULL CHECK(slot_number BETWEEN 1 AND 12),
          is_stereo BOOLEAN NOT NULL DEFAULT 0,
          FOREIGN KEY(kit_id) REFERENCES kits(id)
        );
      `);
      db.close();
      console.log("[Romper Electron] DB created and closed at", dbPath);
      return { success: true, dbPath };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Romper Electron] Error in createRomperDbFile:", msg);
      if (
        !triedRecreate &&
        /file is not a database|file is encrypted|malformed/i.test(msg)
      ) {
        triedRecreate = true;
        try {
          // Close any existing database connections first
          try {
            // Attempt to force close by creating a new connection and immediately closing it
            const tempDb = new BetterSqlite3(dbPath);
            tempDb.close();
          } catch {
            // Ignore errors from temp connection
          }

          // Try multiple strategies for file removal on Windows
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
  kit: { name: string; alias?: string; artist?: string; plan_enabled: boolean },
): { success: boolean; kitId?: number; error?: string } {
  try {
    const dbPath = path.join(dbDir, "romper.sqlite");
    console.log(
      "[Romper Electron] insertKitRecord called with dbDir:",
      dbDir,
      "dbPath:",
      dbPath,
      "kit:",
      kit,
    );
    let db = new BetterSqlite3(dbPath);
    const stmt = db.prepare(
      "INSERT INTO kits (name, alias, artist, plan_enabled) VALUES (?, ?, ?, ?)",
    );
    const result = stmt.run(
      kit.name,
      kit.alias || null,
      kit.artist || null,
      kit.plan_enabled ? 1 : 0,
    );
    db.close();
    console.log("[Romper Electron] Kit inserted, id:", result.lastInsertRowid);
    return { success: true, kitId: Number(result.lastInsertRowid) };
  } catch (e) {
    console.error(
      "[Romper Electron] Error in insertKitRecord:",
      e instanceof Error ? e.message : String(e),
    );
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function insertSampleRecord(
  dbDir: string,
  sample: {
    kit_id: number;
    filename: string;
    slot_number: number;
    is_stereo: boolean;
  },
): { success: boolean; sampleId?: number; error?: string } {
  try {
    const dbPath = path.join(dbDir, "romper.sqlite");
    let db = new BetterSqlite3(dbPath);
    const stmt = db.prepare(
      "INSERT INTO samples (kit_id, filename, slot_number, is_stereo) VALUES (?, ?, ?, ?)",
    );
    const result = stmt.run(
      sample.kit_id,
      sample.filename,
      sample.slot_number,
      sample.is_stereo ? 1 : 0,
    );
    db.close();
    return { success: true, sampleId: Number(result.lastInsertRowid) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
