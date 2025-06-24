import BetterSqlite3 from "better-sqlite3";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createRomperDbFile,
  insertKitRecord,
  insertSampleRecord,
} from "../romperDbCore";

// Track open database connections to ensure proper cleanup
const openConnections = new Set<BetterSqlite3.Database>();

function createDb(dbPath: string): BetterSqlite3.Database {
  const db = new BetterSqlite3(dbPath);
  openConnections.add(db);
  return db;
}

function closeDb(db: BetterSqlite3.Database): void {
  try {
    db.close();
  } catch (e) {
    // Ignore errors on close
  }
  openConnections.delete(db);
}

function closeAllConnections(): void {
  for (const db of openConnections) {
    try {
      db.close();
    } catch (e) {
      // Ignore errors on close
    }
  }
  openConnections.clear();
}

async function cleanupWithRetry(
  sandboxDir: string,
  maxRetries = 5,
): Promise<void> {
  closeAllConnections();

  // Give Windows time to release file locks
  if (process.platform === "win32") {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(sandboxDir)) {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
      }
      return;
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        // Wait longer on Windows for file locks to be released
        const delay =
          process.platform === "win32" ? 200 * (i + 1) : 50 * (i + 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // If we still can't delete, try to rename the directory instead
  if (lastError && process.platform === "win32") {
    try {
      const backupDir = `${sandboxDir}.backup.${Date.now()}`;
      fs.renameSync(sandboxDir, backupDir);
      console.warn(`Could not delete test directory, renamed to: ${backupDir}`);
    } catch (renameError) {
      console.warn(
        `Could not clean up test directory: ${sandboxDir}`,
        lastError,
      );
    }
  } else if (lastError) {
    console.warn(`Could not clean up test directory: ${sandboxDir}`, lastError);
  }
}

// Setup a sandbox directory for DB files
describe("romperDbCore.ts integration", () => {
  let sandboxDir: string;
  let dbDir: string;
  let dbPath: string;
  let kitName: string;

  beforeEach(async () => {
    sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "romper-test-"));
    dbDir = path.join(sandboxDir, ".romperdb");
    fs.mkdirSync(dbDir, { recursive: true });
    dbPath = path.join(dbDir, "romper.sqlite");
    await createRomperDbFile(dbDir);
    const kitRes = insertKitRecord(dbDir, {
      name: "A01",
      alias: "TR-808",
      artist: "Roland",
      plan_enabled: false,
    });
    kitName = "A01";
  });

  afterEach(async () => {
    await cleanupWithRetry(sandboxDir);
  });

  it("creates the database and tables with correct schema", () => {
    expect(fs.existsSync(dbPath)).toBe(true);
    const db = createDb(dbPath);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain("kits");
    expect(tables).toContain("samples");
    const kitCols = db.prepare("PRAGMA table_info(kits)").all();
    const sampleCols = db.prepare("PRAGMA table_info(samples)").all();
    expect(kitCols.map((c: any) => c.name)).toEqual(
      expect.arrayContaining([
        "name",
        "alias",
        "artist",
        "plan_enabled",
        "locked",
        "step_pattern",
      ]),
    );
    expect(sampleCols.map((c: any) => c.name)).toEqual(
      expect.arrayContaining([
        "id",
        "kit_name",
        "filename",
        "voice_number",
        "slot_number",
        "is_stereo",
      ]),
    );
    closeDb(db);
  });

  it("inserts a kit record", () => {
    const db = createDb(dbPath);
    const kit = db.prepare("SELECT * FROM kits WHERE name = ?").get(kitName);
    expect(kit.name).toBe("A01");
    expect(kit.alias).toBe("TR-808");
    expect(kit.artist).toBe("Roland");
    expect(kit.plan_enabled).toBe(0);
    closeDb(db);
  });

  it("inserts a sample record", () => {
    const sampleRes = insertSampleRecord(dbDir, {
      kit_name: kitName,
      filename: "kick.wav",
      voice_number: 1,
      slot_number: 1,
      is_stereo: true,
    });
    expect(sampleRes.success).toBe(true);
    const db = createDb(dbPath);
    const sample = db
      .prepare("SELECT * FROM samples WHERE id = ?")
      .get(sampleRes.sampleId);
    expect(sample.kit_name).toBe(kitName);
    expect(sample.filename).toBe("kick.wav");
    expect(sample.voice_number).toBe(1);
    expect(sample.slot_number).toBe(1);
    expect(sample.is_stereo).toBe(1);
    closeDb(db);
  });

  it("does not allow duplicate kit names (PRIMARY KEY constraint)", () => {
    // Try to insert a kit with the same name as one already inserted in beforeEach
    const res1 = insertKitRecord(dbDir, {
      name: "A01", // This name already exists from beforeEach
      alias: "Duplicate Copy",
      artist: "Roland",
      plan_enabled: false,
    });
    // Should fail due to PRIMARY KEY constraint
    expect(res1.success).toBe(false);
    expect(res1.error).toMatch(/UNIQUE constraint failed|PRIMARY KEY/i);
  });

  it("rejects invalid sample slot_number (out of range)", () => {
    const res = insertSampleRecord(dbDir, {
      kit_name: kitName,
      filename: "snare.wav",
      voice_number: 1,
      slot_number: 99,
      is_stereo: false,
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/CHECK constraint failed|constraint failed/i);
  });

  it("rejects sample with invalid kit_name (foreign key)", () => {
    const res = insertSampleRecord(dbDir, {
      kit_name: "nonexistent_kit",
      filename: "ghost.wav",
      voice_number: 1,
      slot_number: 2,
      is_stereo: false,
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/FOREIGN KEY constraint failed/i);
  });

  it("rejects invalid sample voice_number (out of range)", () => {
    const res = insertSampleRecord(dbDir, {
      kit_name: kitName,
      filename: "hihat.wav",
      voice_number: 99,
      slot_number: 1,
      is_stereo: false,
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/CHECK constraint failed|constraint failed/i);
  });

  it("overwrites DB file if it already exists", async () => {
    // Close any existing connections before manipulating the file
    closeAllConnections();

    // Give Windows extra time to release file locks
    if (process.platform === "win32") {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Write garbage to file and verify it's corrupted
    fs.writeFileSync(dbPath, Buffer.from([1, 2, 3, 4, 5]));

    // Verify the file exists and is corrupted
    expect(fs.existsSync(dbPath)).toBe(true);
    const corruptedSize = fs.statSync(dbPath).size;
    expect(corruptedSize).toBe(5); // Should be 5 bytes of garbage

    // On Windows, wait a bit more after writing the corrupted file
    if (process.platform === "win32") {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Should recreate DB
    const result = await createRomperDbFile(dbDir);
    expect(result.success).toBe(true);

    // Verify the file was actually recreated and is now a valid SQLite DB
    expect(fs.existsSync(dbPath)).toBe(true);
    const newSize = fs.statSync(dbPath).size;
    expect(newSize).toBeGreaterThan(5); // Should be much larger than the 5-byte garbage

    const db = createDb(dbPath);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain("kits");
    closeDb(db);
  });
});
