import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRomperDbFile } from "../../db/romperDbCoreORM.js";
import {
  EXISTING_LOCAL_STORE_MESSAGE,
  LocalStoreSetupService,
} from "../localStoreSetupService";

// Stand-in for the real database creation: writes a file so the directory
// looks like a store. The real path is covered by the integration test.
vi.mock("../../db/romperDbCoreORM.js", () => ({
  createRomperDbFile: vi.fn((dbDir: string) => {
    fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(path.join(dbDir, "romper.sqlite"), "db");
    return { dbPath: path.join(dbDir, "romper.sqlite"), success: true };
  }),
}));

// renameSync passes through to the real one unless a test overrides it
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, renameSync: vi.fn(actual.renameSync) };
});

vi.mock("../../utils/logger.js", () => ({
  logger: { log: vi.fn() },
}));

// Real filesystem in a temp dir; only database creation is stubbed
describe("LocalStoreSetupService (RE-10)", () => {
  let tmpRoot: string;
  let target: string;
  let dbDir: string;
  let service: LocalStoreSetupService;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "romper-setup-"));
    target = path.join(tmpRoot, "store");
    fs.mkdirSync(target);
    dbDir = path.join(target, ".romperdb");
    service = new LocalStoreSetupService();
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { force: true, recursive: true });
  });

  function makeExistingStore() {
    fs.mkdirSync(dbDir);
    fs.writeFileSync(path.join(dbDir, "romper.sqlite"), "user data");
  }

  describe("hasExistingLocalStore", () => {
    it("reports a folder with a populated .romperdb", () => {
      makeExistingStore();
      expect(service.hasExistingLocalStore(target)).toEqual({
        error: EXISTING_LOCAL_STORE_MESSAGE,
        exists: true,
      });
    });

    it("points the user at the existing-store flow", () => {
      expect(EXISTING_LOCAL_STORE_MESSAGE).toContain("Choose Existing Store");
    });

    it("does not count a missing or empty .romperdb", () => {
      expect(service.hasExistingLocalStore(target)).toEqual({ exists: false });
      fs.mkdirSync(dbDir);
      expect(service.hasExistingLocalStore(target)).toEqual({ exists: false });
    });

    it("counts a .romperdb that is a file, not a directory", () => {
      fs.writeFileSync(dbDir, "not a dir");
      expect(service.hasExistingLocalStore(target).exists).toBe(true);
    });
  });

  describe("createSetupDatabase", () => {
    it("creates a database in a fresh or empty directory", () => {
      fs.mkdirSync(dbDir); // the wizard's ensureDir runs first
      const result = service.createSetupDatabase(dbDir);
      expect(result.success).toBe(true);
      expect(createRomperDbFile).toHaveBeenCalledWith(path.resolve(dbDir));
    });

    it("refuses an existing store without touching it", () => {
      makeExistingStore();
      const result = service.createSetupDatabase(dbDir);
      expect(result).toEqual({
        error: EXISTING_LOCAL_STORE_MESSAGE,
        success: false,
      });
      expect(createRomperDbFile).not.toHaveBeenCalled();
      expect(fs.readFileSync(path.join(dbDir, "romper.sqlite"), "utf-8")).toBe(
        "user data",
      );
    });
  });

  describe("cleanupFailedSetup", () => {
    it("moves aside a database this setup created", () => {
      service.createSetupDatabase(dbDir);

      const result = service.cleanupFailedSetup(target);

      expect(result.removed).toBe(true);
      expect(result.movedTo).toMatch(/\.romperdb\.failed-\d+$/);
      expect(fs.existsSync(dbDir)).toBe(false);
      expect(fs.existsSync(path.join(result.movedTo!, "romper.sqlite"))).toBe(
        true,
      );
      // A retry can start fresh
      expect(service.hasExistingLocalStore(target).exists).toBe(false);
    });

    it("succeeds when the created database is already gone", () => {
      service.createSetupDatabase(dbDir);
      fs.rmSync(dbDir, { force: true, recursive: true });

      expect(service.cleanupFailedSetup(target)).toEqual({ removed: true });
    });

    it("refuses a pre-existing store it did not create", () => {
      makeExistingStore();

      const result = service.cleanupFailedSetup(target);

      expect(result.removed).toBe(false);
      expect(result.error).toMatch(/did not create/);
      expect(fs.readFileSync(path.join(dbDir, "romper.sqlite"), "utf-8")).toBe(
        "user data",
      );
    });

    it("refuses a store whose creation it refused", () => {
      // First run created it and succeeded; a later run is refused. The
      // refused run's cleanup must not touch the (now real) store.
      service.createSetupDatabase(dbDir);
      service.createSetupDatabase(dbDir);

      expect(service.cleanupFailedSetup(target).removed).toBe(false);
      expect(fs.existsSync(path.join(dbDir, "romper.sqlite"))).toBe(true);
    });

    it("refuses the configured local store", () => {
      service.createSetupDatabase(dbDir);

      const result = service.cleanupFailedSetup(target, `${target}/`);

      expect(result.removed).toBe(false);
      expect(result.error).toMatch(/configured local store/);
      expect(fs.existsSync(dbDir)).toBe(true);
    });

    it("cleans up at most once per creation", () => {
      service.createSetupDatabase(dbDir);
      expect(service.cleanupFailedSetup(target).removed).toBe(true);

      makeExistingStore();
      expect(service.cleanupFailedSetup(target).removed).toBe(false);
      expect(fs.existsSync(dbDir)).toBe(true);
    });

    it("refuses paths that only look like the created one", () => {
      service.createSetupDatabase(dbDir);
      const other = path.join(tmpRoot, "other");
      fs.mkdirSync(path.join(other, ".romperdb"), { recursive: true });

      expect(service.cleanupFailedSetup(other).removed).toBe(false);
      expect(fs.existsSync(path.join(other, ".romperdb"))).toBe(true);
    });

    it("reports a rename failure", () => {
      service.createSetupDatabase(dbDir);
      vi.mocked(fs.renameSync).mockImplementationOnce(() => {
        throw new Error("EBUSY");
      });

      const result = service.cleanupFailedSetup(target);

      expect(result).toEqual({
        error: expect.stringContaining("EBUSY"),
        removed: false,
      });
      expect(fs.existsSync(dbDir)).toBe(true);
    });
  });

  describe("cleanupUnfinishedSetups (RE-66: quit mid-setup)", () => {
    const failedCopies = (dir: string) =>
      fs.readdirSync(dir).filter((n) => n.startsWith(".romperdb.failed-"));

    it("moves aside a store whose setup never finished", () => {
      service.createSetupDatabase(dbDir);

      const results = service.cleanupUnfinishedSetups(null);

      expect(results).toEqual([
        expect.objectContaining({ removed: true, targetPath: target }),
      ]);
      expect(fs.existsSync(dbDir)).toBe(false);
      expect(failedCopies(target)).toHaveLength(1);
      // The next launch can set up the same folder
      expect(service.hasExistingLocalStore(target).exists).toBe(false);
    });

    it("skips the configured local store", () => {
      service.createSetupDatabase(dbDir);

      expect(service.cleanupUnfinishedSetups(target)).toEqual([]);
      expect(fs.existsSync(path.join(dbDir, "romper.sqlite"))).toBe(true);
    });

    it("skips a store whose setup finished", () => {
      service.createSetupDatabase(dbDir);
      service.markSetupComplete(target);

      // Even once another store is configured, the finished one stays
      expect(
        service.cleanupUnfinishedSetups(path.join(tmpRoot, "elsewhere")),
      ).toEqual([]);
      expect(fs.existsSync(path.join(dbDir, "romper.sqlite"))).toBe(true);
    });

    it("cleans up only the unfinished store among several", () => {
      const other = path.join(tmpRoot, "other");
      fs.mkdirSync(other);
      service.createSetupDatabase(dbDir);
      service.createSetupDatabase(path.join(other, ".romperdb"));

      const results = service.cleanupUnfinishedSetups(target);

      expect(results.map((r) => r.targetPath)).toEqual([other]);
      expect(fs.existsSync(dbDir)).toBe(true);
      expect(fs.existsSync(path.join(other, ".romperdb"))).toBe(false);
    });

    it("never touches a store it didn't create", () => {
      makeExistingStore();
      expect(service.cleanupUnfinishedSetups(null)).toEqual([]);
      expect(fs.existsSync(dbDir)).toBe(true);
    });
  });
});
