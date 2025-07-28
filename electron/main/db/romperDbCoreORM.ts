// Drizzle ORM implementation
import BetterSqlite3 from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import type { DbResult } from "../../../shared/db/schema.js";
import type {
  Kit,
  NewKit,
  NewSample,
  Sample,
} from "../../../shared/db/schema.js";
import * as schema from "../../../shared/db/schema.js";
export const DB_FILENAME = "romper.sqlite";

const { banks, kits, voices, samples, editActions } = schema;

// Track which databases have been migration-checked this session
const migrationCheckedDbs = new Set<string>();

// Lightweight, idiomatic Drizzle connection helper
function withDb<T>(
  dbDir: string,
  operation: (db: BetterSQLite3Database<typeof schema>) => T,
): DbResult<T> {
  const dbPath = path.join(dbDir, DB_FILENAME);
  let sqlite: BetterSqlite3.Database | null = null;

  try {
    // Ensure migrations are run once per database per session
    if (!migrationCheckedDbs.has(dbPath) && fs.existsSync(dbPath)) {
      const migrationResult = ensureDatabaseMigrations(dbDir);
      if (!migrationResult.success) {
        console.error(
          `[DB] Migration failed for ${dbPath}:`,
          migrationResult.error,
        );
        return {
          success: false,
          error: `Migration failed: ${migrationResult.error}`,
        };
      }
      migrationCheckedDbs.add(dbPath);
    }

    sqlite = new BetterSqlite3(dbPath);
    const db = drizzle(sqlite, { schema });
    const result = operation(db);
    return { success: true, data: result };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  } finally {
    if (sqlite) {
      sqlite.close();
    }
  }
}

export function isDbCorruptionError(error: string): boolean {
  return /file is not a database|file is encrypted|malformed/i.test(error);
}

function getMigrationsPath(): string | null {
  // Production: built output
  const builtPath = path.join(__dirname, "db", "migrations");
  if (fs.existsSync(builtPath)) {
    return builtPath;
  }
  // Development: source directory
  const devPath = path.join(process.cwd(), "electron/main/db/migrations");
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  console.error("[DB] No migrations folder found at either built or dev path.");
  return null;
}

// Run migrations to ensure database is up to date
export function ensureDatabaseMigrations(dbDir: string): DbResult<boolean> {
  const dbPath = path.join(dbDir, DB_FILENAME);
  if (!fs.existsSync(dbPath)) {
    console.log("[Migration] Database does not exist, skipping migrations");
    return { success: false, error: "Database file does not exist" };
  }
  let sqlite: BetterSqlite3.Database | null = null;
  try {
    sqlite = new BetterSqlite3(dbPath);
    const db = drizzle(sqlite, { schema });

    const migrationsPath = getMigrationsPath();
    if (migrationsPath) {
      migrate(db, { migrationsFolder: migrationsPath });
      return { success: true, data: true };
    } else {
      console.warn(
        "[Migration] No migrations folder found - database may be missing required schema updates",
      );
      return { success: true, data: false };
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[Migration] Migration error:", error);
    if (e instanceof Error) {
      console.error("[Migration] Error stack:", e.stack);
    }
    return { success: false, error };
  } finally {
    if (sqlite) {
      sqlite.close();
    }
  }
}

// Validate that database has the expected schema
export function validateDatabaseSchema(dbDir: string): DbResult<boolean> {
  return withDb(dbDir, (db) => {
    try {
      // Check if the main tables exist by running a simple query
      // Note: migrations should have run in withDb, so all tables should exist
      db.select().from(banks).limit(1).all();
      db.select().from(kits).limit(1).all();
      db.select().from(voices).limit(1).all();
      db.select().from(samples).limit(1).all();
      db.select().from(editActions).limit(1).all();

      return true;
    } catch (error) {
      console.error("[Main] Database schema validation failed:", error);
      // This should not happen if migrations ran successfully
      console.error(
        "[Main] This suggests a migration issue or corrupted database",
      );
      throw new Error(`Database schema validation failed: ${error}`);
    }
  });
}

// Initialize database with schema using Drizzle migrations
export function createRomperDbFile(dbDir: string): {
  success: boolean;
  dbPath?: string;
  error?: string;
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
      return { success: false, error: `Migrations folder not found.` };
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
        success: false,
        error: `Database validation failed: ${validation.error}`,
      };
    }
    console.log("[Main] Database created and validated successfully");
    return { success: true, dbPath };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[Main] Database creation error:", error);
    if (isDbCorruptionError(error)) {
      try {
        fs.unlinkSync(dbPath);
        return createRomperDbFile(dbDir);
      } catch {
        return { success: false, error };
      }
    }
    return { success: false, error };
  }
}

// Simplified database functions
export function addKit(dbDir: string, kit: NewKit): DbResult<void> {
  return withDb(dbDir, (db) => {
    // Insert kit directly
    db.insert(kits).values(kit).run();

    // Create the 4 voices
    db.insert(voices)
      .values(
        Array.from({ length: 4 }, (_, i) => ({
          kit_name: kit.name,
          voice_number: i + 1,
          voice_alias: null,
        })),
      )
      .run();
  });
}

export function addSample(
  dbDir: string,
  sample: NewSample,
): DbResult<{ sampleId: number }> {
  return withDb(dbDir, (db) => {
    const result = db
      .insert(samples)
      .values(sample)
      .returning({ id: samples.id })
      .get();
    if (!result) {
      throw new Error("Failed to insert sample record");
    }
    return { sampleId: result.id };
  });
}

export function updateVoiceAlias(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  voiceAlias: string | null,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    db.update(voices)
      .set({ voice_alias: voiceAlias })
      .where(
        and(eq(voices.kit_name, kitName), eq(voices.voice_number, voiceNumber)),
      )
      .run();
  });
}

export function getKits(dbDir: string): DbResult<any[]> {
  return withDb(dbDir, (db) => {
    // For relational queries with Drizzle + better-sqlite3, use sync method
    const query = db.query.kits.findMany({
      with: {
        voices: true,
        bank: true, // Include bank information for artist metadata
      },
    });

    // Use the sync method to get synchronous results
    return query.sync();
  });
}

export function getKitSamples(dbDir: string, kitName: string): DbResult<any[]> {
  return withDb(dbDir, (db) => {
    return db.select().from(samples).where(eq(samples.kit_name, kitName)).all();
  });
}

export function deleteSamples(
  dbDir: string,
  kitName: string,
  filter?: { voiceNumber?: number; slotNumber?: number },
): DbResult<void> {
  return withDb(dbDir, (db) => {
    const conditions = [eq(samples.kit_name, kitName)];

    if (filter?.voiceNumber !== undefined) {
      conditions.push(eq(samples.voice_number, filter.voiceNumber));
    }

    if (filter?.slotNumber !== undefined) {
      conditions.push(eq(samples.slot_number, filter.slotNumber));
    }

    const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
    db.delete(samples).where(whereCondition).run();
  });
}

export function getAllSamples(dbDir: string): DbResult<any[]> {
  return withDb(dbDir, (db) => {
    return db.select().from(samples).all();
  });
}

export function getKit(dbDir: string, kitName: string): DbResult<any | null> {
  return withDb(dbDir, (db) => {
    // Use proper Drizzle relational query with sync execution
    const result = db.query.kits
      .findFirst({
        where: eq(schema.kits.name, kitName),
        with: {
          voices: true,
          samples: true,
          bank: true, // Include bank information for artist metadata
        },
      })
      .sync();

    return result ?? null;
  });
}

export function updateKit(
  dbDir: string,
  kitName: string,
  updates: {
    alias?: string;
    artist?: string;
    step_pattern?: number[][] | null;
    tags?: string[];
    description?: string;
    editable?: boolean;
  },
): DbResult<void> {
  return withDb(dbDir, (db) => {
    // Filter out undefined values for cleaner updates
    const updateData = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );
    // Note: tags and description aren't in our schema yet

    // Check if kit exists, create if it doesn't
    const existingKit = db
      .select()
      .from(kits)
      .where(eq(kits.name, kitName))
      .get();
    if (!existingKit) {
      // Create the kit with default values
      db.insert(kits)
        .values({
          name: kitName,
          editable: true,
          locked: false,
        })
        .run();
    }

    db.update(kits).set(updateData).where(eq(kits.name, kitName)).run();
  });
}

// Bank operations
export function getAllBanks(dbDir: string): DbResult<any[]> {
  return withDb(dbDir, (db) => {
    return db.select().from(banks).orderBy(banks.letter).all();
  });
}

export function updateBank(
  dbDir: string,
  bankLetter: string,
  updates: {
    artist?: string | null;
    rtf_filename?: string | null;
    scanned_at?: Date;
  },
): DbResult<void> {
  return withDb(dbDir, (db) => {
    // Filter out undefined values for cleaner updates
    const updateData = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    db.update(banks).set(updateData).where(eq(banks.letter, bankLetter)).run();
  });
}
