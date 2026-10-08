// A new store's database for integration tests, copied from one made once
// per test file instead of made from scratch for every test (#635).
//
// createRomperDbFile switches a new file to WAL and runs every migration,
// and SQLite flushes the file to disk as it does. On the Windows CI runners
// those flushes are slow, and slower still while the other test workers
// write: measured in #635, making a database there took a large share of
// each database test's time and could push a test's setup past the hook
// timeout. The template is made by createRomperDbFile itself, so each test
// starts from the same database it would have made; only the work moves.
//
// Tests of creating a database (dbUtilities, the Database Creation tests in
// romperDbCoreORM, dbMigrations) still call createRomperDbFile.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { closeDbConnection } from "../../../electron/main/db/utils/dbConnections.js";
import {
  createRomperDbFile,
  DB_FILENAME,
  ensureDatabaseMigrations,
} from "../../../electron/main/db/utils/dbUtilities.js";
import { registerTempDir } from "./tempDirs.js";

let template: string | undefined;

/**
 * Give the store in `dbDir` a new, migrated database, as createRomperDbFile
 * does, and leave its connection open, as that does. Throws if it can't.
 */
export function createStoreDb(dbDir: string): {
  dbPath: string;
  success: true;
} {
  template ??= makeTemplate();
  // A connection left from a database that used to be here would write to
  // the old file
  closeDbConnection(dbDir);
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, DB_FILENAME);
  fs.copyFileSync(template, dbPath);
  const opened = ensureDatabaseMigrations(dbDir);
  if (!opened.success) {
    throw new Error(`Couldn't open the copied database: ${opened.error}`);
  }
  return { dbPath, success: true };
}

/** Make this test file's template database, closed so its WAL is merged */
function makeTemplate(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "romper-db-template-"));
  registerTempDir(dir);
  const result = createRomperDbFile(dir);
  closeDbConnection(dir);
  if (!result.success || !result.dbPath) {
    throw new Error(`Couldn't make the template database: ${result.error}`);
  }
  return result.dbPath;
}
