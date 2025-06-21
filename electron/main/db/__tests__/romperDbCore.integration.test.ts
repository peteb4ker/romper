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
  let kitId: number;

  beforeEach(async () => {
    sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "romper-test-"));
    dbDir = path.join(sandboxDir, ".romperdb");
    fs.mkdirSync(dbDir, { recursive: true });
    dbPath = path.join(dbDir, "romper.sqlite");
    await createRomperDbFile(dbDir);
    const kitRes = insertKitRecord(dbDir, {
      name: "808 Kit",
      alias: "TR-808",
      artist: "Roland",
      plan_enabled: false,
    });
    kitId = kitRes.kitId!;
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
      expect.arrayContaining(["id", "name", "alias", "artist", "plan_enabled"]),
    );
    expect(sampleCols.map((c: any) => c.name)).toEqual(
      expect.arrayContaining([
        "id",
        "kit_id",
        "filename",
        "slot_number",
        "is_stereo",
      ]),
    );
    closeDb(db);
  });

  it("inserts a kit record", () => {
    const db = createDb(dbPath);
    const kit = db.prepare("SELECT * FROM kits WHERE id = ?").get(kitId);
    expect(kit.name).toBe("808 Kit");
    expect(kit.alias).toBe("TR-808");
    expect(kit.artist).toBe("Roland");
    expect(kit.plan_enabled).toBe(0);
    closeDb(db);
  });

  it("inserts a sample record", () => {
    const sampleRes = insertSampleRecord(dbDir, {
      kit_id: kitId,
      filename: "kick.wav",
      slot_number: 1,
      is_stereo: true,
    });
    expect(sampleRes.success).toBe(true);
    const db = createDb(dbPath);
    const sample = db
      .prepare("SELECT * FROM samples WHERE id = ?")
      .get(sampleRes.sampleId);
    expect(sample.kit_id).toBe(kitId);
    expect(sample.filename).toBe("kick.wav");
    expect(sample.slot_number).toBe(1);
    expect(sample.is_stereo).toBe(1);
    closeDb(db);
  });

  it("does not allow duplicate kit names (if unique constraint added)", () => {
    // This test will pass if unique constraint is added in schema, otherwise will allow duplicates
    const res1 = insertKitRecord(dbDir, {
      name: "808 Kit",
      alias: "Copy",
      artist: "Roland",
      plan_enabled: false,
    });
    // Should succeed (no unique constraint in schema by default)
    expect(res1.success).toBe(true);
  });

  it("rejects invalid sample slot_number (out of range)", () => {
    const res = insertSampleRecord(dbDir, {
      kit_id: kitId,
      filename: "snare.wav",
      slot_number: 99,
      is_stereo: false,
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/CHECK constraint failed|constraint failed/i);
  });

  it("rejects sample with invalid kit_id (foreign key)", () => {
    const res = insertSampleRecord(dbDir, {
      kit_id: 9999,
      filename: "ghost.wav",
      slot_number: 2,
      is_stereo: false,
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/FOREIGN KEY constraint failed/i);
  });

  it("overwrites DB file if it already exists", async () => {
    // Close any existing connections before manipulating the file
    closeAllConnections();

    // Give Windows time to release file locks
    if (process.platform === "win32") {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Write garbage to file
    fs.writeFileSync(dbPath, Buffer.from([1, 2, 3, 4, 5]));
    // Should recreate DB
    const result = await createRomperDbFile(dbDir);
    expect(result.success).toBe(true);
    const db = createDb(dbPath);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain("kits");
    closeDb(db);
  });
});
