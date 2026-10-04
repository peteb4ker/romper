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

Syncing writes your kits' sample files and bank names from Romper's local store to your Rample SD card. This is the step that makes your kits playable on hardware.

## Before You Sync

### Prerequisites

- Your Rample SD card must be inserted and mounted on your computer
- All samples referenced by your kits must be present on your filesystem (Romper stores references, not copies)

### Validation

Before any files are written, Romper checks every sample in your library:

- **File existence** -- The sample file still exists at its original path
- **Usable WAV** -- The file is a WAV file Romper can read. A WAV in a format the Rample can't play (not 44.1 kHz, or not 8- or 16-bit PCM) passes, and is converted when it's written

A sample that fails is listed in the write summary under "can't be written", with the reason. **Start Write** stays disabled until you tick **Write the other samples and skip these** (or fix the files and open the panel again). If the card already holds an earlier copy of a skipped sample, that copy stays, and the sample's kit stays marked as modified.

You can catch most of these before you write. A quarantined kit shows a red warning octagon on its card in the [Kit Browser]({{ site.baseurl }}/manual/kit-browser#kit-status-indicators) and **Quarantined** in the Kit Editor header, and the Kit Editor labels a sample whose file is missing (**File not found**) or can't be read (**Can't be read**), with how to fix it. A missing file is skipped at write; a file that can't be read quarantines its kit. See [Missing and Unreadable Files]({{ site.baseurl }}/manual/kit-editor#missing-and-unreadable-files).

## The Sync Process

1. Click the **Write** button in the Kit Browser header. The **Write to SD Card** panel opens
2. Check the card folder at the bottom of the panel, or click **Select** (or **Change**) to choose it. Romper remembers it. It won't write to a folder that can't be a card, such as your home folder or one that overlaps your local store
3. Romper checks every sample and shows the write summary: kits and samples per bank (banks with files to convert are marked **convert**), quarantined kits and how to fix them, stereo pairs it will link automatically and voices whose stereo samples it will mix down to mono, samples that can't be written, warnings (such as a kit with no sample on voice 1, which the Rample won't open), and anything on the card that's no longer in your library (a sample you removed, a kit you deleted, a bank you renamed); sync removes it
4. Click **Start Write**. Files are written to the SD card with progress shown in the panel. **Cancel** stops the write after the file in progress; files already written stay on the card, and nothing is removed from it
5. Format conversions happen during this step -- for example, a stereo sample on a mono voice is mixed down to mono
6. Bank names are written to the card
7. The panel shows **Write Complete**, with the number of samples skipped, if any. Click **Close**

If a file can't be written (for example, the card is full), the write stops and the panel shows **Write Failed** with the file and the reason. Nothing is removed from the card. When the error may be temporary, a **Retry** button appears.

Each write covers your whole library, not just the kits you changed.

### What Gets Written

During sync, Romper writes:

- **Sample files** -- each kit is a folder at the root of the card (`A0` to `Z99`), with its WAV files directly inside, the same layout as the Rample factory kits. Each file is named `<voice>-<slot> <name>.wav`, for example `1-01 KICK LOW.wav`: the first character tells the Rample which voice plays it, and the slot number keeps your layers in the order you set in Romper. If a sample has a [gain adjustment]({{ site.baseurl }}/manual/kit-editor#gain-control), the gain is applied directly to the WAV data as it's written, so the Rample plays it at the correct level
- **Bank names** -- each named bank gets a `<letter> - <name>.rtf` file at the root of the card, as on the factory card
- **Folder structure** -- kit folders are created as needed

Files the Rample can't play as they are, or that have a gain adjustment, are converted as they're written: other sample rates become 44.1 kHz, other bit depths and float WAVs become 16-bit, and a stereo file on a voice that isn't [linked as stereo]({{ site.baseurl }}/manual/kit-editor#stereo-and-mono-handling) is mixed down to mono. Your original files aren't changed.

The card ends up matching your library: after everything is written, sync removes kit folders, files inside kit folders, and bank name files that your library no longer has. A [quarantined]({{ site.baseurl }}/manual/kit-editor#stereo-and-mono-handling) kit is the exception: it isn't written, and its folder on the card is left exactly as it is until you fix the kit. If you cancel, nothing is removed. Romper doesn't write or remove anything else. The Rample keeps its own saved kit settings (from **STORE**) in a `_save` folder on the card, which sync leaves alone.

### Backing Up

Romper doesn't back up the SD card. It doesn't need to: your library (the local store) is the master copy, and sync rewrites the card to match it, so you can rebuild a card at any time by syncing again.

Back up the **local store folder** instead, with whatever backup you already use. It holds your kits, voice names, sequencer patterns and settings (in its `.romperdb` folder), along with any samples stored there. Samples you added from elsewhere stay where they are, so back those folders up too.

The one thing on the card that only the Rample writes is its `_save` folder (kit settings you saved with **STORE**). Sync never touches it. If you want a copy, copy that folder yourself.

## Factory Samples

The setup wizard can download the official Squarp factory sample packs into a new local store:

1. Choose **Squarp.net Factory Samples** as the source when you set up a local store
2. Romper downloads the official sample archive from Squarp (about 313 MiB)
3. The factory kits appear in your library

They reach the SD card the next time you sync, like any other kit.

Factory samples are a good starting point if you're new to the Rample or want to reset to a known-good state.

## Sync Tips

- **Sync regularly** to keep your SD card up to date with your latest edits
- **Use the Modified filter** in the Kit Browser to see which kits have changed since the last write
- **Leave kits Locked** when you're not editing them, so you don't change them by accident
- **Keep your sample files accessible** -- if you move or delete original sample files, Romper won't be able to copy them to the card during sync
- **Eject safely** -- always use your operating system's safe eject before removing the SD card
