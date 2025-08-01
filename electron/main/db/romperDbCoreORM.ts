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

import type {
  DbResult,
  KitWithRelations,
  NewKit,
  NewSample,
  Sample,
} from "../../../shared/db/schema.js";
import * as schema from "../../../shared/db/schema.js";
export const DB_FILENAME = "romper.sqlite";

const { banks, kits, voices, samples } = schema;

// Track which databases have been migration-checked this session
const migrationCheckedDbs = new Set<string>();

// Lightweight, idiomatic Drizzle connection helper
export function withDb<T>(
  dbDir: string,
  operation: (db: BetterSQLite3Database<typeof schema>) => T,
): DbResult<T> {
  const dbPath = path.join(dbDir, DB_FILENAME);
  let sqlite: BetterSqlite3.Database | null = null;

  try {
    // Ensure migrations are run once per database per session
    if (!migrationCheckedDbs.has(dbPath) && fs.existsSync(dbPath)) {
      console.log(`[DB] Running migrations for: ${dbPath}`);
      const migrationResult = ensureDatabaseMigrations(dbDir);
      if (!migrationResult.success) {
        console.error(
          `[DB] Migration failed for ${dbPath}:`,
          migrationResult.error,
        );

        return {
          success: false,
          error: migrationResult.error,
        };
      }
      console.log(`[DB] Migration completed successfully for: ${dbPath}`);
      migrationCheckedDbs.add(dbPath);
    }

    sqlite = new BetterSqlite3(dbPath);
    const db = drizzle(sqlite, { schema });
    const result = operation(db);

    if (sqlite) sqlite.close();
    return { success: true, data: result };
  } catch (e) {
    if (sqlite) sqlite.close();
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
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
  console.log("[Migration] Checking database at:", dbPath);
  console.log("[Migration] Database exists:", fs.existsSync(dbPath));

  if (!fs.existsSync(dbPath)) {
    console.log("[Migration] Database does not exist, skipping migrations");
    return { success: false, error: "Database file does not exist" };
  }

  let sqlite: BetterSqlite3.Database | null = null;
  try {
    console.log("[Migration] Opening database connection...");
    sqlite = new BetterSqlite3(dbPath);
    const db = drizzle(sqlite, { schema });

    const migrationsPath = getMigrationsPath();
    console.log("[Migration] Migrations path:", migrationsPath);

    if (migrationsPath) {
      console.log("[Migration] Starting migration process...");

      // List migration files
      const migrationFiles = fs.readdirSync(migrationsPath);
      console.log("[Migration] Available migration files:", migrationFiles);

      // Check current migration state
      try {
        const result = sqlite
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'",
          )
          .get();
        console.log("[Migration] Drizzle migrations table exists:", !!result);

        if (result) {
          const appliedMigrations = sqlite
            .prepare("SELECT * FROM __drizzle_migrations ORDER BY id")
            .all();
          console.log("[Migration] Applied migrations:", appliedMigrations);
        }
      } catch (e) {
        console.log(
          "[Migration] Could not check migration state (this is normal for first run):",
          e,
        );
      }

      console.log("[Migration] Executing migrate() function...");
      migrate(db, { migrationsFolder: migrationsPath });
      console.log("[Migration] Migration completed successfully!");

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

    // Log additional debugging info
    console.error("[Migration] Database path:", dbPath);
    console.error("[Migration] Database dir:", dbDir);
    console.error("[Migration] Error type:", typeof e);
    console.error("[Migration] Full error object:", e);

    return { success: false, error };
  } finally {
    if (sqlite) {
      console.log("[Migration] Closing database connection");
      sqlite.close();
    }
  }
}

// Validate that database has the expected schema
export function validateDatabaseSchema(dbDir: string): DbResult<boolean> {
  console.log("[Schema] Validating database schema for:", dbDir);
  return withDb(dbDir, (db) => {
    try {
      // Check if the main tables exist by running a simple query
      // Note: migrations should have run in withDb, so all tables should exist
      console.log("[Schema] Checking banks table...");
      db.select().from(banks).limit(1).all();

      console.log("[Schema] Checking kits table...");
      db.select().from(kits).limit(1).all();

      console.log("[Schema] Checking voices table...");
      db.select().from(voices).limit(1).all();

      console.log("[Schema] Checking samples table...");
      db.select().from(samples).limit(1).all();

      console.log("[Schema] ✓ All tables validated successfully");
      return true;
    } catch (error) {
      console.error("[Schema] Database schema validation failed:", error);
      console.error("[Schema] Error type:", typeof error);
      console.error(
        "[Schema] Error message:",
        error instanceof Error ? error.message : String(error),
      );
      if (error instanceof Error && error.stack) {
        console.error("[Schema] Error stack:", error.stack);
      }
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

export function getKits(dbDir: string): DbResult<KitWithRelations[]> {
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
    return db
      .select()
      .from(samples)
      .where(eq(samples.kit_name, kitName))
      .orderBy(samples.voice_number, samples.slot_number)
      .all();
  });
}

// Non-compacting delete for undo operations
export function deleteSamplesWithoutCompaction(
  dbDir: string,
  kitName: string,
  filter?: { voiceNumber?: number; slotNumber?: number },
): DbResult<{ deletedSamples: Sample[] }> {
  return withDb(dbDir, (db) => {
    const conditions = [eq(samples.kit_name, kitName)];
    if (filter?.voiceNumber !== undefined) {
      conditions.push(eq(samples.voice_number, filter.voiceNumber));
    }
    if (filter?.slotNumber !== undefined) {
      conditions.push(eq(samples.slot_number, filter.slotNumber));
    }
    const whereCondition =
      conditions.length === 1 ? conditions[0] : and(...conditions);

    // Get samples that will be deleted for return value
    const samplesToDelete = db
      .select()
      .from(samples)
      .where(whereCondition)
      .all();

    // Delete the samples WITHOUT compaction
    db.delete(samples).where(whereCondition).run();

    return {
      deletedSamples: samplesToDelete,
    };
  });
}

export function deleteSamples(
  dbDir: string,
  kitName: string,
  filter?: { voiceNumber?: number; slotNumber?: number },
): DbResult<{ deletedSamples: Sample[]; affectedSamples: Sample[] }> {
  return withDb(dbDir, (db) => {
    const conditions = [eq(samples.kit_name, kitName)];

    if (filter?.voiceNumber !== undefined) {
      conditions.push(eq(samples.voice_number, filter.voiceNumber));
    }

    if (filter?.slotNumber !== undefined) {
      conditions.push(eq(samples.slot_number, filter.slotNumber));
    }

    const whereCondition =
      conditions.length === 1 ? conditions[0] : and(...conditions);

    // Get samples that will be deleted for return value
    const samplesToDelete = db
      .select()
      .from(samples)
      .where(whereCondition)
      .all();

    // Delete the samples
    db.delete(samples).where(whereCondition).run();

    // Auto-compact slots for each affected voice
    const affectedSamples: Sample[] = [];

    // Group deleted samples by voice to handle compaction
    const deletedByVoice = new Map<number, Sample[]>();
    for (const sample of samplesToDelete) {
      if (!deletedByVoice.has(sample.voice_number)) {
        deletedByVoice.set(sample.voice_number, []);
      }
      deletedByVoice.get(sample.voice_number)!.push(sample);
    }

    // Compact each affected voice
    for (const [voiceNumber, deletedSamplesInVoice] of deletedByVoice) {
      // Sort by slot_number to handle multiple deletions correctly
      const sortedDeleted = deletedSamplesInVoice.sort(
        (a, b) => a.slot_number - b.slot_number,
      );

      // Compact after each deletion, starting from the lowest slot
      for (let i = 0; i < sortedDeleted.length; i++) {
        const deletedSlot = sortedDeleted[i].slot_number - i; // Adjust for previous deletions
        const compactionResult = compactSlotsAfterDelete(
          dbDir,
          kitName,
          voiceNumber,
          deletedSlot,
        );

        if (compactionResult.success && compactionResult.data) {
          affectedSamples.push(...compactionResult.data);
        }
      }
    }

    return {
      deletedSamples: samplesToDelete,
      affectedSamples,
    };
  });
}

export function getAllSamples(dbDir: string): DbResult<any[]> {
  return withDb(dbDir, (db) => {
    return db.select().from(samples).all();
  });
}

export function getKit(
  dbDir: string,
  kitName: string,
): DbResult<KitWithRelations | null> {
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

// Task 5.3.1: Mark kit as modified when sample operations are performed
export function markKitAsModified(
  dbDir: string,
  kitName: string,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    db.update(kits)
      .set({ modified_since_sync: true })
      .where(eq(kits.name, kitName))
      .run();
  });
}

// Task 8.3.2: Clear modified flag after successful sync
export function markKitAsSynced(
  dbDir: string,
  kitName: string,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    db.update(kits)
      .set({ modified_since_sync: false })
      .where(eq(kits.name, kitName))
      .run();
  });
}

// Task 8.3.2: Clear modified flag for multiple kits after successful sync
export function markKitsAsSynced(
  dbDir: string,
  kitNames: string[],
): DbResult<void> {
  return withDb(dbDir, (db) => {
    // Update all kits in the provided list
    for (const kitName of kitNames) {
      db.update(kits)
        .set({ modified_since_sync: false })
        .where(eq(kits.name, kitName))
        .run();
    }
  });
}

// Task 22.1: Sample contiguity maintenance operations
export function compactSlotsAfterDelete(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  deletedSlot: number,
): DbResult<Sample[]> {
  return withDb(dbDir, (db) => {
    // Get all samples in this voice with slot_number > deletedSlot
    const samplesToShift = db
      .select()
      .from(samples)
      .where(
        and(
          eq(samples.kit_name, kitName),
          eq(samples.voice_number, voiceNumber),
          // Using gt would be better but using manual comparison for now
        ),
      )
      .all()
      .filter((sample) => sample.slot_number > deletedSlot)
      .sort((a, b) => a.slot_number - b.slot_number);

    // Shift each sample up by one slot
    const affectedSamples: Sample[] = [];
    for (const sample of samplesToShift) {
      const newSlotNumber = sample.slot_number - 1;

      db.update(samples)
        .set({ slot_number: newSlotNumber })
        .where(eq(samples.id, sample.id))
        .run();

      // Track the updated sample for return
      affectedSamples.push({
        ...sample,
        slot_number: newSlotNumber,
      });
    }

    return affectedSamples;
  });
}

// Task 22.2: Move sample with contiguity maintenance
export function moveSample(
  dbDir: string,
  kitName: string,
  fromVoice: number,
  fromSlot: number,
  toVoice: number,
  toSlot: number,
  mode: "insert" | "overwrite",
): DbResult<{
  movedSample: Sample;
  affectedSamples: (Sample & { original_slot_number: number })[];
  replacedSample?: Sample;
}> {
  return withDb(dbDir, (db) => {
    // Get the sample being moved
    const sampleToMove = db
      .select()
      .from(samples)
      .where(
        and(
          eq(samples.kit_name, kitName),
          eq(samples.voice_number, fromVoice),
          eq(samples.slot_number, fromSlot),
        ),
      )
      .get();

    if (!sampleToMove) {
      throw new Error(
        `Sample not found at voice ${fromVoice}, slot ${fromSlot}`,
      );
    }

    const affectedSamples: (Sample & { original_slot_number: number })[] = [];
    let replacedSample: Sample | undefined;

    if (mode === "insert") {
      // For same-voice moves, temporarily move the sample out of the way to avoid conflicts
      if (fromVoice === toVoice) {
        // Temporarily set the sample to a very high slot number to avoid conflicts
        const tempSlot = 999;
        db.update(samples)
          .set({ slot_number: tempSlot })
          .where(eq(samples.id, sampleToMove.id))
          .run();
      }

      // Now handle the shifting based on move direction
      const samplesToShift = db
        .select()
        .from(samples)
        .where(
          and(eq(samples.kit_name, kitName), eq(samples.voice_number, toVoice)),
        )
        .all()
        .filter(
          (sample) =>
            sample.slot_number >= toSlot && sample.id !== sampleToMove.id,
        )
        .sort((a, b) => b.slot_number - a.slot_number); // Sort descending to avoid conflicts

      for (const sample of samplesToShift) {
        const newSlotNumber = sample.slot_number + 1;

        db.update(samples)
          .set({ slot_number: newSlotNumber })
          .where(eq(samples.id, sample.id))
          .run();

        affectedSamples.push({
          ...sample,
          slot_number: newSlotNumber,
          original_slot_number: sample.slot_number, // Store original position for undo
        } as Sample & { original_slot_number: number });
      }

      // For same-voice moves, compact the source gap
      if (fromVoice === toVoice) {
        // Compact the gap left at fromSlot
        const samplesToCompact = db
          .select()
          .from(samples)
          .where(
            and(
              eq(samples.kit_name, kitName),
              eq(samples.voice_number, fromVoice),
            ),
          )
          .all()
          .filter(
            (sample) =>
              sample.slot_number > fromSlot && sample.id !== sampleToMove.id,
          )
          .sort((a, b) => a.slot_number - b.slot_number); // Sort ascending

        for (const sample of samplesToCompact) {
          const newSlotNumber = sample.slot_number - 1;
          db.update(samples)
            .set({ slot_number: newSlotNumber })
            .where(eq(samples.id, sample.id))
            .run();

          affectedSamples.push({
            ...sample,
            slot_number: newSlotNumber,
            original_slot_number: sample.slot_number,
          } as Sample & { original_slot_number: number });
        }

        // For forward moves, adjust the target slot since we compacted
        if (fromSlot < toSlot) {
          toSlot = toSlot - 1;
        }
      }
    } else if (mode === "overwrite") {
      // Check if there's a sample to replace
      replacedSample = db
        .select()
        .from(samples)
        .where(
          and(
            eq(samples.kit_name, kitName),
            eq(samples.voice_number, toVoice),
            eq(samples.slot_number, toSlot),
          ),
        )
        .get();

      // Delete the replaced sample if it exists
      if (replacedSample) {
        db.delete(samples).where(eq(samples.id, replacedSample.id)).run();
      }
    }

    // Move the sample to its new position
    db.update(samples)
      .set({
        voice_number: toVoice,
        slot_number: toSlot,
      })
      .where(eq(samples.id, sampleToMove.id))
      .run();

    const movedSample = {
      ...sampleToMove,
      voice_number: toVoice,
      slot_number: toSlot,
    };

    // Compact the source voice if needed
    if (mode === "insert") {
      // For same-voice moves, compaction was already handled above during the move
      // For cross-voice moves, always compact the source voice to fill the gap
      if (fromVoice !== toVoice) {
        const compactionResult = compactSlotsAfterDelete(
          dbDir,
          kitName,
          fromVoice,
          fromSlot,
        );
        if (compactionResult.success && compactionResult.data) {
          // Map compaction results to include original slot numbers
          const compactedSamples = compactionResult.data.map((sample) => ({
            ...sample,
            original_slot_number: sample.slot_number + 1, // They were shifted up by 1 during compaction
          }));
          affectedSamples.push(...compactedSamples);
        }
      }
    }

    return {
      movedSample,
      affectedSamples,
      replacedSample,
    };
  });
}

// Task 20.1.1: Favorites system functions
export function toggleKitFavorite(
  dbDir: string,
  kitName: string,
): DbResult<{ is_favorite: boolean }> {
  return withDb(dbDir, (db) => {
    // Get current favorite status
    const kit = db
      .select({ is_favorite: kits.is_favorite })
      .from(kits)
      .where(eq(kits.name, kitName))
      .get();

    if (!kit) {
      throw new Error(`Kit ${kitName} not found`);
    }

    const newFavoriteStatus = !kit.is_favorite;

    // Update favorite status
    db.update(kits)
      .set({ is_favorite: newFavoriteStatus })
      .where(eq(kits.name, kitName))
      .run();

    return { is_favorite: newFavoriteStatus };
  });
}

export function setKitFavorite(
  dbDir: string,
  kitName: string,
  isFavorite: boolean,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    const result = db
      .update(kits)
      .set({ is_favorite: isFavorite })
      .where(eq(kits.name, kitName))
      .run();

    if (result.changes === 0) {
      throw new Error(`Kit ${kitName} not found`);
    }
  });
}

export function getFavoriteKits(dbDir: string): DbResult<KitWithRelations[]> {
  return withDb(dbDir, (db) => {
    return db
      .select()
      .from(kits)
      .leftJoin(banks, eq(kits.bank_letter, banks.letter))
      .where(eq(kits.is_favorite, true))
      .orderBy(kits.name)
      .all()
      .map((row) => ({
        ...row.kits,
        bank: row.banks,
      }));
  });
}

export function getFavoriteKitsCount(dbDir: string): DbResult<number> {
  return withDb(dbDir, (db) => {
    const result = db
      .select()
      .from(kits)
      .where(eq(kits.is_favorite, true))
      .all();

    return result.length;
  });
}
