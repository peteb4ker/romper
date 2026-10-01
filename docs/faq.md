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

- **Non-destructive editing** -- Romper stores references to your samples rather than moving the files themselves. Your original sample files are never changed; sync copies them to the card.
- **Undo/redo support** -- Adding, removing and moving samples in the kit you're editing can be undone. Try different kit arrangements without worrying about losing your work.
- **Validation before sync** -- Romper checks your kits for issues (missing files and unsupported formats) before writing anything to the SD card.
- **Your library is the master copy** -- Sync rewrites the card to match your library, so the card can always be rebuilt from it. Include your local store folder in your own backups; Romper doesn't back up the card.

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

**Yes, in the kit you're editing.** Romper can undo and redo:

- Assigning a sample to a voice slot
- Removing a sample from a voice slot
- Moving sample layers within the kit
- Step sequencer edits: steps, trigger conditions, slices and rolls

Sample changes undo only while the kit is editable; sequencer edits undo in read-only kits too. Use the standard keyboard shortcuts (**Cmd+Z** / **Ctrl+Z** to undo, **Cmd+Shift+Z** / **Ctrl+Shift+Z** to redo, or **Ctrl+Y** on Windows and Linux) or the Edit menu. The undo history is cleared when you open another kit or go back to the Kit Browser.

Other changes can't be undone, including sample gain, kit and voice names, stereo links, the editable switch, and creating, duplicating or deleting kits.

---

## What SD card formats are compatible?

Romper works with the standard Rample SD card folder structure:

- **26 banks** labeled A through Z
- **Up to 100 kit slots** per bank (0 through 99)
- **4 voices per kit** with up to 12 sample layers each
- Standard FAT32-formatted SD cards (the same format the Rample expects)

If your SD card is already set up for the Rample, Romper will recognize it. You can also start from the Rample factory samples or build a fresh library from scratch.

---

## How much disk space do I need?

Disk space depends on how many samples you work with:

- **Romper application** -- About 130 to 180 MB to download, depending on your platform (about 470 MB once installed on macOS)
- **Factory samples** -- About 313 MiB to download if you choose the Rample factory sample set during setup; setup checks for 1 GB of free space
- **Local store** -- The Romper database and metadata are small (a few MB). Kits imported during setup, from an SD card or the factory archive, are copied into the local store, so the bulk of space goes to their sample files.
- **Your sample library** -- Varies based on your collection. WAV files range from a few KB (short one-shots) to tens of MB (long stereo recordings).

Samples you add to kits are referenced in place, so Romper does not duplicate your sample library. Apart from the kits imported during setup, the only copies made are to the SD card during sync.

---

## Does Romper work offline?

**Yes.** Romper is a desktop application and works offline. No internet connection is required for:

- Browsing and editing kits
- Assigning and previewing samples
- Using the step sequencer
- Syncing to the SD card

Romper goes online in only two cases: to download the Rample factory samples during setup, if you choose to, and on macOS to check for updates at launch and weekly. Neither is needed for anything above. See the [privacy policy](https://github.com/peteb4ker/romper/blob/main/PRIVACY.md) for exactly what the update check sends.

</div>
</div>
</section>
