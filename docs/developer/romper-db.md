<!-- 
layout: default
title: Database Schema
-->

# Romper Database Schema

The Romper SQLite database is created in the `.romperdb` folder inside the local store. The schema is implemented using **Drizzle ORM** with **better-sqlite3** for type safety and synchronous access.

## Tables

### banks

Stores artist metadata for each bank (A-Z).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| letter | TEXT | PRIMARY KEY | Bank letter (A-Z) |
| artist | TEXT | nullable | Artist name extracted from RTF filename |
| rtf_filename | TEXT | nullable | Original RTF filename for reference |
| scanned_at | INTEGER | nullable | Unix timestamp of last bank scan |

Pre-populated with all 26 letters (A-Z) during initial migration.

### kits

Central table for kit configurations and sequencer state.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| name | TEXT | PRIMARY KEY | Natural key (A0, B1, etc.) matching Rample naming |
| alias | TEXT | nullable | Human-readable custom name |
| bank_letter | TEXT | FK → banks.letter, nullable | Bank assignment |
| bpm | INTEGER | NOT NULL, default 120 | Step sequencer BPM (30-180) |
| editable | BOOLEAN | NOT NULL, default false | Whether kit can be modified |
| is_favorite | BOOLEAN | NOT NULL, default false | Favorites system flag |
| locked | BOOLEAN | NOT NULL, default false | Protection against accidental edits |
| modified_since_sync | BOOLEAN | NOT NULL, default false | Tracks changes since last SD card sync |
| slice_steps | TEXT (JSON) | nullable | Sequencer slicer: 4 voices x 16 steps of `{ start, length, random, locked }` in ticks of 384 per sample (null = sequential default) |
| slicer_division | INTEGER | NOT NULL, default 16 | Kit-wide slice count (8, 12, 16, 24, 32, 48, 64, 128), like the Rample's SLICER setting |
| step_pattern | TEXT (JSON) | nullable | 4 voices x 16 steps pattern grid |
| trigger_conditions | TEXT (JSON) | nullable | A:B trigger conditions per step |

### voices

Per-voice settings within a kit. Each kit always has exactly 4 voice records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique identifier |
| kit_name | TEXT | NOT NULL, FK → kits.name | Kit this voice belongs to |
| voice_number | INTEGER | NOT NULL | Voice identifier (1-4) |
| voice_alias | TEXT | nullable | User-defined name (e.g., "Kick") |
| sample_mode | TEXT | NOT NULL, default "first" | "first", "random", or "round-robin" |
| slice_enabled | BOOLEAN | NOT NULL, default false | Sequencer slice mode for this voice |
| slice_max_length | INTEGER | NOT NULL, default 2 | Longest random slice length when varying length (1, 2, 4, 8) |
| slice_roll_amount | INTEGER | NOT NULL, default 100 | Percent of eligible steps a roll changes (25, 50, 75, 100) |
| slice_vary_length | BOOLEAN | NOT NULL, default false | Rolls and random steps also vary slice length |
| stereo_mode | BOOLEAN | NOT NULL, default false | Stereo pair mode |
| voice_volume | INTEGER | NOT NULL, default 100 | Per-voice volume (0-100) |

### samples

Individual sample file assignments to voice slots.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique identifier |
| kit_name | TEXT | NOT NULL, FK → kits.name | Kit this sample belongs to |
| voice_number | INTEGER | NOT NULL | Voice (1-4) |
| slot_number | INTEGER | NOT NULL | Slot position (0-11, zero-based) |
| filename | TEXT | NOT NULL | Filename for SD card |
| source_path | TEXT | NOT NULL | Absolute path to original file |
| gain_db | REAL | NOT NULL, default 0.0 | Per-sample gain trim (-24 to +12 dB) |
| wav_bit_depth | INTEGER | nullable | WAV metadata: 8, 16, 24, or 32 bits |
| wav_channels | INTEGER | nullable | WAV metadata: 1 (mono) or 2 (stereo) |
| wav_sample_rate | INTEGER | nullable | WAV metadata: e.g., 44100 Hz |
| wav_bitrate | INTEGER | nullable | WAV metadata: bits per second |

**Unique constraints:**
- `(kit_name, voice_number, slot_number)` — one sample per slot
- `(kit_name, voice_number, source_path)` — no duplicate sources within a voice

## Relationships

- **banks** (1) → **kits** (many) via `kits.bank_letter` → `banks.letter`
- **kits** (1) → **voices** (4) — each kit always has exactly 4 voices
- **kits** (1) → **samples** (up to 48) — 4 voices x 12 slots max
- **voices** (1) → **samples** (up to 12) via composite `(kit_name, voice_number)`

## Key Design Decisions

- **Natural keys**: Kit names (A0, B1) as primary keys matching Rample hardware naming
- **Reference-only storage**: `source_path` stores absolute path to original file — files are never copied locally, only during SD card sync
- **Explicit voice tracking**: `voice_number` (1-4) stored explicitly, never inferred from position
- **Zero-based slots**: Database uses 0-11; UI displays as 1-12
- **Synchronous access**: better-sqlite3 provides synchronous operations (no async/await needed for DB calls)

## Schema Source

Defined in `shared/db/schema.ts` using Drizzle ORM. Migrations in `electron/main/db/migrations/`.

---

_Last updated: 2026-04-09_
