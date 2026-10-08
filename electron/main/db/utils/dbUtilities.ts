import type { DbResult } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
// Database connection, units of work, creation and validation. Each store
// has one connection, opened and migrated on first use and kept open
// (RE-81); the registry is in dbConnections.ts. Migration machinery lives
// in dbMigrations.ts and is re-exported below.
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";

import { logger } from "../../utils/logger.js";
import {
  closeAllDbConnections,
  closeDbConnection,
  getOpenDbConnection,
  listOpenDbConnections,
  registerDbConnection,
  reportDatabaseMissing,
  type RomperDb,
  type StoreConnection,
} from "./dbConnections.js";
import {
  DB_FILENAME,
  getMigrationsPath,
  migrateDatabase,
} from "./dbMigrations.js";

export {
  closeAllDbConnections,
  closeDbConnection,
  openDbConnectionCount,
  type RomperDb,
} from "./dbConnections.js";
export {
  checkMigrationState,
  DB_FILENAME,
  getMigrationsPath,
  logMigrationError,
  repairMigrationHistory,
} from "./dbMigrations.js";

/**
 * Check every open store's database file is still there (see
 * checkDatabaseFile). Main runs this every FILE_CHECK_INTERVAL_MS while a
 * store is open; tests call it to check straight away.
 */
export async function checkOpenDatabaseFiles(): Promise<void> {
  await Promise.all(
    listOpenDbConnections().map(([dbDir, connection]) =>
      checkDatabaseFile(dbDir, connection),
    ),
  );
}

/**
 * Close every connection, so the next operation on each store reopens and
 * re-migrates it. For tests that rebuild a database at the same path.
 */
export function clearMigrationCache(): void {
  closeAllDbConnections();
}

/**
 * Create a new store's database and bring its schema up to date. The
 * connection stays open: it's the store's connection from now on.
 */
export function createRomperDbFile(dbDir: string): {
  dbPath?: string;
  error?: string;
  success: boolean;
} {
  const dbPath = path.join(dbDir, DB_FILENAME);
  // A connection left from a database that used to be here would write to
  // the old file
  closeDbConnection(dbDir);
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    if (!getMigrationsPath()) {
      console.error(
        "[Main] Migrations folder not found at any known location.",
      );
      return { error: `Migrations folder not found.`, success: false };
    }
    const { sqlite } = connect(dbDir, { create: true });
    logger.log("[Main] Initial migrations completed successfully");
    // Validate the schema was created correctly
    const validation = checkSchema(sqlite);
    if (!validation.success) {
      // Close it so a failed setup can rename or delete the folder
      closeDbConnection(dbDir);
      console.error(
        "[Main] Database validation failed after creation:",
        validation.error,
      );
      return {
        error: `Database validation failed: ${validation.error}`,
        success: false,
      };
    }
    logger.log("[Main] Database created and validated successfully");
    return { dbPath, success: true };
  } catch (e) {
    closeDbConnection(dbDir);
    const error = e instanceof Error ? e.message : String(e);
    console.error("[Main] Database creation error:", error);
    return { error, success: false };
  }
}

/**
 * Open the store's connection if it isn't open yet, and run any pending
 * migrations on it. Throws when the file is missing (unless creating) or a
 * migration fails.
 */
export function ensureDatabaseMigrations(dbDir: string): DbResult<boolean> {
  try {
    connect(dbDir);
    return { data: true, success: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e),
      success: false,
    };
  }
}

/**
 * Open a SQLite connection with the standard per-connection settings.
 *
 * Each store has one connection, opened on first use (`connect`); these
 * apply for its lifetime:
 * - busy_timeout: wait for a lock instead of failing immediately with
 *   SQLITE_BUSY when another connection holds the write lock. Nothing stops
 *   a second Romper instance (there's no single-instance lock), and tests
 *   and tools open the file too.
 * - WAL journal mode + synchronous=NORMAL: readers no longer block the
 *   writer and vice versa; the standard pairing. journal_mode is set
 *   tolerantly — on filesystems without shared-memory support SQLite
 *   keeps the previous mode and everything still works.
 *
 * foreign_keys stays OFF intentionally: kits.bank_letter references
 * banks.letter, but kits can be created before a bank scan has populated
 * the banks table — enforcement would break createKit.
 */
export function openDatabase(
  dbPath: string,
  options: BetterSqlite3.Options = {},
): BetterSqlite3.Database {
  const sqlite = new BetterSqlite3(dbPath, options);
  sqlite.pragma("busy_timeout = 5000");
  if (!options.readonly) {
    try {
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("synchronous = NORMAL");
    } catch {
      // Keep the database usable in its existing journal mode
    }
  }
  return sqlite;
}

/**
 * Validate that the database schema is correctly set up. Uses the store's
 * connection when it's open; otherwise opens the file read-only for the
 * check (a store the wizard is about to open, say) and closes it again.
 */
export function validateDatabaseSchema(dbDir: string): DbResult<boolean> {
  const open = getOpenDbConnection(dbDir);
  if (open) return checkSchema(open.sqlite);

  const dbPath = path.join(dbDir, DB_FILENAME);
  let sqlite: BetterSqlite3.Database | null = null;
  try {
    sqlite = openDatabase(dbPath, { readonly: true });
    return checkSchema(sqlite);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { error: `Schema validation failed: ${error}`, success: false };
  } finally {
    sqlite?.close();
  }
}

/**
 * Run `fn` on the store's connection. Not a transaction by itself: use it
 * for reads and single statements. Called inside `withDbTransaction` on the
 * same store, it joins that transaction.
 */
export function withDb<T>(dbDir: string, fn: (db: RomperDb) => T): DbResult<T> {
  let connection: StoreConnection;
  try {
    connection = connect(dbDir);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e),
      success: false,
    };
  }
  try {
    return { data: fn(connection.db), success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[Main] Database operation error:`, error);
    return { error, success: false };
  }
}

/**
 * Run `fn` as one unit of work: everything it writes commits together, or
 * nothing does if it throws. Reentrant: called inside another transaction
 * on the same store, it becomes a savepoint, so a failure rolls back only
 * its own writes and returns a failed result; the caller decides whether
 * to throw and roll back the rest.
 *
 * The outermost call begins IMMEDIATE, taking the write lock up front, so
 * a writer in another process is waited for (busy_timeout) at BEGIN rather
 * than failing mid-transaction.
 */
export function withDbTransaction<T>(
  dbDir: string,
  fn: (db: RomperDb, sqlite: BetterSqlite3.Database) => T,
): DbResult<T> {
  let connection: StoreConnection;
  try {
    connection = connect(dbDir);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e),
      success: false,
    };
  }
  const { db, sqlite } = connection;
  try {
    // better-sqlite3 uses SAVEPOINT for a nested call, whatever the variant
    const data = sqlite.transaction(() => fn(db, sqlite)).immediate();
    return { data, success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[Main] Database transaction error:`, error);
    return { error, success: false };
  }
}

/**
 * Check, without holding the main thread, that the file at the store's
 * path is still the one `connection` opened (#535). An open connection
 * keeps writing to the file it opened, so if the file was deleted or moved
 * (by hand or a sync tool) edits would go to a file that's no longer in
 * the store, with no message. If it was, close the connection, so the next
 * operation fails (nothing recreates the file), and report it; if another
 * file replaced it, close the connection so the next operation opens that
 * one.
 */
async function checkDatabaseFile(
  dbDir: string,
  connection: StoreConnection,
): Promise<void> {
  const dbPath = path.join(dbDir, DB_FILENAME);
  let current: StoreConnection["file"];
  try {
    const { dev, ino } = await fs.promises.stat(dbPath);
    current = { dev, ino };
  } catch (e) {
    // Only a file that isn't there is missing; a stat that fails for
    // another reason (a busy network drive, say) is tried again next time
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ENOTDIR") return;
    current = undefined;
  }
  // Closed or replaced by Romper itself while the check ran
  if (getOpenDbConnection(dbDir) !== connection) return;
  const opened = connection.file;
  if (current && (!opened || isSameFile(current, opened))) return;

  logger.log(
    current
      ? `[Main] Another database file replaced ${dbPath}`
      : `[Main] The database file is gone: ${dbPath}`,
  );
  closeDbConnection(dbDir);
  if (!current) reportDatabaseMissing(dbDir);
}

function checkSchema(sqlite: BetterSqlite3.Database): DbResult<boolean> {
  try {
    // Check that all expected tables exist
    const expectedTables = ["banks", "kits", "samples", "voices"];
    const actualTables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'",
      )
      .all() as { name: string }[];

    const actualTableNames = actualTables
      .map((t) => t.name)
      .sort((a, b) => a.localeCompare(b));
    const missingTables = expectedTables.filter(
      (table) => !actualTableNames.includes(table),
    );

    if (missingTables.length > 0) {
      return {
        error: `Missing tables: ${missingTables.join(", ")}. Found: ${actualTableNames.join(", ")}`,
        success: false,
      };
    }

    return { data: true, success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { error: `Schema validation failed: ${error}`, success: false };
  }
}

/**
 * The store's connection: the open one, or a new one, opened and migrated
 * once (RE-81). Throws if the file doesn't exist (unless `create`) or a
 * migration fails; a connection that fails to migrate is closed.
 */
function connect(
  dbDir: string,
  { create = false }: { create?: boolean } = {},
): StoreConnection {
  const open = getOpenDbConnection(dbDir);
  if (open) return open;

  const dbPath = path.join(dbDir, DB_FILENAME);
  if (!create && !fs.existsSync(dbPath)) {
    reportDatabaseMissing(dbDir);
    throw new Error(`Database file does not exist: ${dbPath}`);
  }

  const sqlite = openDatabase(dbPath);
  try {
    const db = drizzle(sqlite, { schema });
    migrateDatabase(sqlite, db, dbPath, dbDir);
    const connection: StoreConnection = {
      db,
      file: fileIdentity(dbPath),
      sqlite,
    };
    registerDbConnection(dbDir, connection);
    startDatabaseFileChecks();
    return connection;
  } catch (e) {
    sqlite.close();
    if (create) throw e;
    const error = e instanceof Error ? e.message : String(e);
    throw new Error(`Migration failed: ${error}`);
  }
}

/** How often main checks that open stores' database files are still there */
const FILE_CHECK_INTERVAL_MS = 1000;
let fileCheckTimer: ReturnType<typeof setInterval> | undefined;
let fileCheckRunning = false;

/** The file's device and inode, or undefined if it can't be read */
function fileIdentity(filePath: string): StoreConnection["file"] {
  try {
    const { dev, ino } = fs.statSync(filePath);
    return { dev, ino };
  } catch {
    return undefined;
  }
}

function isSameFile(
  a: NonNullable<StoreConnection["file"]>,
  b: NonNullable<StoreConnection["file"]>,
): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

/**
 * Check the open stores' database files every FILE_CHECK_INTERVAL_MS until
 * none is open. An async stat per store per second costs nothing per
 * operation, where a check before each operation would hold the main
 * thread, and unlike a folder watch it doesn't miss changes (macOS can
 * drop watch events) or depend on the drive supporting watches.
 */
function startDatabaseFileChecks(): void {
  if (fileCheckTimer) return;
  fileCheckTimer = setInterval(() => {
    if (listOpenDbConnections().length === 0) {
      clearInterval(fileCheckTimer);
      fileCheckTimer = undefined;
      return;
    }
    if (fileCheckRunning) return;
    fileCheckRunning = true;
    void checkOpenDatabaseFiles().finally(() => {
      fileCheckRunning = false;
    });
  }, FILE_CHECK_INTERVAL_MS);
  // Never keeps the app (or a test run) alive
  fileCheckTimer.unref?.();
}
