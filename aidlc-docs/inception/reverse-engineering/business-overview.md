# Business Overview

## Business Description
Romper is a cross-platform desktop sample manager for the Squarp Rample Eurorack sampler module. It replaces tedious filesystem operations with a visual, intuitive interface for browsing, organizing, editing, and synchronizing audio sample kits to SD cards.

## Business Transactions

### BT-1: Local Store Initialization
First-time setup wizard allowing users to select an SD card (import existing kits), factory samples (download official Squarp packs), or an empty folder to start fresh. Initializes SQLite database and catalogs all kits/samples with extracted metadata.

### BT-2: Kit Browsing and Discovery
Users view kits organized by bank (A-Z) in grid or list layout. Search by name/alias/metadata, filter by favorites or modified status, and navigate between kits with keyboard shortcuts. Each kit displays sample counts per voice and metadata.

### BT-3: Kit Editing and Sample Management
Visual editor shows 4 voices (rows) with up to 12 sample slots per voice. Operations include drag-and-drop sample assignment, replace/delete/move samples, rename voice aliases, adjust per-sample gain (-24 to +12 dB), set voice volume, configure sample modes (first/random/round-robin), and toggle stereo mode.

### BT-4: Audio Preview and Step Sequencer
XOX-style step sequencer allows drum pattern creation across 4 voices x 16 steps. Real-time BPM adjustment, trigger condition controls (A:B logic), and waveform visualization for quick sample identification.

### BT-5: Undo/Redo Operations
All sample operations (add, delete, move, replace) are tracked in a history stack. Undo/redo via Ctrl+Z/Ctrl+Y. Uses event-driven refresh rather than state snapshots.

### BT-6: Kit Synchronization to SD Card
Pre-sync validation checks all referenced files exist. Displays change summary with file counts and conversion requirements. Atomic sync operations with progress tracking. Format conversion for non-WAV samples. Post-sync validation and database marking.

### BT-7: Settings and Preferences
Theme configuration (dark/light), default sample format preferences, local store path management, keyboard shortcuts, and destructive action confirmations.

## Business Dictionary

| Term | Meaning |
|------|---------|
| Kit | A collection of up to 48 samples (4 voices x 12 slots) representing a performance set |
| Voice | One of 4 sample channels on the Rample (numbered 1-4) |
| Slot | A position (0-11) within a voice that holds a sample reference |
| Bank | A group of 10 kits identified by letter (A-Z), matching Rample hardware |
| Local Store | The working directory where Romper manages kits and database |
| SD Card | The storage medium used by the physical Rample hardware |
| Source Path | Absolute path to original sample file (reference-only, never copied locally) |
| Sample Mode | How a voice selects which sample to play: first, random, or round-robin |
| Stereo Mode | Voice-level setting linking stereo pairs |
| Sync | The process of copying and converting samples from local store to SD card |
| Gain | Per-sample volume trim in decibels (-24 to +12 dB) |
| Mono Annotation | File created during sync for stereo conflict resolution |
