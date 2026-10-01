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
3. The write summary lists anything on the card that's no longer in your library (a sample you removed, a kit you deleted, a bank you renamed); sync removes it
4. Files are copied to the SD card with progress shown in the status bar. **Cancel** stops the write after the file in progress; files already written stay on the card, and nothing is removed from it
5. Format conversions happen during this step -- for example, stereo-to-mono conversion for samples configured in mono mode
6. Bank names are written to the card
7. A completion message confirms success

### What Gets Written

During sync, Romper writes:

- **Sample files** -- each kit is a folder at the root of the card (`A0` to `Z99`), with its WAV files directly inside, the same layout as the Rample factory kits. Each file is named `<voice>-<slot> <name>.wav`, for example `1-01 KICK LOW.wav`: the first character tells the Rample which voice plays it, and the slot number keeps your layers in the order you set in Romper. If a sample has a [gain adjustment]({{ site.baseurl }}/manual/kit-editor#gain-control), the gain is applied directly to the WAV data during copy so the Rample plays it at the correct level
- **Bank names** -- each named bank gets a `<letter> - <name>.rtf` file at the root of the card, as on the factory card
- **Folder structure** -- kit folders are created as needed

The card ends up matching your library: after everything is written, sync removes kit folders, files inside kit folders, and bank name files that your library no longer has. If you cancel, nothing is removed. Romper doesn't write or remove anything else. The Rample keeps its own saved kit settings (from **STORE**) in a `_save` folder on the card, which sync leaves alone.

### Backing Up

Romper doesn't back up the SD card. It doesn't need to: your library (the local store) is the master copy, and sync rewrites the card to match it, so you can rebuild a card at any time by syncing again.

Back up the **local store folder** instead, with whatever backup you already use. It holds your kits, voice names, sequencer patterns and settings (in its `.romperdb` folder), along with any samples stored there. Samples you added from elsewhere stay where they are, so back those folders up too.

The one thing on the card that only the Rample writes is its `_save` folder (kit settings you saved with **STORE**). Sync never touches it. If you want a copy, copy that folder yourself.

## Factory Samples

The setup wizard can download the official Squarp factory sample packs into a new local store:

1. Choose **Download Factory Samples** when you set up a local store
2. Romper downloads the official sample archive from Squarp (about 300 MB)
3. The factory kits appear in your library

They reach the SD card the next time you sync, like any other kit.

Factory samples are a good starting point if you're new to the Rample or want to reset to a known-good state.

## Sync Tips

- **Sync regularly** to keep your SD card up to date with your latest edits
- **Use the Modified filter** in the Kit Browser to see which kits have unsaved changes before syncing
- **Lock important kits** to prevent accidental overwrites
- **Keep your sample files accessible** -- if you move or delete original sample files, Romper won't be able to copy them to the card during sync
- **Eject safely** -- always use your operating system's safe eject before removing the SD card
