---
layout: default
title: FAQ
description: Frequently asked questions about Romper, the sample kit manager for Squarp Rample
---

<section class="page-content">
<div class="container">
<div class="prose">

# Frequently Asked Questions

Common questions about using Romper to manage your Squarp Rample sample kits.

---

## How is Romper different from editing my SD card directly?

When you edit your SD card directly, you're working with the raw folder structure -- renaming folders, moving WAV files, and manually keeping track of which samples go where. One wrong move and you can end up with a broken kit or lost files.

Romper gives you a visual interface on top of that process with several key advantages:

- **Non-destructive editing** -- Romper stores references to your samples rather than moving the files themselves. Your original sample library stays untouched until you explicitly sync.
- **Full undo/redo support** -- Every sample assignment, removal, and rearrangement can be undone. Try different kit arrangements without worrying about losing your work.
- **Validation before sync** -- Romper checks your kits for issues (missing files, format problems, naming conflicts) before writing anything to the SD card.
- **Automatic backups** -- When you sync, Romper creates a backup of the existing SD card content first.

Think of Romper as a working copy for your Rample kits. You experiment freely, then commit the results to the SD card when you're ready.

---

## What audio formats are supported?

**WAV is the primary format.** The Squarp Rample reads WAV files from the SD card, so Romper is built around WAV workflow.

When you assign samples to a kit:
- **WAV files** (.wav) are used directly with no conversion needed.
- During sync to the SD card, Romper can convert samples to ensure compatibility with the Rample's requirements (sample rate, bit depth, channel format).

If you have samples in other formats (AIFF, MP3, FLAC, etc.), convert them to WAV before importing into Romper.

---

## Will Romper modify my original sample files?

**No.** Romper uses a reference-only architecture. When you assign a sample to a voice slot, Romper stores a reference (the file path) to where that sample lives on your filesystem. It never moves, renames, or modifies the original file.

Your sample files are only copied during an explicit sync operation, and only to the SD card destination. Your source sample library is never touched.

---

## Can I undo changes?

**Yes.** Romper provides full undo and redo for all sample operations:

- Assigning a sample to a voice slot
- Removing a sample from a voice slot
- Reordering sample layers
- Clearing a voice or kit

Use the standard keyboard shortcuts (**Cmd+Z** / **Ctrl+Z** to undo, **Cmd+Shift+Z** / **Ctrl+Shift+Z** to redo) or the Edit menu. Undo history is maintained for the duration of your session.

---

## What SD card formats are compatible?

Romper works with the standard Rample SD card folder structure:

- **26 banks** labeled A through Z
- **Up to 100 kit slots** per bank (00 through 99)
- **4 voices per kit** with up to 12 sample layers each
- Standard FAT32-formatted SD cards (the same format the Rample expects)

If your SD card is already set up for the Rample, Romper will recognize it. You can also start from the Rample factory samples or build a fresh library from scratch.

---

## How much disk space do I need?

Disk space depends on how many samples you work with:

- **Romper application** -- Approximately 200 MB installed
- **Factory samples** -- Approximately 1 GB if you choose to download the Rample factory sample set during setup
- **Local store** -- The Romper database and metadata are small (a few MB). The bulk of space goes to your sample files.
- **Your sample library** -- Varies based on your collection. WAV files range from a few KB (short one-shots) to tens of MB (long stereo recordings).

Romper references your existing sample files in place, so it does not duplicate your sample library. The only copies made are to the SD card during sync.

---

## Does Romper work offline?

**Yes.** Romper is a desktop application that runs entirely offline after installation. No internet connection is required for:

- Browsing and editing kits
- Assigning and previewing samples
- Using the step sequencer
- Syncing to the SD card

The only feature that requires an internet connection is downloading the Rample factory samples during initial setup. Once downloaded, everything works offline.

</div>
</div>
</section>
