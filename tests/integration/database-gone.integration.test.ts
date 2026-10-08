import { sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addKit,
  getKit,
  updateKit,
} from "../../electron/main/db/romperDbCoreORM.js";
import {
  connectionKey,
  openDbConnectionCount,
  setDatabaseMissingListener,
} from "../../electron/main/db/utils/dbConnections.js";
import {
  openDatabase,
  withDb,
} from "../../electron/main/db/utils/dbUtilities.js";
import { localStoreService } from "../../electron/main/services/localStoreService.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// Romper keeps one connection open per store (#513). If the database file
// is deleted or moved while it runs, that connection used to go on writing
// to the old file, so edits were lost without a word (#535). Now main
// notices (it watches the store's database folder), closes the connection
// and tells the renderer, the store's status turns invalid (which shows
// the Invalid Local Store dialog), and the next edit fails without
// recreating the file.
//
// Windows doesn't let a file SQLite has open be deleted or moved, so this
// can't happen there.
describe.skipIf(process.platform === "win32")(
  "[Q-02] [UC-05] The database file goes missing while Romper runs (#535)",
  () => {
    let tempDir: string;
    let localStorePath: string;
    let dbDir: string;
    let dbPath: string;
    const missing = vi.fn();

    const status = () =>
      localStoreService.getLocalStoreStatus(localStorePath, undefined);

    const renameKit = (alias: string) =>
      updateKit(dbDir, "A0", { alias, name: "A0" });

    /** Everything so far is in the file itself, not only its WAL */
    const checkpoint = () =>
      expect(
        withDb(dbDir, (db) => db.run(sql`PRAGMA wal_checkpoint(TRUNCATE)`))
          .success,
      ).toBe(true);

    /** The kit's name in the database file at `file`, read on its own */
    const aliasIn = (file: string) => {
      const sqlite = openDatabase(file);
      try {
        const row = sqlite
          .prepare("SELECT alias FROM kits WHERE name = ?")
          .get("A0") as { alias: null | string } | undefined;
        return row?.alias;
      } finally {
        sqlite.close();
      }
    };

    beforeEach(() => {
      tempDir = createTempStore("database-gone-");
      localStorePath = path.join(tempDir, "store");
      dbDir = path.join(localStorePath, ".romperdb");
      fs.mkdirSync(localStorePath, { recursive: true });
      dbPath = createStoreDb(dbDir).dbPath;
      expect(
        addKit(dbDir, {
          alias: null,
          bank_letter: "A",
          editable: true,
          locked: false,
          modified_since_sync: false,
          name: "A0",
          step_pattern: null,
        }).success,
      ).toBe(true);
      // The connection is open, as it is while Romper runs
      expect(renameKit("Before").success).toBe(true);
      expect(status().isValid).toBe(true);
      missing.mockClear();
      setDatabaseMissingListener(missing);
    });

    afterEach(() => {
      setDatabaseMissingListener(null);
      removeTempStore(tempDir);
    });

    it("notices the file is deleted, fails the next edit, and doesn't recreate it", async () => {
      fs.rmSync(dbPath);

      await vi.waitFor(() =>
        expect(missing).toHaveBeenCalledWith(connectionKey(dbDir)),
      );
      expect(openDbConnectionCount()).toBe(0);
      expect(status()).toMatchObject({
        error: "Romper DB file not found",
        hasLocalStore: true,
        isValid: false,
      });

      const result = renameKit("After");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database file does not exist");
      expect(fs.existsSync(dbPath)).toBe(false);
      // Reads fail too, and still nothing is made at the old path
      expect(getKit(dbDir, "A0").success).toBe(false);
      expect(fs.existsSync(dbPath)).toBe(false);
    });

    it("notices the file is moved, fails the next edit, and leaves the moved file as it was", async () => {
      checkpoint();
      const movedPath = path.join(tempDir, "moved.sqlite");
      fs.renameSync(dbPath, movedPath);

      await vi.waitFor(() =>
        expect(missing).toHaveBeenCalledWith(connectionKey(dbDir)),
      );
      expect(status().isValid).toBe(false);

      expect(renameKit("After").success).toBe(false);
      expect(fs.existsSync(dbPath)).toBe(false);
      // The edit didn't land anywhere: the moved file has the old name
      expect(aliasIn(movedPath)).toBe("Before");
    });

    it("saves to the file now at the path when another replaced it", async () => {
      // A sync tool restoring the file writes a new one in its place
      checkpoint();
      const copy = path.join(tempDir, "copy.sqlite");
      fs.copyFileSync(dbPath, copy);
      fs.rmSync(dbPath);
      fs.renameSync(copy, dbPath);

      // The old connection is closed; the file at the path is no less valid
      await vi.waitFor(() => expect(openDbConnectionCount()).toBe(0));
      expect(missing).not.toHaveBeenCalled();
      expect(status().isValid).toBe(true);

      expect(renameKit("After").success).toBe(true);
      expect(aliasIn(dbPath)).toBe("After");
    });
  },
);
