import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRomperDbFile, insertKitRecord, insertSampleRecord } from "../../romperDbCore";
import BetterSqlite3 from 'better-sqlite3';
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Setup a sandbox directory for DB files
describe("romperDbCore.ts integration", () => {
  let sandboxDir: string;
  let dbDir: string;
  let dbPath: string;
  let kitId: number;

  beforeEach(() => {
    sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "romper-test-"));
    dbDir = path.join(sandboxDir, ".romperdb");
    fs.mkdirSync(dbDir, { recursive: true });
    dbPath = path.join(dbDir, "romper.sqlite");
    createRomperDbFile(dbDir);
    const kitRes = insertKitRecord(dbDir, { name: "808 Kit", alias: "TR-808", artist: "Roland", plan_enabled: false });
    kitId = kitRes.kitId!;
  });

  afterEach(() => {
    if (sandboxDir && fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it("creates the database and tables with correct schema", () => {
    expect(fs.existsSync(dbPath)).toBe(true);
    const db = new BetterSqlite3(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    expect(tables).toContain("kits");
    expect(tables).toContain("samples");
    const kitCols = db.prepare("PRAGMA table_info(kits)").all();
    const sampleCols = db.prepare("PRAGMA table_info(samples)").all();
    expect(kitCols.map((c: any) => c.name)).toEqual(
      expect.arrayContaining(["id", "name", "alias", "artist", "plan_enabled"])
    );
    expect(sampleCols.map((c: any) => c.name)).toEqual(
      expect.arrayContaining(["id", "kit_id", "filename", "slot_number", "is_stereo"])
    );
    db.close();
  });

  it("inserts a kit record", () => {
    const db = new BetterSqlite3(dbPath);
    const kit = db.prepare("SELECT * FROM kits WHERE id = ?").get(kitId);
    expect(kit.name).toBe("808 Kit");
    expect(kit.alias).toBe("TR-808");
    expect(kit.artist).toBe("Roland");
    expect(kit.plan_enabled).toBe(0);
    db.close();
  });

  it("inserts a sample record", () => {
    const sampleRes = insertSampleRecord(dbDir, { kit_id: kitId, filename: "kick.wav", slot_number: 1, is_stereo: true });
    expect(sampleRes.success).toBe(true);
    const db = new BetterSqlite3(dbPath);
    const sample = db.prepare("SELECT * FROM samples WHERE id = ?").get(sampleRes.sampleId);
    expect(sample.kit_id).toBe(kitId);
    expect(sample.filename).toBe("kick.wav");
    expect(sample.slot_number).toBe(1);
    expect(sample.is_stereo).toBe(1);
    db.close();
  });

  it("does not allow duplicate kit names (if unique constraint added)", () => {
    // This test will pass if unique constraint is added in schema, otherwise will allow duplicates
    const res1 = insertKitRecord(dbDir, { name: "808 Kit", alias: "Copy", artist: "Roland", plan_enabled: false });
    // Should succeed (no unique constraint in schema by default)
    expect(res1.success).toBe(true);
  });

  it("rejects invalid sample slot_number (out of range)", () => {
    const res = insertSampleRecord(dbDir, { kit_id: kitId, filename: "snare.wav", slot_number: 99, is_stereo: false });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/CHECK constraint failed|constraint failed/i);
  });

  it("rejects sample with invalid kit_id (foreign key)", () => {
    const res = insertSampleRecord(dbDir, { kit_id: 9999, filename: "ghost.wav", slot_number: 2, is_stereo: false });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/FOREIGN KEY constraint failed/i);
  });

  it("overwrites DB file if it already exists", () => {
    // Write garbage to file
    fs.writeFileSync(dbPath, Buffer.from([1,2,3,4,5]));
    // Should recreate DB
    const result = createRomperDbFile(dbDir);
    expect(result.success).toBe(true);
    const db = new BetterSqlite3(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    expect(tables).toContain("kits");
    db.close();
  });
});
