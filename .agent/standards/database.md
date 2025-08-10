# Database Standards (Drizzle ORM)

## Synchronous Driver (CRITICAL)

ALWAYS use terminal methods (.get(), .all(), .run(), .values()). NO await:

```typescript
// ✅ CORRECT: Terminal method, no await
function getKit(kitName: string): DbResult<Kit> {
  return withDb((db) => {
    const kit = db
      .select()
      .from(kitsTable)
      .where(eq(kitsTable.name, kitName))
      .get();
    return kit
      ? { success: true, data: kit }
      : { success: false, error: "Kit not found" };
  });
}

// ❌ WRONG: Missing terminal method or using await
const kit = db.select().from(kitsTable); // Missing .get()
const kit2 = await db.select().from(kitsTable).get(); // Don't use await
```

## DbResult Pattern (REQUIRED)

### Consistent Error Handling

```typescript
// ✅ ALWAYS use DbResult<T> wrapper
type DbResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function addSample(
  kitName: string,
  sourcePath: string,
  voiceNumber: number,
  slotNumber: number,
): Promise<DbResult<Sample>> {
  return withDb((db) => {
    try {
      const sample = {
        kitName,
        sourcePath,
        filename: path.basename(sourcePath),
        voiceNumber,
        slotNumber,
        isStereo: false, // Determine from file analysis
      };

      const result = db.insert(samplesTable).values(sample).returning().get();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Database operation failed",
      };
    }
  });
}

// ❌ WRONG: Raw return without error handling
function badAddSample(sample: Sample) {
  return db.insert(samplesTable).values(sample).returning().get(); // May throw
}
```

## Connection Management

### WithDb Pattern (REQUIRED)

```typescript
// ✅ CORRECT: Use connection wrapper for all operations
function withDb<T>(operation: (db: BetterSQLite3Database) => T): T {
  const db = getDatabase();
  try {
    return operation(db);
  } catch (error) {
    logger.error("Database operation failed:", error);
    throw error;
  }
  // SQLite connections are automatically managed
}

// Usage in all database functions
function getAllKits(): DbResult<Kit[]> {
  return withDb((db) => {
    const kits = db.select().from(kitsTable).all();
    return { success: true, data: kits };
  });
}
```

## Schema Definition Patterns

### Type-Safe Schema

```typescript
// ✅ CORRECT: Proper Drizzle schema with constraints
export const kitsTable = sqliteTable("kits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(), // Natural key (A0, B1, etc.)
  alias: text("alias"),
  artist: text("artist"),
  editable: integer("editable", { mode: "boolean" }).notNull().default(false),
  stepPattern: text("step_pattern"), // JSON format for XOX sequencer
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const samplesTable = sqliteTable("samples", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kitName: text("kit_name")
    .notNull()
    .references(() => kitsTable.name), // Natural key reference
  voiceNumber: integer("voice_number").notNull().$type<1 | 2 | 3 | 4>(), // Constrained type
  slotNumber: integer("slot_number")
    .notNull()
    .$type<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12>(),
  sourcePath: text("source_path").notNull(), // Reference-only architecture
  filename: text("filename").notNull(),
  isStereo: integer("is_stereo", { mode: "boolean" }).notNull().default(false),
});

// Type inference from schema
export type Kit = InferSelectModel<typeof kitsTable>;
export type NewKit = InferInsertModel<typeof kitsTable>;
export type Sample = InferSelectModel<typeof samplesTable>;
export type NewSample = InferInsertModel<typeof samplesTable>;
```

## Transaction Patterns

### Batch Operations

```typescript
// ✅ CORRECT: Use transactions for batch operations
function addMultipleSamples(
  kitName: string,
  samples: Array<{ path: string; voice: number; slot: number }>,
): DbResult<void> {
  return withDb((db) => {
    try {
      db.transaction(() => {
        for (const sample of samples) {
          db.insert(samplesTable)
            .values({
              kitName,
              sourcePath: sample.path,
              filename: path.basename(sample.path),
              voiceNumber: sample.voice,
              slotNumber: sample.slot,
            })
            .run();
        }
      })();

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Batch operation failed",
      };
    }
  });
}

// ❌ WRONG: Individual operations without transaction
function badAddSamples(samples: Sample[]) {
  for (const sample of samples) {
    db.insert(samplesTable).values(sample).run(); // Separate transactions
  }
}
```

## Query Optimization

### Efficient Queries

```typescript
// ✅ CORRECT: Efficient join queries
function getKitWithSamples(
  kitName: string,
): DbResult<Kit & { samples: Sample[] }> {
  return withDb((db) => {
    const kit = db
      .select()
      .from(kitsTable)
      .where(eq(kitsTable.name, kitName))
      .get();

    if (!kit) {
      return { success: false, error: `Kit not found: ${kitName}` };
    }

    const samples = db
      .select()
      .from(samplesTable)
      .where(eq(samplesTable.kitName, kitName))
      .orderBy(samplesTable.voiceNumber, samplesTable.slotNumber)
      .all();

    return { success: true, data: { ...kit, samples } };
  });
}

// ❌ WRONG: N+1 query pattern
function badGetKitsWithSamples() {
  const kits = db.select().from(kitsTable).all();

  for (const kit of kits) {
    // N+1 query problem - separate query for each kit
    kit.samples = db
      .select()
      .from(samplesTable)
      .where(eq(samplesTable.kitName, kit.name))
      .all();
  }

  return kits;
}
```

## Anti-Patterns to Avoid

### SQL Injection Vulnerabilities

```typescript
// ❌ AVOID: String concatenation (SQL injection risk)
function badGetKit(kitName: string) {
  const query = `SELECT * FROM kits WHERE name = '${kitName}'`; // DANGEROUS
  return db.exec(query);
}

// ✅ CORRECT: Use Drizzle's query builder
function goodGetKit(kitName: string) {
  return db.select().from(kitsTable).where(eq(kitsTable.name, kitName)).get();
}
```

### Missing Error Handling

```typescript
// ❌ AVOID: Operations without error handling
function badDbOperation() {
  return db.select().from(kitsTable).all(); // May throw
}

// ✅ CORRECT: Wrap in DbResult pattern
function goodDbOperation(): DbResult<Kit[]> {
  return withDb((db) => {
    const kits = db.select().from(kitsTable).all();
    return { success: true, data: kits };
  });
}
```

## Quick Validation Checklist

- [ ] All queries use terminal methods (.get(), .all(), .run(), .values())
- [ ] No await with synchronous better-sqlite3 driver
- [ ] All operations wrapped in withDb() pattern
- [ ] All functions return DbResult<T> type
- [ ] Batch operations use transactions
- [ ] Schema uses proper constraints and types
- [ ] No string concatenation for queries
- [ ] Foreign keys reference natural keys (kit names)
- [ ] sourcePath field used for reference-only architecture

---

_These standards apply to database operations in `\*\*/db/_.ts` files using Drizzle ORM with better-sqlite3.\*
