import type { DbResult } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
// Database utility functions for connection, creation, and validation.
// Migration machinery lives in dbMigrations.ts and is re-exported below.
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as fs from "node:fs";
import * as path from "node:path";

import { logger } from "../../utils/logger.js";
import {
  DB_FILENAME,
  ensureDatabaseMigrations,
  getMigrationsPath,
} from "./dbMigrations.js";

export {
  checkMigrationState,
  clearMigrationCache,
  DB_FILENAME,
  ensureDatabaseMigrations,
  executeMigrations,
  getMigrationsPath,
  logMigrationError,
  repairMigrationHistory,
} from "./dbMigrations.js";

/**
 * Initialize database with schema using Drizzle migrations
 */
export function createRomperDbFile(dbDir: string): {
  dbPath?: string;
  error?: string;
  success: boolean;
} {
  const dbPath = path.join(dbDir, DB_FILENAME);
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    const sqlite = openDatabase(dbPath);
    const db = drizzle(sqlite, { schema });
    const migrationsPath = getMigrationsPath();
    if (migrationsPath) {
      logger.log(
        "[Main] Creating database with migrations path:",
        migrationsPath,
      );
      migrate(db, { migrationsFolder: migrationsPath });
      logger.log("[Main] Initial migrations completed successfully");
    } else {
      console.error(
        "[Main] Migrations folder not found at any known location.",
      );
      sqlite.close();
      return { error: `Migrations folder not found.`, success: false };
    }
    sqlite.close();
    // Validate the schema was created correctly
    const validation = validateDatabaseSchema(dbDir);
    if (!validation.success) {
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
    const error = e instanceof Error ? e.message : String(e);
    console.error("[Main] Database creation error:", error);
    return { error, success: false };
  }
}

/**
 * Open a SQLite connection with the standard per-connection settings.
 *
 * Connections are opened fresh for every operation, so pragmas must be
 * applied on each open:
 * - busy_timeout: wait for a lock instead of failing immediately with
 *   SQLITE_BUSY when another connection (sync run, parallel IPC call)
 *   holds the write lock
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
 * Validate that the database schema is correctly set up
 */
export function validateDatabaseSchema(dbDir: string): DbResult<boolean> {
  const dbPath = path.join(dbDir, DB_FILENAME);

  try {
    const sqlite = openDatabase(dbPath, { readonly: true });

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

    sqlite.close();

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
 * Execute a function with a database connection, handling errors and cleanup
 */
export function withDb<T>(
  dbDir: string,
  fn: (db: ReturnType<typeof drizzle<typeof schema>>) => T,
): DbResult<T> {
  const dbPath = path.join(dbDir, DB_FILENAME);

  // Ensure migrations are up to date
  const migrationResult = ensureDatabaseMigrations(dbDir);
  if (!migrationResult.success) {
    return migrationResult as DbResult<T>;
  }

  let sqlite: BetterSqlite3.Database | null = null;
  try {
    sqlite = openDatabase(dbPath);
    const db = drizzle(sqlite, { schema });
    const result = fn(db);
    return { data: result, success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[Main] Database operation error:`, error);
    return { error, success: false };
  } finally {
    if (sqlite) {
      sqlite.close();
    }
  }
}

/**
 * Execute a function within a database transaction, handling errors, rollback, and cleanup
 */
export function withDbTransaction<T>(
  dbDir: string,
  fn: (
    db: ReturnType<typeof drizzle<typeof schema>>,
    sqlite: BetterSqlite3.Database,
  ) => T,
): DbResult<T> {
  const dbPath = path.join(dbDir, DB_FILENAME);

  // Ensure migrations are up to date
  const migrationResult = ensureDatabaseMigrations(dbDir);
  if (!migrationResult.success) {
    return migrationResult as DbResult<T>;
  }

  let sqlite: BetterSqlite3.Database | null = null;
  try {
    sqlite = openDatabase(dbPath);
    const db = drizzle(sqlite, { schema });

    // IMMEDIATE takes the write lock up front, so a concurrent writer is
    // rejected at BEGIN (after busy_timeout) instead of mid-transaction
    sqlite.exec("BEGIN IMMEDIATE TRANSACTION");

    try {
      const result = fn(db, sqlite);

      // Commit transaction on success
      sqlite.exec("COMMIT");
      return { data: result, success: true };
    } catch (e) {
      // Rollback transaction on error
      sqlite.exec("ROLLBACK");
      throw e;
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[Main] Database transaction error:`, error);
    return { error, success: false };
  } finally {
    if (sqlite) {
      sqlite.close();
    }
  }
}
