<!-- 
layout: default
title: Database Schema
-->

# Romper Database Schema

The Romper SQLite database is `romper.sqlite`, in the `.romperdb` folder inside the local store. The schema is implemented using **Drizzle ORM** with **better-sqlite3** for type safety and synchronous access.

## Tables

### banks

Stores artist metadata for each bank (A-Z).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| letter | TEXT | PRIMARY KEY | Bank letter (A-Z) |
| artist | TEXT | nullable | The bank's name, and its only owner (#567): set by a rename, or at setup from a card's or the factory archive's name files. The store's and the card's `<L> - <name>.rtf` files are written from it |
| rtf_filename | TEXT | nullable | The name file written for it, `<L> - <name>.rtf` |
| scanned_at | INTEGER | nullable | Unix timestamp of setup's import of the name (in stores from before #567, of the last bank scan) |

Pre-populated with all 26 letters (A-Z) by migration `0001`.

### kits

Central table for kit configurations and sequencer state.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| name | TEXT | PRIMARY KEY | Natural key (A0, B1, etc.) matching Rample naming |
| alias | TEXT | nullable | Human-readable custom name |
| bank_letter | TEXT | FK → banks.letter, nullable | Bank assignment |
| bpm | INTEGER | NOT NULL, default 120 | Step sequencer BPM (30-180) |
| editable | BOOLEAN | NOT NULL, default false | Whether kit can be modified (kits created or duplicated in the app start editable; kits imported at setup don't) |
| is_favorite | BOOLEAN | NOT NULL, default false | Favorites system flag |
| locked | BOOLEAN | NOT NULL, default false | Protection against accidental edits. Scan leaves a locked kit alone and delete refuses it, but nothing in the UI sets this yet |
| modified_since_sync | BOOLEAN | NOT NULL, default false | Tracks changes since last SD card sync |
| slice_steps | TEXT (JSON) | nullable | Sequencer slicer: 4 voices x 16 steps of `{ start, length, random, locked }` in ticks of 384 per sample (null = sequential default) |
| slicer_division | INTEGER | NOT NULL, default 16 | Kit-wide slice count (8, 12, 16, 24, 32, 48, 64, 128); whether the Rample's SLICER is per kit or per voice is unverified (#617) |
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
| stereo_mode | BOOLEAN | NOT NULL, default false | Links this voice with the next as a stereo pair. Stereo is a voice setting: samples have no stereo flag (`samples.is_stereo` was dropped in migration `0013`, RE-69) |
| stereo_choice | TEXT | nullable | The user's own stereo choice (#537): `stereo` after linking by hand or **Link** on a drop, `mono` after **Keep mono** or an unlink; null lets setup and the write link the voice automatically. Migration `0014` set it to `stereo` on voices already linked |
| voice_volume | INTEGER | NOT NULL, default 100 | Per-voice volume (0-100) |

**Unique constraints:**
- `(kit_name, voice_number)` — one row per voice (`unique_voice`, #510).
  Code that may be first to touch a voice inserts with
  `onConflictDoNothing` (or `onConflictDoUpdate`) on these columns rather
  than checking first. Migration `0015` merged any duplicates older
  libraries had before adding it: of each set it kept the row with the most
  settings that differ from their defaults, the oldest row on a tie. No
  other table refers to a voice by `id`.

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
- **Reference-only storage**: `source_path` stores the absolute path to the original file. Samples the user adds are never copied into the local store; files are copied only to the SD card when it's written. (Setup copies the SD card's or factory archive's kit folders into the store once, and their rows point at those copies.)
- **Explicit voice tracking**: `voice_number` (1-4) stored explicitly, never inferred from position
- **Zero-based slots**: Database uses 0-11; UI displays as 1-12
- **Synchronous access**: better-sqlite3 provides synchronous operations (no async/await needed for DB calls)

## Schema Source

Defined in `shared/db/schema.ts` using Drizzle ORM. Migrations in `electron/main/db/migrations/`.

## Migrations and upgrades

A store's schema is brought up to date when Romper opens its connection, once
per connection (`migrateDatabase` in `electron/main/db/utils/dbMigrations.ts`,
called from `connect` in `dbUtilities.ts`). A new store
(`createRomperDbFile`) gets its whole schema the same way.

- **All or nothing.** The history repair (below) and every pending migration
  run in one `BEGIN IMMEDIATE` transaction. If a statement fails or the app
  is interrupted, SQLite rolls the whole upgrade back, so the store stays at
  its old version and the next launch tries again (RE-33). This does what
  Drizzle's migrator does (pending means journal entries newer than the
  newest row in `__drizzle_migrations`; each migration's statements run,
  then a row with its hash is recorded), but in a transaction the repair can
  share.
- **A copy first.** Before an upgrade changes anything, a consistent copy of
  the database is written to `.romperdb/romper.sqlite.before-upgrade`
  (`VACUUM INTO` a temporary name, then a rename). Each upgrade replaces the
  previous copy. To go back, quit Romper and rename the copy to
  `romper.sqlite`. If the copy can't be written, the upgrade doesn't start.
  Nothing is copied for a new store or when there's nothing to upgrade.
- **Bundled migrations only.** Migrations are read from the folder that
  ships with the code (`dist/electron/main/db/migrations` in a build,
  `electron/main/db/migrations` from source), never from the working
  directory.

### The missing 0008 and the two 0009s

`0008_ordinary_mastermind` (adding `samples.wav_bit_depth` and
`samples.wav_channels`) shipped and was then deleted. `0009_purple_zaladane`
replaced it, adding those two columns and `voices.stereo_mode`. A later
migration took the next free number, giving `0009_foamy_hardball`. Drizzle
orders migrations by their journal timestamps, not their names, so the
duplicate number is harmless, and both files stay as they are: renaming or
editing a shipped migration changes its hash.

A store that applied the deleted 0008 has two of 0009_purple_zaladane's
columns and no record of it, so Drizzle would re-run it and fail on a
duplicate column. `repairMigrationHistory` detects that state, adds whichever
of the three columns are missing and records 0009_purple_zaladane as applied,
in one transaction. Running it again changes nothing.

`electron/main/db/utils/__tests__/dbMigrations.integration.test.ts` builds a
store at every version a user could have (each journal entry, plus the
deleted 0008) by replaying that release's migrations. It checks that each one
upgrades to the current schema with its kits intact, that a failure part way
through (in the repair or a later migration) leaves the store unchanged, and
that the copy is made.

---

_Last updated: 2026-10-03_
