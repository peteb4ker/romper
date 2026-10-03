// Database migration machinery: locating the migrations folder, applying
// migrations and one-time history repair. dbUtilities runs them when it
// opens a store's connection.
import type BetterSqlite3 from "better-sqlite3";

import { type MigrationMeta, readMigrationFiles } from "drizzle-orm/migrator";
import crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { RomperDb } from "./dbConnections.js";

import { logger } from "../../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DB_FILENAME = "romper.sqlite";

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

  logger.log(
    `[Main] Found ${tables.length} tables:`,
    tables.map((t) => t.name),
  );

  // Check if __drizzle_migrations table exists
  const migrationTable = tables.find((t) => t.name === "__drizzle_migrations");
  if (migrationTable) {
    const migrations = sqlite
      .prepare("SELECT hash, created_at FROM __drizzle_migrations ORDER BY id")
      .all();
    logger.log(`[Main] Found ${migrations.length} applied migrations`);
  } else {
    logger.log("[Main] No migration history found");
  }
}

/**
 * Execute database migrations (and the history repair) in one transaction
 * on the connection behind `db`
 */
export function executeMigrations(
  db: RomperDb,
  dbPath: string,
  dbDir: string,
): void {
  const { $client } = db as { $client: BetterSqlite3.Database } & RomperDb;
  try {
    upgradeDatabase($client, dbPath);
  } catch (e) {
    logMigrationError(e, dbPath, dbDir);
    throw e;
  }
}

/**
 * Get the path to the bundled migrations folder.
 *
 * Only the folder that ships with the code is accepted (RE-33): beside the
 * bundled main script in a build, or beside this file when running from
 * source (tests). A `migrations` folder in the working directory is never
 * used, so an installed app can't pick up stray SQL.
 */
export function getMigrationsPath(): null | string {
  const possiblePaths = [
    // Built app: the bundle is dist/electron/main/index.js
    path.join(__dirname, "db", "migrations"),
    // Source: this file is electron/main/db/utils/dbMigrations.ts
    path.join(__dirname, "..", "migrations"),
  ];

  for (const migrationsPath of possiblePaths) {
    if (fs.existsSync(path.join(migrationsPath, "meta", "_journal.json"))) {
      logger.log(`[Main] Found migrations folder at: ${migrationsPath}`);
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
 * Bring a just-opened connection's schema up to date: repair the history
 * left by the 0008→0009 consolidation, then apply pending migrations, all
 * in one transaction after saving a copy (RE-33; see upgradeDatabase). Runs
 * once per connection, when the store is opened (RE-81).
 */
export function migrateDatabase(
  sqlite: BetterSqlite3.Database,
  _db: RomperDb,
  dbPath: string,
  dbDir: string,
): void {
  checkMigrationState(sqlite);
  try {
    upgradeDatabase(sqlite, dbPath);
  } catch (e) {
    logMigrationError(e, dbPath, dbDir);
    throw e;
  }
}

/**
 * Repair migration history for databases affected by the 0008→0009 consolidation.
 *
 * Commit 24f89f4 deleted migration 0008_ordinary_mastermind (which added
 * wav_bit_depth and wav_channels to samples) and consolidated those changes
 * plus a new stereo_mode column into 0009_purple_zaladane. Databases that
 * already applied 0008 have some columns but not all, and lack a record for
 * 0009 — causing Drizzle to re-run it and fail on "duplicate column".
 *
 * This function detects that state, applies any missing columns, and
 * records 0009 as applied so Drizzle skips it. It runs in a transaction (a
 * savepoint when called inside upgradeDatabase's), so the columns and the
 * record land together or not at all, and running it again is harmless
 * (RE-33).
 */
export function repairMigrationHistory(sqlite: BetterSqlite3.Database): void {
  sqlite.transaction(() => {
    const repair = findHistoryRepair(sqlite);
    if (!repair) return;

    for (const column of repair.missingColumns) {
      sqlite.exec(LEGACY_0009_COLUMNS[column]);
    }
    logger.log(
      `[Main] Repairing migration history: applied missing columns and recorded ${LEGACY_0009_TAG} (partially applied from deleted 0008)`,
    );
    sqlite
      .prepare(
        'INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES (?, ?)',
      )
      .run(repair.hash, repair.when);
  })();
}

/**
 * Bring a database up to date: repair the 0008/0009 history if needed, then
 * apply every pending migration, all in one IMMEDIATE transaction (RE-33).
 *
 * This does what Drizzle's migrator does (pending = journal entries newer
 * than the newest recorded migration; each one's statements, then a record
 * with its hash), but Drizzle's migrator opens its own transaction, so the
 * repair couldn't share it. Taking the write lock up front means a second
 * connection waits rather than upgrading the same file at the same time.
 */
export function upgradeDatabase(
  sqlite: BetterSqlite3.Database,
  dbPath: string,
): void {
  const migrationsPath = getMigrationsPath();
  if (!migrationsPath) {
    throw new Error("Migrations folder not found");
  }
  const migrations = readMigrationFiles({ migrationsFolder: migrationsPath });

  if (
    !findHistoryRepair(sqlite, migrationsPath) &&
    pendingMigrations(sqlite, migrations).length === 0
  ) {
    return;
  }

  logger.log(`[Main] Migrating database: ${dbPath}`);
  logger.log(`[Main] Using migrations from: ${migrationsPath}`);
  // A new store has nothing to lose, so only an existing one is copied
  if (lastRecordedMigration(sqlite)) backupBeforeUpgrade(sqlite, dbPath);

  sqlite
    .transaction(() => {
      repairMigrationHistory(sqlite);
      sqlite.exec(
        'CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)',
      );
      const record = sqlite.prepare(
        'INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)',
      );
      for (const migration of pendingMigrations(sqlite, migrations)) {
        for (const statement of migration.sql) {
          sqlite.exec(statement);
        }
        record.run(migration.hash, migration.folderMillis);
      }
    })
    .immediate();

  logger.log(`[Main] Migrations completed successfully for ${dbPath}`);
}

/** The copy of the database saved before an upgrade changes it */
export const PRE_UPGRADE_BACKUP_SUFFIX = ".before-upgrade";

/**
 * Save a consistent copy of the database (romper.sqlite.before-upgrade)
 * before an upgrade changes it (RE-33), so a migration that succeeds but
 * turns out wrong can still be undone by hand. Each upgrade replaces the
 * previous copy. The copy is written to a temporary name and renamed, so an
 * interrupted backup never replaces a good one. If it can't be written, the
 * upgrade doesn't start.
 */
function backupBeforeUpgrade(
  sqlite: BetterSqlite3.Database,
  dbPath: string,
): void {
  const backupPath = `${dbPath}${PRE_UPGRADE_BACKUP_SUFFIX}`;
  const partialPath = `${backupPath}.partial`;
  try {
    fs.rmSync(partialPath, { force: true });
    // VACUUM INTO reads a consistent snapshot, including any WAL content
    sqlite.prepare("VACUUM INTO ?").run(partialPath);
    fs.renameSync(partialPath, backupPath);
    logger.log(`[Main] Saved a copy of the database to ${backupPath}`);
  } catch (e) {
    fs.rmSync(partialPath, { force: true });
    const error = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Couldn't save a copy of the database before upgrading it: ${error}`,
    );
  }
}

const LEGACY_0009_TAG = "0009_purple_zaladane";

/** The columns 0009_purple_zaladane adds, each as its own statement */
const LEGACY_0009_COLUMNS = {
  stereo_mode:
    "ALTER TABLE `voices` ADD `stereo_mode` integer DEFAULT false NOT NULL",
  wav_bit_depth: "ALTER TABLE `samples` ADD `wav_bit_depth` integer",
  wav_channels: "ALTER TABLE `samples` ADD `wav_channels` integer",
} as const;

type Legacy0009Column = keyof typeof LEGACY_0009_COLUMNS;

/**
 * What repairMigrationHistory would change, or null when the database
 * doesn't need it: a fresh database (none of 0009's columns yet), one with
 * no migration history, or one that already records 0009.
 */
function findHistoryRepair(
  sqlite: BetterSqlite3.Database,
  migrationsPath = getMigrationsPath(),
): { hash: string; missingColumns: Legacy0009Column[]; when: number } | null {
  const columnsOf = (table: string) =>
    new Set(
      (
        sqlite.prepare(`PRAGMA table_info(${table})`).all() as {
          name: string;
        }[]
      ).map((c) => c.name),
    );
  const sampleCols = columnsOf("samples");
  const voiceCols = columnsOf("voices");
  const present: Record<Legacy0009Column, boolean> = {
    stereo_mode: voiceCols.has("stereo_mode"),
    wav_bit_depth: sampleCols.has("wav_bit_depth"),
    wav_channels: sampleCols.has("wav_channels"),
  };

  // If none of the 0009 columns exist, this is a fresh DB — no repair needed
  if (!Object.values(present).some(Boolean)) return null;

  const tables = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'",
    )
    .all();
  if (tables.length === 0) return null;

  if (!migrationsPath) return null;
  const sqlPath = path.join(migrationsPath, `${LEGACY_0009_TAG}.sql`);
  if (!fs.existsSync(sqlPath)) return null;

  // Compute the hash the same way Drizzle does (SHA-256 of raw SQL content)
  const migrationSql = fs.readFileSync(sqlPath).toString();
  const hash = crypto.createHash("sha256").update(migrationSql).digest("hex");

  const existing = sqlite
    .prepare("SELECT id FROM __drizzle_migrations WHERE hash = ?")
    .all(hash);
  if (existing.length > 0) return null; // Already applied

  const journal = JSON.parse(
    fs
      .readFileSync(path.join(migrationsPath, "meta", "_journal.json"))
      .toString(),
  ) as { entries: { tag: string; when: number }[] };
  const entry = journal.entries.find((e) => e.tag === LEGACY_0009_TAG);
  if (!entry) {
    // Recording 0009 is the point of the repair; adding its columns without
    // the record would make Drizzle re-run it and fail on duplicate columns
    throw new Error(`${LEGACY_0009_TAG} is missing from the migration journal`);
  }

  const missingColumns = (Object.keys(present) as Legacy0009Column[]).filter(
    (column) => !present[column],
  );
  return { hash, missingColumns, when: entry.when };
}

/**
 * The newest recorded migration's timestamp, or undefined when the database
 * has no migration history yet (a new store)
 */
function lastRecordedMigration(
  sqlite: BetterSqlite3.Database,
): { created_at: number | string } | undefined {
  const hasHistory =
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'",
      )
      .all().length > 0;
  if (!hasHistory) return undefined;
  return sqlite
    .prepare(
      'SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1',
    )
    .get() as { created_at: number | string } | undefined;
}

/**
 * The migrations Drizzle would apply: journal entries newer than the newest
 * recorded migration (all of them when there's no history yet).
 */
function pendingMigrations(
  sqlite: BetterSqlite3.Database,
  migrations: MigrationMeta[],
): MigrationMeta[] {
  const last = lastRecordedMigration(sqlite);
  return migrations.filter(
    (migration) => !last || Number(last.created_at) < migration.folderMillis,
  );
}
