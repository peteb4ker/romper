---
layout: manual
title: Syncing
prev_page:
  url: /manual/step-sequencer
  title: Step Sequencer
next_page:
  url: /manual/keyboard-shortcuts
  title: Keyboard Shortcuts
---

Syncing copies your kit configurations and sample files from Romper's local store to your Rample SD card. This is the step that makes your kits playable on hardware.

## Before You Sync

### Prerequisites

- Your Rample SD card must be inserted and mounted on your computer
- All samples referenced by your kits must be present on your filesystem (Romper stores references, not copies)
- Kits with validation errors cannot be synced

### Validation

Before any files are written, Romper validates every kit that will be synced. This checks:

- **File existence** -- All referenced sample files still exist at their original paths
- **Format compatibility** -- Samples are valid WAV files the Rample can play
- **Naming conventions** -- Folder and file names follow the Rample's expected structure
- **Duplicate detection** -- No duplicate samples within the same voice
- **Slot limits** -- No voice exceeds 12 sample layers

If validation finds issues, they're shown in a results dialog before any writing happens. You can fix problems and re-validate, or proceed with only the valid kits.

## The Sync Process

1. Click the **Sync to SD Card** button in the Kit Browser header
2. Romper runs validation across all kits
3. If destructive sync is enabled (overwriting existing data on the card), you'll see a confirmation dialog showing exactly what will change
4. A local backup of the current SD card contents is created automatically
5. Files are copied to the SD card with progress shown in the status bar
6. Format conversions happen during this step -- for example, stereo-to-mono conversion for samples configured in mono mode
7. Metadata and labels are written to the card
8. A completion message confirms success

### What Gets Written

During sync, Romper writes:

- **Sample files** -- WAV files are copied into the correct Rample folder structure (`/KITS/[bank][slot]/[voice]/`)
- **Labels** -- Kit names and voice names are written to `.rample_labels.json`
- **Folder structure** -- Bank and kit directories are created as needed

### Automatic Backup

Before overwriting any data on the SD card, Romper creates a backup of the existing contents. If something goes wrong during sync, you can restore from this backup.

## Factory Samples

Romper can download and install the official Squarp factory sample packs:

1. Use the **Restore Factory Kits** option
2. Romper downloads the official sample archive
3. Factory kits and samples are written to the appropriate locations

This replaces existing factory kit folders on the SD card. Romper shows warnings and progress indicators throughout the operation.

Factory samples are a good starting point if you're new to the Rample or want to reset to a known-good state.

## Sync Tips

- **Sync regularly** to keep your SD card up to date with your latest edits
- **Use the Modified filter** in the Kit Browser to see which kits have unsaved changes before syncing
- **Lock important kits** to prevent accidental overwrites
- **Keep your sample files accessible** -- if you move or delete original sample files, Romper won't be able to copy them to the card during sync
- **Eject safely** -- always use your operating system's safe eject before removing the SD card
