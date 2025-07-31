// Drizzle schema definitions for Romper Database
import { relations } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
// Using text({ mode: 'json' }) for step patterns - much simpler than custom encoding!

// Banks table - contains artist metadata for each bank (A-Z)
export const banks = sqliteTable("banks", {
  letter: text("letter").primaryKey(), // A, B, C, etc.
  artist: text("artist"), // Artist name extracted from RTF filename
  rtf_filename: text("rtf_filename"), // Original RTF filename for reference
  scanned_at: integer("scanned_at", { mode: "timestamp" }), // When bank was last scanned
});

// Kits table - main table for kit information
export const kits = sqliteTable("kits", {
  name: text("name").primaryKey(), // Natural key (A0, B1, etc.)
  bank_letter: text("bank_letter").references(() => banks.letter), // FK to banks.letter (derived from kit name)
  alias: text("alias"), // Optional human-readable name
  artist: text("artist"), // DEPRECATED: Use bank.artist instead, kept for migration
  editable: integer("editable", { mode: "boolean" }).notNull().default(false), // New architecture: editable mode
  locked: integer("locked", { mode: "boolean" }).notNull().default(false), // Kit locking for protection
  step_pattern: text("step_pattern", { mode: "json" }).$type<
    number[][] | null
  >(), // JSON storage for step patterns
  modified_since_sync: integer("modified_since_sync", { mode: "boolean" })
    .notNull()
    .default(false), // Task 5.3: Track if kit modified since last sync
});

// Voices table - each kit has exactly 4 voices
export const voices = sqliteTable("voices", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  kit_name: text("kit_name")
    .notNull()
    .references(() => kits.name), // FK to kits.name
  voice_number: integer("voice_number").notNull(), // 1-4, explicit voice tracking
  voice_alias: text("voice_alias"), // Optional user-defined voice name
});

// Samples table - sample files assigned to voice slots
export const samples = sqliteTable(
  "samples",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    kit_name: text("kit_name")
      .notNull()
      .references(() => kits.name), // FK to kits.name
    filename: text("filename").notNull(), // Sample filename
    voice_number: integer("voice_number").notNull(), // 1-4, explicit voice assignment
    slot_number: integer("slot_number").notNull(), // 1-12, slot within voice
    source_path: text("source_path").notNull(), // NEW: Absolute path to original sample file for reference-only management
    is_stereo: integer("is_stereo", { mode: "boolean" })
      .notNull()
      .default(false),
    wav_bitrate: integer("wav_bitrate"), // Optional WAV metadata
    wav_sample_rate: integer("wav_sample_rate"), // Optional WAV metadata
  },
  (table) => ({
    // Unique constraint: only one sample per kit/voice/slot combination
    unique_slot: unique().on(
      table.kit_name,
      table.voice_number,
      table.slot_number,
    ),
    // Unique constraint: prevent duplicate source paths within the same voice
    unique_voice_source: unique().on(
      table.kit_name,
      table.voice_number,
      table.source_path,
    ),
  }),
);

// Export types inferred from schema
export type Bank = typeof banks.$inferSelect;
export type NewBank = typeof banks.$inferInsert;

export type Kit = typeof kits.$inferSelect;
export type NewKit = typeof kits.$inferInsert;

export type Voice = typeof voices.$inferSelect;
export type NewVoice = typeof voices.$inferInsert;

export type Sample = typeof samples.$inferSelect;
export type NewSample = typeof samples.$inferInsert;

// Kit with relations as returned by database queries
export type KitWithRelations = Kit & {
  voices?: Voice[];
  samples?: Sample[];
  bank?: Bank | null;
};

// Database operation result wrapper
export interface DbResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// More specific database result types
export interface DbKitsResult extends DbResult<Kit[]> {}
export interface DbSamplesResult extends DbResult<Sample[]> {}
export interface DbVoicesResult extends DbResult<Voice[]> {}

// Kit validation types
export interface KitValidationError {
  kitName: string;
  missingFiles: string[];
  extraFiles: string[];
}

export interface LocalStoreValidationDetailedResult {
  isValid: boolean;
  errors?: KitValidationError[];
  errorSummary?: string;
  error?: string;
  romperDbPath?: string;
  hasLocalStore?: boolean;
  localStorePath?: string | null;
}

// Relations (for Drizzle query capabilities)
export const banksRelations = relations(banks, ({ many }) => ({
  kits: many(kits),
}));

export const kitsRelations = relations(kits, ({ one, many }) => ({
  bank: one(banks, {
    fields: [kits.bank_letter],
    references: [banks.letter],
  }),
  voices: many(voices),
  samples: many(samples),
}));

export const voicesRelations = relations(voices, ({ one, many }) => ({
  kit: one(kits, {
    fields: [voices.kit_name],
    references: [kits.name],
  }),
  samples: many(samples),
}));

export const samplesRelations = relations(samples, ({ one }) => ({
  kit: one(kits, {
    fields: [samples.kit_name],
    references: [kits.name],
  }),
  voice: one(voices, {
    fields: [samples.kit_name, samples.voice_number],
    references: [voices.kit_name, voices.voice_number],
  }),
}));
