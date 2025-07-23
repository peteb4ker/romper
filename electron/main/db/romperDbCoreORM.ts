// Drizzle ORM implementation
import BetterSqlite3 from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as fs from "fs";
import * as path from "path";

import type { DbResult } from "../../../shared/db/schema.js";
import type { Kit, NewKit, NewSample, Sample } from "../../../shared/db/schema.js";
import * as schema from "../../../shared/db/schema.js";
export const DB_FILENAME = "romper.sqlite";

const { kits, voices, samples, editActions } = schema;

// Lightweight, idiomatic Drizzle connection helper
function withDb<T>(
  dbDir: string,
  operation: (db: BetterSQLite3Database<typeof schema>) => T,
): DbResult<T> {
  const dbPath = path.join(dbDir, DB_FILENAME);
  let sqlite: BetterSqlite3.Database | null = null;

  try {
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

    // Use Drizzle migrations to create the schema
    const migrationsPath = path.join(__dirname, "migrations");
    migrate(db, { migrationsFolder: migrationsPath });

    sqlite.close();
    return { success: true, dbPath };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);

    if (isDbCorruptionError(error)) {
      try {
        // Simple sync deletion for recovery
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

export function deleteSamples(dbDir: string, kitName: string): DbResult<void> {
  return withDb(dbDir, (db) => {
    db.delete(samples).where(eq(samples.kit_name, kitName)).run();
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
  },
): DbResult<void> {
  return withDb(dbDir, (db) => {
    // Filter out undefined values for cleaner updates
    const updateData = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );
    // Note: tags and description aren't in our schema yet

    db.update(kits).set(updateData).where(eq(kits.name, kitName)).run();
  });
}
