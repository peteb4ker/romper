---
layout: default
---

# Romper Database Schema

This document describes the schema for the Romper local SQLite database, which is created in the `.romperdb` folder inside the local store.

## Entity-Relationship Diagram (ERD)

![Romper DB ERD](./romper-db-erd.png)

- **kits**: Each kit is a collection of samples and has metadata fields, step sequencer patterns, and locking status.
- **voices**: Each kit has exactly 4 voices (voice numbers 1-4) with optional custom aliases.
- **samples**: Each sample belongs to a kit and voice, with WAV metadata including bitrate and sample rate.

## Table Definitions

### kits
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `name` TEXT NOT NULL - Kit name/identifier
- `alias` TEXT - Optional display alias for the kit
- `artist` TEXT - Optional artist/creator information
- `plan_enabled` BOOLEAN NOT NULL DEFAULT 0 - Whether kit is enabled for sequencing plans
- `locked` BOOLEAN NOT NULL DEFAULT 0 - Whether kit is locked from editing
- `step_pattern` BLOB - Step sequencer pattern data (64 bytes: 16 steps × 4 voices, velocity 0-127 per step)

### voices
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `kit_id` INTEGER NOT NULL - Foreign key to kits.id
- `voice_number` INTEGER NOT NULL CHECK(voice_number BETWEEN 1 AND 4) - Voice number (1-4)
- `voice_alias` TEXT - Optional custom alias for this voice
- UNIQUE(kit_id, voice_number) - Each kit has exactly one record per voice number

### samples
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `kit_id` INTEGER - Foreign key to kits.id
- `filename` TEXT NOT NULL - Sample filename
- `voice_number` INTEGER NOT NULL CHECK(voice_number BETWEEN 1 AND 4) - Voice this sample belongs to
- `slot_number` INTEGER NOT NULL CHECK(slot_number BETWEEN 1 AND 12) - Slot position within the voice (1-12)
- `is_stereo` BOOLEAN NOT NULL DEFAULT 0 - Whether sample is stereo
- `wav_bitrate` INTEGER - WAV file bitrate (e.g., 1411200 for 16-bit/44.1kHz stereo)
- `wav_sample_rate` INTEGER - WAV file sample rate (e.g., 44100, 48000)

## Data Constraints and Business Rules

### Kit Structure
- Each kit must have exactly 4 voice records (voice_number 1-4) created automatically upon kit insertion
- Step patterns are stored as 64-byte BLOBs with layout: [step0_voice0, step0_voice1, step0_voice2, step0_voice3, step1_voice0, ...]
- Each byte in step_pattern represents velocity (0-127) for that step/voice combination

### Sample Organization
- Maximum 12 samples per voice (slots 1-12)
- Samples are organized by voice (1-4) and slot (1-12)
- Voice numbering in database is 1-indexed (1, 2, 3, 4)

### WAV File Requirements
- Supported formats: 16-bit or 24-bit WAV files
- Supported sample rates: 44.1kHz, 48kHz, or 96kHz
- Supported channels: Mono or stereo
- Bitrate calculation: sample_rate × bit_depth × channels (e.g., 44100 × 16 × 2 = 1,411,200 for 16-bit/44.1kHz stereo)

## Relationships
- kits (1) → voices (4) - Each kit has exactly 4 voices
- kits (1) → samples (many) - Each kit can have multiple samples
- voices (1) → samples (many) - Each voice can have up to 12 samples (slots)

---

_Last updated: 2025-01-27_

<!-- Schema and diagrams confirmed up to date with electron/main/db/romperDbCore.ts as of 2025-01-27 -->
