// Drizzle schema definitions for Romper Database
import { relations } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";
// Using text({ mode: 'json' }) for step patterns - much simpler than custom encoding!

import type { SliceStep } from "../sliceTypes";
import type { KitStereoPlan } from "../stereoLinkRules";

// Banks table - contains artist metadata for each bank (A-Z)
export const banks = sqliteTable("banks", {
  artist: text("artist"), // The bank's name, its only owner; name files are written from it (#567)
  letter: text("letter").primaryKey(), // A, B, C, etc.
  rtf_filename: text("rtf_filename"), // The name file written for it: "<L> - <name>.rtf"
  scanned_at: integer("scanned_at", { mode: "timestamp" }), // When setup imported the name (older stores: the last bank scan)
});

// Kits table - main table for kit information
export const kits = sqliteTable("kits", {
  alias: text("alias"), // Optional human-readable name
  bank_letter: text("bank_letter").references(() => banks.letter), // FK to banks.letter (derived from kit name)
  bpm: integer("bpm").notNull().default(120), // BPM setting for step sequencer (30-180)
  editable: integer("editable", { mode: "boolean" }).notNull().default(false), // New architecture: editable mode
  is_favorite: integer("is_favorite", { mode: "boolean" })
    .notNull()
    .default(false), // Task 20.1.1: Favorites system
  locked: integer("locked", { mode: "boolean" }).notNull().default(false), // Kit locking for protection
  modified_since_sync: integer("modified_since_sync", { mode: "boolean" })
    .notNull()
    .default(false), // Task 5.3: Track if kit modified since last sync
  name: text("name").primaryKey(), // Natural key (A0, B1, etc.)
  slice_steps: text("slice_steps", { mode: "json" }).$type<
    (null | SliceStep)[][] | null
  >(), // JSON storage for slicer data (4 voices x 16 steps)
  slicer_division: integer("slicer_division").notNull().default(16), // Kit-wide slice count; whether the Rample's SLICER is per kit or per voice is unverified (#617)
  step_pattern: text("step_pattern", { mode: "json" }).$type<
    null | number[][]
  >(), // JSON storage for step patterns
  trigger_conditions: text("trigger_conditions", { mode: "json" }).$type<
    (null | string)[][] | null
  >(), // JSON storage for A:B trigger conditions (4 voices x 16 steps)
});

// Voices table - each kit has exactly 4 voices
export const voices = sqliteTable(
  "voices",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    kit_name: text("kit_name")
      .notNull()
      .references(() => kits.name), // FK to kits.name
    sample_mode: text("sample_mode").notNull().default("first"), // "first" | "random" | "round-robin"
    slice_enabled: integer("slice_enabled", { mode: "boolean" })
      .notNull()
      .default(false), // Sequencer slice mode for this voice
    slice_max_length: integer("slice_max_length").notNull().default(2), // Max slices when varying length (1, 2, 4, 8)
    slice_roll_amount: integer("slice_roll_amount").notNull().default(100), // Percent of eligible steps a roll changes
    slice_vary_length: integer("slice_vary_length", { mode: "boolean" })
      .notNull()
      .default(false), // Rolls and live-random steps also vary slice length
    stereo_choice: text("stereo_choice").$type<"mono" | "stereo">(), // The user's own stereo choice (#537): "stereo" linked by hand, "mono" Keep mono or unlinked; null lets Romper link automatically
    stereo_mode: integer("stereo_mode", { mode: "boolean" })
      .notNull()
      .default(false), // Stereo is a voice setting: true links this voice with the next as a stereo pair; samples carry no stereo flag
    voice_alias: text("voice_alias"), // Optional user-defined voice name
    voice_number: integer("voice_number").notNull(), // 1-4, explicit voice tracking
    voice_volume: integer("voice_volume").notNull().default(100), // 0-100 volume level
  },
  (table) => [
    // Unique constraint: one row per kit/voice, so reads and updates can't
    // pick between duplicates (#510)
    unique("unique_voice").on(table.kit_name, table.voice_number),
  ],
);

// Samples table - sample files assigned to voice slots
export const samples = sqliteTable(
  "samples",
  {
    filename: text("filename").notNull(), // Sample filename
    gain_db: real("gain_db").notNull().default(0), // Per-sample gain trim in dB (-24 to +12, 0 = unity)
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    kit_name: text("kit_name")
      .notNull()
      .references(() => kits.name), // FK to kits.name
    slot_number: integer("slot_number").notNull(), // 0-11 ZERO-BASED, slot within voice (slot 1 = slot_number 0)
    source_path: text("source_path").notNull(), // NEW: Absolute path to original sample file for reference-only management
    source_status: text("source_status").$type<SampleSourceStatus>(), // What Romper found when it last read the file (#537): "readable", "unreadable" (a WAV it can't read) or "missing"; null until it's read
    voice_number: integer("voice_number").notNull(), // 1-4, explicit voice assignment
    wav_bit_depth: integer("wav_bit_depth"), // Optional WAV metadata - bit depth (8, 16, 24, 32)
    wav_bitrate: integer("wav_bitrate"), // Optional WAV metadata
    wav_channels: integer("wav_channels"), // Optional WAV metadata - channel count (1=mono, 2=stereo)
    wav_format_tag: integer("wav_format_tag"), // Optional WAV metadata - the fmt chunk's format tag (1 PCM, 3 float, 0xFFFE extensible; #576)
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
export type DbKitsResult = DbResult<Kit[]>;

// Database operation result wrapper
export interface DbResult<T = unknown> {
  data?: T;
  error?: string;
  success: boolean;
}
export type DbSamplesResult = DbResult<Sample[]>;

export type DbVoicesResult = DbResult<Voice[]>;

export type Kit = typeof kits.$inferSelect;
/**
 * A kit as an edit to it left it, without its samples: what main returns
 * from an edit to the kit's own fields or voices, so the renderer patches
 * the kit instead of reading it again (#452)
 */
export type KitEdit = Omit<KitWithRelations, "samples">;

export interface KitScanMissingSample {
  filename: string;
  slotNumber: number;
  sourcePath: string;
  voiceNumber: number;
}

/**
 * Outcome of scanning one kit folder into the database (RE-04).
 *
 * A scan merges: it never deletes rows or changes a row's slot, voice, gain
 * or source path. Missing files are reported, not removed. A locked kit is
 * left untouched (`locked: true`, all counts zero).
 */
export interface KitScanResult {
  /** New sample rows created for WAV files not yet referenced by the kit */
  addedSamples: number;
  /** True when the kit is locked and the scan made no changes */
  locked: boolean;
  /** Existing rows whose missing WAV metadata was filled in */
  metadataUpdated: number;
  /** Existing rows whose source file no longer exists (rows are kept) */
  missingSamples: KitScanMissingSample[];
  /** Voice-prefixed WAV files found in the kit folder */
  scannedSamples: number;
  /** Folder files that were not added, and why */
  skippedFiles: KitScanSkippedFile[];
  /**
   * What the stereo rules make of the kit (#537): for setup, the links it
   * made (`autoLinks`); for a scan, which changes no link, the links the
   * next write will make. Mixdowns and quarantine either way. Absent for a
   * locked kit, which a scan leaves alone.
   */
  stereo?: KitStereoPlan;
  /** Voices whose empty name was filled in from a filename */
  updatedVoices: number;
}

export interface KitScanSkippedFile {
  filename: string;
  /** kit_editable: user kits own their sample list; voice_full: 12 samples already */
  reason: "kit_editable" | "voice_full";
  voiceNumber: number;
}

// Kit validation types
export interface KitValidationError {
  extraFiles: string[];
  kitName: string;
  missingFiles: string[];
}

// Kit with relations as returned by database queries
export type KitWithRelations = {
  bank?: Bank | null;
  /**
   * The kit breaks a stereo pair or holds a WAV Romper can't read, so it
   * isn't written to the card until it's fixed (#537 rule 4). Main works
   * it out from the stored samples and voices.
   */
  quarantined?: boolean;
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

/**
 * What Romper found when it last read a sample's source file (#537):
 * readable, a WAV it can't read, or missing. Null until it's read.
 */
export type SampleSourceStatus = "missing" | "readable" | "unreadable";

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
