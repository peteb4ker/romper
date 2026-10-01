<!--
title: SD Card Layout - Specification
priority: high
status: specification
updated: 2026-09-30
context_size: small
implementation_status: RE-06 implemented in #372; RE-05 in the follow-up PR.
-->

# SD card layout (RE-06, RE-05)

## Overview

Sync must write the card in the layout the Rample firmware reads. Today it
doesn't: every sample goes into a per-voice subfolder
(`<card>/<kit>/<voice>/<original name>`), where, per the manual, the
firmware doesn't look. This spec defines the card layout once, in one
module, and has sync write it.

## Assumptions (Pete, 2026-09-30)

- **One Rample.** A user syncs to one device's card.
- **The local store is the source of truth.** The user backs it up with
  their own backup scheme. Romper doesn't need to read back a card it
  wrote.
- **Samples reach the card only through Romper.** Nobody adds files to
  the card directly, so Romper may treat kit folders on the card as its
  own.
- **Squarp's factory kits define the standard.** The archive the setup
  wizard downloads (`SQUARP_FACTORY_SAMPLES_URL`,
  `RampleSamplesV1-2.zip`) is the reference layout.

## The standard

### From the Rample manual

- Kit folders sit at the card root, named `<bank letter><0–99>` (`A0`,
  `E10`, `Z99`).
- In a kit folder, a WAV's **first character is its voice** (1–4). "Sample
  layer names are numerically and alphabetically sorted", which sets the
  layer order. Up to 12 layers per voice.
- A kit opens only if it has a voice-1 file.
- 44.1 kHz, 16- or 8-bit, at least 50 ms. A stereo file fills two voices,
  and all layers in a voice must be the same type (mono or stereo).
- Subfolders inside a kit folder are not mentioned.

### From the factory archive (checked 2026-09-30)

- 14 bank name files at the root (`A - ALWIS.rtf`), 183 kit folders
  (`A0`…`S36`), 2,373 WAVs. Two voices hold more than 12 files (S62 voice
  2 has 18, S67 voice 4 has 13), so 7 files never reach the card.
- Every WAV sits directly in its kit folder. There are no subfolders.
- Every WAV name starts with 1–4. The rest of the name is free-form:
  `1 KICK LOW 01.wav`, `2.wav`, `3_hat.wav`, `4KICK.wav`.
- Layer numbers are a mix of zero-padded (`01`) and unpadded (`1`)
  numbers. Nothing in the archive shows whether the firmware sorts
  `10` before or after `2`.

### Written by the device (Squarp forum, not the manual)

- STORE writes per-kit settings to `_save/<kit>.rpl` at the card root
  (for example `_save/C0.rpl`). The files are binary and undocumented.
  Deleting one resets that kit, per Squarp staff.
- SAVE SETTINGS writes global settings to the card, probably under
  `_save/` too.
- Nothing the device writes lives inside a kit folder.

## Current state

- `syncSampleProcessing.getDestinationPath` writes
  `<card>/<kit>/<voice_number>/<filename>` with the sample's original
  file name. Without a sync-side folder `sync_output` is used instead.
- #56 (Aug 2025) built a flat, firmware-compliant naming scheme
  (`rampleNamingService`, `1sample1.wav`), but wired it only into
  `syncServiceRefactored`, which IPC never used. That cluster was removed
  as dead code in 5e3bf54a (June 2026); `rampleNamingService.ts` is still
  there, unused (RE-56).
- Import (setup wizard) and rescan already read the factory layout:
  WAVs at the kit root, voice from the first character
  (`groupSamplesByVoice`).
- Sync only added or overwrote files (RE-05); an optional "clear card"
  step removed kit folders and bank files first.
- The e2e sync test checks only that the card isn't empty, so nothing
  checks the layout.
- `docs/manual/syncing.md` describes `/KITS/[bank][slot]/[voice]/` and a
  `.rample_labels.json` labels file. Neither exists.

Pete thinks a card synced by Romper has played on his Rample. If so,
the firmware reads subfolders too and this is a compliance fix rather
than a broken feature. Either way, the fix is the same.

## Design

### Card layout

```
<card>/
  A - ALWIS.rtf                 bank name (unchanged)
  _save/                        device-owned; Romper never touches it
  A0/
    1-01 KICK LOW.wav
    1-02 KICK LOW.wav
    2-01 SNARE.wav
    3-01 XO-6 OP HH.wav
```

### File names

`<voice>-<slot> <name>.wav`

- `<voice>`: `voice_number`, 1–4. It's the first character, so the
  firmware assigns the voice.
- `<slot>`: `slot_number + 1`, zero-padded to two digits (`01`–`12`).
  Zero-padding makes ASCII and natural sort agree, so the layer order on
  the device matches Romper's slot order whichever sort the firmware
  uses.
- `<name>`: the sample's file name without `.wav`, with:
  - a leading voice prefix removed (a voice digit, optionally the `-NN`
    this scheme adds, then any of ` ._-`), so `1 KICK LOW 01.wav` becomes
    `1-01 KICK LOW 01.wav`, not `1-01 1 KICK LOW 01.wav`, and a name
    imported from a Romper-written card isn't prefixed twice;
  - characters FAT32 forbids (`\ / : * ? " < > |` and control
    characters) replaced with `_`;
  - leading and trailing spaces and dots trimmed;
  - truncated so the whole name is at most 64 characters (a safe limit
    until the hardware says otherwise).
  - If nothing is left, the name is just `<voice>-<slot>.wav`.
- The `<voice>-<slot>` prefix is unique within a kit, so two samples with
  the same name can no longer overwrite each other (part of RE-05).
- Stereo: a sample on a voice in stereo mode is written once, on that
  voice. The firmware spreads it over two voices. Never copy it onto
  voice N+1 (see the stereo invariant in `CLAUDE.md`).

### One layout module

`shared/rampleCardLayout.ts` holds the naming and parsing rules. It lives
in `shared/` because the setup wizard's import runs in the renderer.

- `cardSampleFileName(voice, slot, originalName)`: the rules above
- `voiceOfCardFile(fileName)`: the voice the firmware assigns a file, used
  by `groupSamplesByVoice` for import and rescan

Sync joins the kit folder and file name in
`syncSampleProcessing.getDestinationPath`. The unused
`rampleNamingService.ts`, and `stereoSyncProcessor.ts`, the only thing that
imported it, are deleted (part of RE-56).

### Existing cards

None are in use, so there is no migration. Mirroring (RE-05) removes old
per-voice subfolders anyway, since they aren't samples of the kit.

### What sync never touches

`_save/`, anything at the root other than kit folders and bank files, and
any folder that isn't a valid kit name.

### Settings stored on the device

`_save/<kit>.rpl` belongs to the kit slot, not its samples, so the
device applies old settings to a kit whose samples changed. Romper
leaves `_save/` alone. A later option could reset (delete) the `.rpl`
for changed kits, which is Squarp's documented reset.

### Validation (warnings in the sync summary)

- A kit with no voice-1 sample won't open on the device.
- More than 12 samples in a voice can't happen: Romper's slots cap a voice
  at 12. (The factory card has one voice with 18 files; what the device
  does with the extra ones is unknown.)
- Mixed mono and stereo in a voice is handled by `stereo_mode`. The
  format rules (44.1 kHz, 16-bit) are the converter's job and are tracked
  in RE-08 and RE-29.

## Delivery

1. **RE-06 (this PR):**
   - add the layout module and sync's new file names;
   - route import and rescan voice parsing through the module;
   - delete `rampleNamingService.ts` and `stereoSyncProcessor.ts`;
   - fix the layout sections of `docs/manual/syncing.md` (no `/KITS`,
     no labels file);
   - add tests for the names and an e2e assertion on the written layout.
2. **RE-05: the card mirrors the store.** After every file is written,
   and only if the sync wasn't cancelled, sync deletes:
   - kit folders for kits the store doesn't have, or that have no
     samples;
   - anything inside a kit folder that isn't one of that kit's samples;
   - bank name files for banks without a name (or with a new one).

   A sample that can't be written (RE-09) keeps its file, so skipping it
   leaves the card's last copy. Names are compared ignoring case, as
   FAT32 does. The write summary lists the same entries before the user
   confirms, which replaces the "clear card first" option.
   `_save/` and anything else on the card is never touched. This is safe
   under the "only through Romper" assumption.

## Open questions

- **Hardware check:** after RE-06, sync a card and confirm on the Rample:
  - the layers play in slot order;
  - names up to 64 characters are fine;
  - a voice-1-less kit refuses to open.
- **Old cards:** did a card synced before this change actually play?
  This only matters for the RE-06 write-up.
