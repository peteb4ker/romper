import type { DbResult } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
// Database utility functions for connection, migration, and validation
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DB_FILENAME = "romper.sqlite";

// Track which databases have been migration-checked this session
const migrationCheckedDbs = new Set<string>();

/**
 * Check migration state of database
 */
export function checkMigrationState(sqlite: BetterSqlite3.Database): void {
  // Check if schema tables exist
  const tables = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as { name: string }[];

  console.log(
    `[Main] Found ${tables.length} tables:`,
    tables.map((t) => t.name),
  );

  // Check if __drizzle_migrations table exists
  const migrationTable = tables.find((t) => t.name === "__drizzle_migrations");
  if (migrationTable) {
    const migrations = sqlite
      .prepare("SELECT hash, created_at FROM __drizzle_migrations ORDER BY id")
      .all();
    console.log(`[Main] Found ${migrations.length} applied migrations`);
  } else {
    console.log("[Main] No migration history found");
  }
}

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
    const sqlite = new BetterSqlite3(dbPath);
    const db = drizzle(sqlite, { schema });
    const migrationsPath = getMigrationsPath();
    if (migrationsPath) {
      console.log(
        "[Main] Creating database with migrations path:",
        migrationsPath,
      );
      migrate(db, { migrationsFolder: migrationsPath });
      console.log("[Main] Initial migrations completed successfully");
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
    console.log("[Main] Database created and validated successfully");
    return { dbPath, success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[Main] Database creation error:", error);
    return { error, success: false };
  }
}

/**
 * Ensure database migrations are up to date
 */
export function ensureDatabaseMigrations(dbDir: string): DbResult<boolean> {
  const dbPath = path.join(dbDir, DB_FILENAME);

  // Skip if already checked this session
  if (migrationCheckedDbs.has(dbPath)) {
    return { data: true, success: true };
  }

  // Check if database file exists
  if (!fs.existsSync(dbPath)) {
    return {
      error: `Database file does not exist: ${dbPath}`,
      success: false,
    };
  }

  try {
    const sqlite = new BetterSqlite3(dbPath);
    const db = drizzle(sqlite, { schema });

    checkMigrationState(sqlite);
    executeMigrations(db, dbPath, dbDir);

    sqlite.close();
    migrationCheckedDbs.add(dbPath);

    return { data: true, success: true };
  } catch (e) {
    logMigrationError(e, dbPath, dbDir);
    const error = e instanceof Error ? e.message : String(e);
    return { error: `Migration failed: ${error}`, success: false };
  }
}

/**
 * Execute database migrations
 */
export function executeMigrations(
  db: any,
  dbPath: string,
  dbDir: string,
): void {
  const migrationsPath = getMigrationsPath();
  if (!migrationsPath) {
    throw new Error("Migrations folder not found");
  }

  console.log(`[Main] Migrating database: ${dbPath}`);
  console.log(`[Main] Using migrations from: ${migrationsPath}`);

  try {
    migrate(db, { migrationsFolder: migrationsPath });
    console.log(`[Main] Migrations completed successfully for ${dbPath}`);
  } catch (e) {
    logMigrationError(e, dbPath, dbDir);
    throw e;
  }
}

/**
 * Get the path to migrations folder, checking multiple possible locations
 */
export function getMigrationsPath(): null | string {
  const possiblePaths = [
    // Built app paths - when bundled, __dirname is dist/electron/main
    path.join(__dirname, "db", "migrations"),
    // Also check if migrations are directly in main folder
    path.join(__dirname, "migrations"),
    // Built app paths (dist/electron/main/db/utils -> migrations)
    path.join(__dirname, "..", "migrations"),
    // Development paths
    path.join(__dirname, "..", "..", "..", "..", "migrations"),
    path.join(__dirname, "..", "..", "..", "migrations"),
    path.join(__dirname, "..", "..", "migrations"),
    // Working directory paths
    path.join(process.cwd(), "migrations"),
    path.join(process.cwd(), "drizzle"),
    path.join(process.cwd(), "electron", "main", "db", "migrations"),
    // Development source paths
    path.join(process.cwd(), "dist", "electron", "main", "db", "migrations"),
  ];

  for (const migrationsPath of possiblePaths) {
    if (fs.existsSync(migrationsPath)) {
      console.log(`[Main] Found migrations folder at: ${migrationsPath}`);
      return migrationsPath;
    }
  }

  console.error("[Main] No migrations folder found in any expected location:");
  possiblePaths.forEach((p) => console.error(`  - ${p}`));
  return null;
}

/**
 * Log migration errors with context
 */
export function logMigrationError(
  e: unknown,
  dbPath: string,
  dbDir: string,
): void {
  const error = e instanceof Error ? e.message : String(e);
  console.error(`[Main] Migration error for ${dbPath}:`, error);
  console.error(`[Main] Database directory: ${dbDir}`);
  console.error(`[Main] Database exists: ${fs.existsSync(dbPath)}`);

  if (fs.existsSync(dbPath)) {
    try {
      const stats = fs.statSync(dbPath);
      console.error(`[Main] Database size: ${stats.size} bytes`);
    } catch (statError) {
      console.error(`[Main] Could not get database stats:`, statError);
    }
  }
}

/**
 * Validate that the database schema is correctly set up
 */
export function validateDatabaseSchema(dbDir: string): DbResult<boolean> {
  const dbPath = path.join(dbDir, DB_FILENAME);

  try {
    const sqlite = new BetterSqlite3(dbPath, { readonly: true });

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
export function withDb<T>(dbDir: string, fn: (db: any) => T): DbResult<T> {
  const dbPath = path.join(dbDir, DB_FILENAME);

  // Ensure migrations are up to date
  const migrationResult = ensureDatabaseMigrations(dbDir);
  if (!migrationResult.success) {
    return migrationResult as DbResult<T>;
  }

  let sqlite: BetterSqlite3.Database | null = null;
  try {
    sqlite = new BetterSqlite3(dbPath);
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
  fn: (db: any, sqlite: BetterSqlite3.Database) => T,
): DbResult<T> {
  const dbPath = path.join(dbDir, DB_FILENAME);

  // Ensure migrations are up to date
  const migrationResult = ensureDatabaseMigrations(dbDir);
  if (!migrationResult.success) {
    return migrationResult as DbResult<T>;
  }

  let sqlite: BetterSqlite3.Database | null = null;
  try {
    sqlite = new BetterSqlite3(dbPath);
    const db = drizzle(sqlite, { schema });

    // Start transaction
    sqlite.exec("BEGIN TRANSACTION");

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
