// Drizzle schema definitions for Romper Database
import { relations } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
// Using text({ mode: 'json' }) for step patterns - much simpler than custom encoding!

// Banks table - contains artist metadata for each bank (A-Z)
export const banks = sqliteTable("banks", {
  artist: text("artist"), // Artist name extracted from RTF filename
  letter: text("letter").primaryKey(), // A, B, C, etc.
  rtf_filename: text("rtf_filename"), // Original RTF filename for reference
  scanned_at: integer("scanned_at", { mode: "timestamp" }), // When bank was last scanned
});

// Kits table - main table for kit information
export const kits = sqliteTable("kits", {
  alias: text("alias"), // Optional human-readable name
  artist: text("artist"), // DEPRECATED: Use bank.artist instead, kept for migration
  bank_letter: text("bank_letter").references(() => banks.letter), // FK to banks.letter (derived from kit name)
  editable: integer("editable", { mode: "boolean" }).notNull().default(false), // New architecture: editable mode
  is_favorite: integer("is_favorite", { mode: "boolean" })
    .notNull()
    .default(false), // Task 20.1.1: Favorites system
  locked: integer("locked", { mode: "boolean" }).notNull().default(false), // Kit locking for protection
  modified_since_sync: integer("modified_since_sync", { mode: "boolean" })
    .notNull()
    .default(false), // Task 5.3: Track if kit modified since last sync
  name: text("name").primaryKey(), // Natural key (A0, B1, etc.)
  step_pattern: text("step_pattern", { mode: "json" }).$type<
    null | number[][]
  >(), // JSON storage for step patterns
});

// Voices table - each kit has exactly 4 voices
export const voices = sqliteTable("voices", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  kit_name: text("kit_name")
    .notNull()
    .references(() => kits.name), // FK to kits.name
  voice_alias: text("voice_alias"), // Optional user-defined voice name
  voice_number: integer("voice_number").notNull(), // 1-4, explicit voice tracking
});

// Samples table - sample files assigned to voice slots
export const samples = sqliteTable(
  "samples",
  {
    filename: text("filename").notNull(), // Sample filename
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    is_stereo: integer("is_stereo", { mode: "boolean" })
      .notNull()
      .default(false),
    kit_name: text("kit_name")
      .notNull()
      .references(() => kits.name), // FK to kits.name
    slot_number: integer("slot_number").notNull(), // 0-11 ZERO-BASED, slot within voice (slot 1 = slot_number 0)
    source_path: text("source_path").notNull(), // NEW: Absolute path to original sample file for reference-only management
    voice_number: integer("voice_number").notNull(), // 1-4, explicit voice assignment
    wav_bitrate: integer("wav_bitrate"), // Optional WAV metadata
    wav_sample_rate: integer("wav_sample_rate"), // Optional WAV metadata
  },
  (table) => [
    // Unique constraint: only one sample per kit/voice/slot combination
    unique("unique_slot").on(
      table.kit_name,
      table.voice_number,
      table.slot_number,
    ),
    // Unique constraint: prevent duplicate source paths within the same voice
    unique("unique_voice_source").on(
      table.kit_name,
      table.voice_number,
      table.source_path,
    ),
  ],
);

// Export types inferred from schema
export type Bank = typeof banks.$inferSelect;
// More specific database result types
export interface DbKitsResult extends DbResult<Kit[]> {}

// Database operation result wrapper
export interface DbResult<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}
export interface DbSamplesResult extends DbResult<Sample[]> {}

export interface DbVoicesResult extends DbResult<Voice[]> {}
export type Kit = typeof kits.$inferSelect;

// Kit validation types
export interface KitValidationError {
  extraFiles: string[];
  kitName: string;
  missingFiles: string[];
}
// Kit with relations as returned by database queries
export type KitWithRelations = {
  bank?: Bank | null;
  samples?: Sample[];
  voices?: Voice[];
} & Kit;

export interface LocalStoreValidationDetailedResult {
  error?: string;
  errors?: KitValidationError[];
  errorSummary?: string;
  hasLocalStore?: boolean;
  isCriticalEnvironmentError?: boolean;
  isEnvironmentOverride?: boolean;
  isValid: boolean;
  localStorePath?: null | string;
  romperDbPath?: string;
}

export type NewBank = typeof banks.$inferInsert;

export type NewKit = typeof kits.$inferInsert;
export type NewSample = typeof samples.$inferInsert;
export type NewVoice = typeof voices.$inferInsert;

export type Sample = typeof samples.$inferSelect;

export type Voice = typeof voices.$inferSelect;

// Relations (for Drizzle query capabilities)
export const banksRelations = relations(banks, ({ many }) => ({
  kits: many(kits),
}));

export const kitsRelations = relations(kits, ({ many, one }) => ({
  bank: one(banks, {
    fields: [kits.bank_letter],
    references: [banks.letter],
  }),
  samples: many(samples),
  voices: many(voices),
}));

export const voicesRelations = relations(voices, ({ many, one }) => ({
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
