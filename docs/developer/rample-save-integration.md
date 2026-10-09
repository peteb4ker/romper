<!--
title: The Rample's _save folder - Roadmap
priority: low
status: specification
updated: 2026-10-08
context_size: medium
implementation_status: stage 0 (docs, #789), stage 1a (the write code's guard, #787) and stage 1b (the read-only reader, #788) built; stages 2-6 not built
-->

# The Rample's `_save` folder: reading it, then writing it

Tracks [#786](https://github.com/peteb4ker/romper/issues/786) ([Q-08](use-cases.md#q-08-romper-supports-or-mirrors-the-ramples-features)).
Discovery was done on 2026-10-04 and 2026-10-08 from a copy of the
`_save` folder on Pete's Rample card. The files were read, never changed.

## Problem

The Rample keeps what you set on the device (knob positions, layer modes,
mute groups, CV assignments, and its own settings) in a `_save` folder at
the root of the SD card. Romper ignores that folder. It never reads it,
never backs it up, and a write never changes it. That keeps the folder
safe, but:

1. **The settings follow the slot, not the samples.** A kit's file is
   named after its slot (`_save/L1.rpl`). When Romper writes new samples
   into L1, or deletes L1 and later creates a new L1, the device plays the
   new samples with the old level, filter, run mode, mute groups and
   selected layers. Nothing tells you.
2. **You can't see them.** Romper can't show what the device has stored
   for a kit, so its previews can differ from the device for reasons you
   can't see.
3. **They aren't backed up.** Setting up from a card copies the kits and
   bank names into your library, but not the device's saved settings. A
   lost or reformatted card loses them.
4. **They can't be edited on the computer.** Everything set on the
   device has to be set again by hand on the device.

## Goals

1. Read every file in `_save` safely, whatever firmware wrote it, keep
   what Romper doesn't understand, and say which firmware the keys point
   to, as an inference.
2. Keep a copy of the folder in your library, so nothing the device saved
   is lost to a card failure or to a later Romper write.
3. Show the device's saved settings for a kit, and say when they no
   longer fit the kit's samples.
4. Later, and only after hardware checks, let Romper write the folder:
   first whole files (reset, copy with a duplicated kit), then single
   values.

## Non-goals

- Anything the Rample doesn't store. A kit file has no BPM, steps,
  patterns, trigger conditions, sample names or stereo flag, so Romper's
  sequencer, BPM, trigger conditions and stereo links stay Romper-only.
- MIDI and CV behavior on the computer. Program change, MIDI notes and CV
  assignments can be shown and documented, not previewed.
- Previewing the device's effects (pitch, bits, filter, freeze, drive,
  compressor, tape). That is a separate feature, if ever.
- Reading or writing the card outside a write or setup. The card is
  plugged in only when you set up or write; the store stays the source of
  truth ([`sd-card-layout.md`](sd-card-layout.md), "Assumptions").

## What's in the folder

From Pete's card (2026-10-04). Pete believes it runs firmware 2.00; that
stays unconfirmed until he reads **Settings → INFO** (hardware check 1).
See [Firmware versions](#firmware-versions):

| File | Written by | What it holds |
|---|---|---|
| `<kit>.rpl` (`L1.rpl`, `L4.rpl`, `F7.rpl`) | STORE, per kit | One map of the kit's knob positions and assignments (keys below) |
| `settings.rpl` | SAVE SETTINGS | One map of the device settings (keys below) |
| `global_assign.rpl` | Probably SAVE SETTINGS or ASSIGN = GLOBAL (unverified) | An array of four maps `{param, voice}`: the GLOBAL CV assignments |
| `autosave_<kit>.rpl` (`autosave_C1.rpl`) | AUTOSAVE (inferred) | Nothing: the file is empty. The kit name is in the file name |

Every file, and the folder, has a modification time of 0 (1 January
1970), probably because the Rample has no clock (inferred). File times
can't tell an old save from a new one; only the contents can.

The [manual](https://squarp.net/rample/manual/) never names the folder
or the files. Its Settings section says STORE saves "current kit
parameters & assignments" and SAVE SETTINGS the device settings, both "on
the SD card", and that LAYER applies to a kit "never been saved before
with STORE".

### The encoding: CBOR

Each non-empty file is exactly one CBOR data item
([RFC 8949](https://www.rfc-editor.org/rfc/rfc8949)) and uses every byte.
Confirmed with a throwaway decoder (not committed) on 2026-10-08:

- **Types used:** unsigned integers, text strings, arrays, maps and
  `false`. No negative integers, floats, byte strings, tags or
  indefinite lengths. `true` hasn't been seen yet; a mute group set on
  the device should produce it (hardware check 5).
- **Integers are in their shortest form:** 0–23 in one byte, 24–255 in
  two (`0x18 0x7f` is 127). So a value's width changes the file's length:
  `L1.rpl` is a byte shorter than `L4.rpl` because a 127 became a 0.
  There are no fixed offsets; a reader has to parse.
- **Map keys are in plain string order** (byte by byte, as a C `strcmp`
  or a C++ `std::map<std::string, …>` orders them), at every level,
  including the nested `{param, voice}` maps. That is **not** the order
  RFC 8949's deterministic encoding (§4.2.1) or RFC 7049's canonical
  encoding asks for: both put shorter keys first, so they would move
  `env` ahead of `assignments`. An encoder that "canonicalizes" would
  change the bytes. (Inferred: Squarp's firmware serializes a sorted map,
  for example with a JSON-style library's CBOR output. Unverified.)
- **No duplicate keys, no trailing bytes.**

### Kit file keys (`<kit>.rpl`)

Every array has four items, voices SP1–SP4 in order (inferred: the only
changed values in L1 and F7 are at index 0).

| Key | Shape | Values seen | Meaning | Confirmed? |
|---|---|---|---|---|
| `assignments` | 4 maps `{param, voice}` | `param` 9, `voice` 0 | Per-kit CV assignments (ASSIGN = KIT), CV1–CV4 | Key confirmed; meaning inferred (check 6) |
| `bitcrush` | 4 uints | 127 | Bits knob | Inferred; scaling unknown (check 3) |
| `env` | 4 uints | 127 | Envelope knob | Inferred (check 3) |
| `filter` | 4 uints | 127, 189 | Filter knob; 127 is neutral | Inferred (check 3) |
| `freeze` | 4 uints | 127 | Freeze knob; the manual says freeze is on when the knob isn't at its midpoint | Inferred (check 3) |
| `layer_modes` | 4 uints | 1 | Layer mode; 1 is probably RANDOM, the manual's default | Inferred (check 12) |
| `length` | 4 uints | 254 | Sample length; 254 is full length | Inferred (check 3) |
| `level` | 4 uints | 42, 127 | Levels/Drive; 127 is probably unity, above is drive | Inferred (check 3) |
| `loop` | 4 uints | 0, 127 | Run mode (one shot, toggle loop, gate). A knob value, not a 0–2 choice | Inferred (check 4) |
| `mute_group` | 4 × 4 booleans | all `false` | Mute groups: row muted by column, or the reverse | Inferred (check 5) |
| `pitch` | 4 uints | 127 | Pitch knob; 127 is no transposition | Inferred (check 3) |
| `selected_layer` | 4 uints | 0–3 | The layer MANUAL mode plays, counted from 0 | Inferred (check 12) |
| `start` | 4 uints | 0 | Start point; 0 is the start of the sample | Inferred (check 3) |

So knobs probably run 0–254 with 127 in the middle. Nothing in a kit file
names its samples or counts its layers.

### Device settings keys (`settings.rpl`)

| Key | Value seen | Probable setting | Confirmed? |
|---|---|---|---|
| `anti_clic` | 1 | ANTICLIC on | Inferred |
| `assign` | 0 | ASSIGN = KIT | Inferred (check 6) |
| `autosave` | 1 | AUTOSAVE on | Inferred (check 2) |
| `cv_in_range` | 1 | CV IN range | Inferred (check 13) |
| `flip` | 0 | FLIP off | Inferred |
| `layerMode` | 1 | LAYER (the default layer mode) | Inferred (check 12) |
| `midi_channel_in` | 8 | CHANNEL (counted from 0 or 1) | Inferred (check 13) |
| `midi_velocity` | 0 | VELOCITY | Inferred (check 13) |
| `note_sp1`…`note_sp4` | 48–51 | SP1–SP4 trigger notes | Inferred |
| `pitch_tracking_chromatic` | 0 | PITCH (chromatic quantize) | Inferred |
| `receive_pitchbend` | 0 | BEND | Inferred |
| `receive_progchange` | 1 | PROGRAM CHANGE | Inferred |
| `slicer_quantize_postv200` | 2 | SLICER, an index into its list | Key confirmed device-wide; index meaning inferred (check 7) |
| `vu_meters` | 1 | VUMETER | Inferred (check 13) |

`layerMode` is camelCase where every other key is snake_case, and
`slicer_quantize_postv200` looks renamed so a firmware after 2.00 doesn't
misread an older value. Both suggest the key set changes between firmware
versions; see [Firmware versions](#firmware-versions).

### What this settles

- **SLICER is one setting for the whole device** on the firmware that
  wrote these files: it's in `settings.rpl` and in no kit file. That's the
  evidence for [#617](https://github.com/peteb4ker/romper/issues/617),
  which still needs check 7 to close.
- **Stereo isn't stored.** No kit key mentions stereo or links, which
  agrees with the invariant that stereo is a voice setting Romper owns.
- **The Rample has no sequencer state.** No BPM, steps or conditions.

## Firmware versions

No file in `_save` records a firmware or format version: `settings.rpl`
has no version key, and the kit files have none either. So the firmware
behind a folder can only be inferred from which keys are present, and
each inference is labeled as one. Pete believes his Rample runs 2.00
(unconfirmed until check 1); 3.00 is the latest release (February 2026).

Firmware also changes what a value means without changing its key. 2.00
moved output levels to dB, redesigned Freeze and Bitcrusher, and let
START POINT and LENGTH be exponential (SLICER = EXP). 3.00 changed
Bitcrusher, Freeze and Drive again, with Bitcrusher and Freeze now
depending on the knob's direction. A `level` or `bitcrush` of 189 may
not mean the same thing on 2.00 and 3.00, so scaling confirmed on one
firmware is confirmed for that firmware only.

### Firmware matrix

From the [firmware changelog](https://squarp.net/rample/firmware/) and
the [manual](https://squarp.net/rample/manual/), checked 2026-10-08.
"Seen" means the key is in Pete's files; "expected" means a feature that
should be saved somewhere, under a key nobody has seen yet. There is no
release between 2.00 and 3.00, and none after 3.00.

| Firmware | Feature it added that is saved | Key | Status |
|---|---|---|---|
| 1.1 (June 2020) | Selected layers saved with STORE; ANTICLIC | `selected_layer`, `anti_clic` | Seen |
| 1.2 (August 2020) | Layer mode per voice; AUTOSAVE of the last kit; first SLICER values (Free, /8 … /48) | `layer_modes`, `autosave`, `autosave_<kit>.rpl`; SLICER under an older key | First two seen; the pre-2.00 SLICER key is expected, probably without `_postv200` |
| 1.3 (December 2020) | LAYER default; ASSIGN = KIT or GLOBAL | `layerMode`, `assign`, `global_assign.rpl` | Seen |
| 1.4 (May 2021) | More VUMETER modes; MIDI keyboard split; CV V/oct | `vu_meters` (wider range); the split's storage is unknown | `vu_meters` seen; the split is expected somewhere |
| 1.50 (July 2022) | FLIP | `flip` | Seen |
| 2.00 (February 2024) | SLICER EXP and 1/128; levels in dB; new Freeze and Bitcrusher; holding ASSIGN keeps FX on kit load | `slicer_quantize_postv200` | Seen. Pete's files are at least 2.00 (inferred) |
| 3.00 (February 2026) | Compressor (COMPRESS preset, % COMPRESS, SIDECHAIN) and TAPE, "saved as part of your settings" per the manual | Expected in `settings.rpl`, names unknown | Not seen: Pete's files predate 3.00, or 3.00 writes them only after SAVE SETTINGS (inferred) |
| 3.00 | PUNCH mode; MIDI layer selection by note; PRO and PEAK VU meters | Unknown; the manual doesn't say whether PUNCH is saved. New VU meters widen `vu_meters`' values | Expected |

The changelog first mentions mute groups in 1.1 and assignments with
ASSIGN in 1.3; when `mute_group`, `assignments` and the knob keys first
appeared isn't recorded. The 3.00 announcement says it runs on both the
Rample and the Rample Turbo
([forum](https://squarp.community/t/rampleos-3-0/16014)); whether the two
write the same files is unverified.

### Forward compatibility

Pete expects `_save` to be forward compatible: a newer firmware reads an
older folder. The evidence fits, but none of it is confirmed:

- The SLICER key was renamed rather than reinterpreted, which only makes
  sense if a newer firmware reads files an older one wrote.
- A pre-3.00 `settings.rpl` has no compressor or tape keys, so 3.00 must
  use defaults for missing keys if it reads such a file at all.
- One forum user downgraded from 3.00 to 2.00 while chasing a hardware
  fault and mentioned no lost settings
  ([forum](https://squarp.community/t/rampleos-3-0/16014)); that's
  anecdotal, and silence isn't evidence.

Backward compatibility (an older firmware reading a newer folder) is less
likely to matter, but a downgrade would test it. Check 18 asks for a
3.00 sample.

### What Romper does about it

- **Read every firmware's files.** Every field is optional; a missing key
  is reported as missing, not filled with a default. Unknown keys are kept
  in order with their bytes.
- **Infer the firmware from the key set, and say it's inferred.** The
  reader returns a guess from `settings.rpl`, for example "2.00 or later
  (has `slicer_quantize_postv200`); before 3.00 (no compressor keys)",
  with the keys it used. Once a 3.00 sample shows the compressor and tape
  key names, they become the 3.00 marker. A key set that matches no known
  firmware is reported as "unknown firmware", never as the nearest guess.
- **Judge each file on its own.** A folder can mix files from different
  firmware: a kit stored under 2.00 stays as it was after an update until
  it's stored again, and file times are all 0. Kit files have no marker of
  their own, so a kit file's firmware is "unknown, folder looks like X".
- **Interpret values per firmware.** Stage 3 shows raw values, with the
  inferred firmware, until a check has confirmed a field's meaning on that
  firmware.
- **Write only for verified firmware.** Stage 6 needs a real sample and
  passing checks from every firmware it supports (D8).

## Public sources

Checked 2026-10-08. Squarp hasn't published the format, and no public
tool reads or writes these files; as far as we found, this is the first
public decode.

- **[Rample firmware changelog](https://squarp.net/rample/firmware/).**
  Dates the features the files hold:
  - 1.1 (June 2020): STORE saves the selected layers; ANTICLIC added.
  - 1.2 (August 2020): layer mode per voice; AUTOSAVE of the last kit;
    the first SLICER quantize values (Free, /8 to /64, /12, /24, /48).
  - 1.3 (December 2020): the LAYER default and ASSIGN = KIT or GLOBAL,
    which matches `layerMode`, `assign` and `global_assign.rpl`.
  - 1.44 (March 2022): fixes saves and stores that failed.
  - 2.00 (February 2024): SLICER gains EXP and 1/128. That fits the
    `slicer_quantize_postv200` key, though no source says the key was
    renamed then.
  - 3.00 (February 2026): Compressor, Tape and Punch.

  The [Firmware matrix](#firmware-matrix) lists every saved feature by
  release.
- **[Folder settings mishap](https://squarp.community/t/folder-settings-mishap/12026)**
  (Squarp forum, November 2024). A user who replaced their `_save` files
  with another Rample's lost MIDI response until they restored a backup.
  Thibault, of Squarp, replied that deleting a kit's `.rpl` fully resets
  that kit; after that you STORE again, or edit the file by hand if you
  can decode it. This is the source for "deleting the file resets the
  kit", and a case for backing the folder up.
- **[rampleOS 1.21 thread](https://squarp.community/t/rampleos-1-21-new-firmware/4773)**
  (September 2020). Squarp says autosave writes once the module has
  stayed on one kit for a while. That fits an empty
  `autosave_<kit>.rpl` used as a marker. One user mentions deleting both a
  `save` and a `_save` folder, so an older firmware may have used another
  name (anecdotal).
- **[Store function not working as expected](https://squarp.community/t/rample-store-function-not-working-as-expected/6867)**
  and **[Volume settings no longer saving?](https://squarp.community/t/volume-settings-no-longer-saving/5615)**
  (2021–2022). Users confirm STORE writes per-kit files such as `C0.rpl`,
  SAVE SETTINGS the device settings, and AUTOSAVE only the last kit.
- **Other tools.** [rample-kit-studio](https://github.com/canufeel/rample-kit-studio)
  skips `_save` when it imports a card. [Ramplaid](https://ramplaid.com/),
  the third-party kit tool the manual mentions, and the kit generators on
  GitHub (rample-kitman, Rample-kit-generator, salmple2rample) don't touch
  it. A community decode of Squarp's Hapax files
  ([PaxDAT](https://github.com/desolationjones/PaxDAT)) describes a custom
  binary format, not CBOR, so the Rample's encoding can't be assumed from
  Squarp's other products.

## Romper today

- **Never read.** Setup imports only folders that pass `isValidKit`
  (`shared/kitUtilsShared.ts`), so `_save` isn't copied
  (`tests/e2e/sd-card-setup.e2e.test.ts` checks it). Scans read the store,
  not the card. The stage 1b reader (`electron/main/rample/`) decodes a
  copy of the folder for `npm run rample:save`; nothing in the app calls
  it yet.
- **Never changed by a write, by name.** The folder is named once
  (`DEVICE_SAVE_FOLDER` in `shared/rampleCardLayout.ts`, compared ignoring
  case and trailing dots and spaces). The only removal path,
  `findStaleCardEntries` → `removeCardEntries`
  (`electron/main/services/sdCardSafety.ts`), skips it explicitly, and
  `removeCardEntries` refuses any entry at or under it, or the card
  itself, whatever list it's given. The sample writer
  (`syncFileOperations.processAllFiles`) refuses a write whose files would
  land in it. None of this depends on `KIT_FOLDER_PATTERN` or
  `BANK_NAME_FILE_PATTERN`, which `_save` doesn't match either. Unit tests
  widen both patterns and craft removal lists; unit and e2e tests seed
  `_save/A0.rpl` and check it survives a full and a cancelled write, and
  the full-pipeline validation requires it (stage 1a, #787).

## CBOR library

Romper needs a decoder now and an encoder later, and the encoder must
reproduce the device's bytes exactly: shortest integers, definite
lengths, and keys in the order the file had them (plain string order,
not a canonical order). Compared on 2026-10-08, by decoding and
re-encoding Pete's five non-empty files:

| | Byte-identical by default | Notes |
|---|---|---|
| [`cbor2`](https://github.com/hildjj/cbor2) (MIT) | Yes | Maintained successor to `cbor`; keeps insertion order by default; strict decode options (no streaming, no duplicate keys, shortest form only); maps to `Map` with `preferMap`; needs Node 22+, which Electron's Node meets; one small dependency |
| [`cborg`](https://github.com/rvagg/cborg) (Apache-2.0) | No | Sorts keys length-first by default, which reorders the device's keys; turning sorting off isn't documented |
| [`cbor-x`](https://github.com/kriszyp/cbor-x) (MIT) | No | Writes 16-bit map headers unless told not to; an optional native addon would complicate Electron packaging |
| [`cbor`](https://github.com/hildjj/node-cbor) (MIT) | Yes | Frozen (its README points to `cbor2`); CommonJS only |
| [`@levischuck/tiny-cbor`](https://github.com/LeviSchuck/tiny-cbor) (MIT) | Yes | Small, strict, maps only to `Map`; one maintainer |
| In-house subset | Yes | A prototype of about 65 lines round-tripped every file |

Two traps whatever the choice: decode maps to `Map`, never to plain
objects (JavaScript moves integer-like keys such as `"1"` to the front of
an object), and when adding a key, order it by its UTF-8 bytes, never with
`localeCompare` (`layerMode` must sort before `layer_modes`).

**Recommended: a small in-house codec** for the subset the files use
(unsigned and negative integers, text, arrays, maps with text keys,
`false`, `true`, `null`), in TypeScript in `electron/main/rample/`.
Reasons:

- Byte-identical rewriting is the requirement that matters, and owning
  the byte form makes it a property of our code, not of a library's
  defaults and options.
- The subset is tiny (an estimated 120–160 lines plus table-driven
  tests), and Romper keeps its short list of runtime dependencies.
- Errors can name the byte offset, which helps when a card is damaged.
- Anything outside the subset (a float, a byte string, a tag from a
  future firmware) is kept as an opaque item with its original bytes, so
  reading stays tolerant and rewriting stays exact. Writing a file that
  holds an opaque item is refused until we know what it is.

`cbor2` is the fallback if the codec turns out to be more than it looks,
and can serve as a development dependency that cross-checks the codec in
tests. As built in stage 1b: the in-house codec
(`electron/main/rample/cbor.ts`), with no new dependency. It decodes and
re-encodes every file on Pete's card byte for byte (checked read-only
with `npm run rample:save`; the files aren't committed, see D1). Its
encoder writes an opaque item back byte for byte, so a round trip stays
exact; refusing to *write a card file* that holds one is stage 6's job,
since nothing writes yet.

## Fixtures

Pete's six files are small, hold no samples and no names, only knob
values, MIDI notes and settings. They're the only evidence of what a real
device writes, byte for byte, so they're the best regression fixtures for
a reader and for byte-identical re-encoding.

- **Recommended:** commit them, unchanged, as
  `tests/fixtures/rample-save/<firmware>/` once Pete agrees (decision D1)
  and has recorded the firmware version (check 1), with a short README
  saying where they came from. Add each later hardware check's `_save`
  copy beside them, so every claim in the tables above points at a file.
- **Always:** synthetic fixtures built by the encoder in the tests
  themselves, for what the real files don't cover: missing keys, unknown
  keys, `true` in a mute group, values above 255, a truncated file, an
  indefinite length, a file of a different type under a kit name.
- **Until D1 is decided,** stage 1 uses synthetic fixtures only, built to
  match the real files' key sets and values, and checks byte-identical
  round trips against byte strings written out in the test. As built:
  `tests/factories/rampleSave.factory.ts` builds them with the codec's
  encoder.

## Plan

Each stage is one or a few PRs. Every PR says `Part of #786`, or
`Fixes #N` for its stage's issue. A stage marked **blocked** waits for
the decisions and hardware checks it lists; the epic lists it, and its
issue is opened once it's unblocked.

### Stage 0: docs (the PR that added this file)

- This roadmap.
- [`sd-card-layout.md`](sd-card-layout.md): the files are CBOR, not
  undocumented binary; the file list; SAVE SETTINGS writes
  `_save/settings.rpl`.
- [`domain-model.md`](domain-model.md): the device's saved settings, where
  they live, and that Romper doesn't read them yet.
- [`rample-manual-index.md`](rample-manual-index.md): notes on the
  sections whose settings now have known keys (STORE, SAVE SETTINGS,
  SLICER, LAYER, ASSIGN, AUTOSAVE, Assign a CV input, Mute groups,
  Layers).
- The `settings.rpl` evidence on #617.
- **Affects:** Q-08. **Decisions:** none. **Hardware:** none.
- **Verified by:** `npm run lint:check` and `npm run trace:check`.

### Stage 1: read the folder, and name it in the write code

Two PRs, both without UI.

**1a. Guard `_save` by name** ([#787](https://github.com/peteb4ker/romper/issues/787)). **Done.**

- `shared/rampleCardLayout.ts` names the folder
  (`DEVICE_SAVE_FOLDER = "_save"`). `findStaleCardEntries` skips it
  explicitly, and `removeCardEntries` refuses any path at or under it,
  whatever the patterns say, and returns the refusals. The sample writer
  refuses a destination inside it too.
- **Affects:** Q-04, UC-34.
- **Tests:** unit tests that a widened kit pattern or a crafted removal
  list still can't remove `_save` or anything in it; the existing e2e
  checks stay.

**1b. A tolerant reader, with types** ([#788](https://github.com/peteb4ker/romper/issues/788)). **Done.**

- A CBOR decoder for the subset above (see [CBOR library](#cbor-library))
  in `electron/main/rample/`, and the decoded shapes in `shared/`
  (`RampleKitSave`, `RampleDeviceSettings`, `RampleCvAssignment`). Every
  field is optional; the decoded value keeps every key it found,
  understood or not, in order, with its original bytes, so a later stage
  can write the file back unchanged.
- **Tolerant:** a missing key is `undefined`, an unknown key is kept, a
  value of the wrong shape is reported, not thrown. A file that isn't
  CBOR, is truncated, has trailing bytes, or uses a type outside the
  subset is reported as unreadable with the reason, never as defaults.
  Limits on nesting depth, item counts and file size, so a damaged card
  can't hang or exhaust main.
- **Firmware:** the reader infers the likely firmware from the
  `settings.rpl` key set and returns it with the keys it used, labeled as
  inferred (see [What Romper does about it](#what-romper-does-about-it)).
  An unmatched key set is "unknown firmware".
- **Recognizes files by name:** `<kit>.rpl` (with the kit name checked by
  the same rule as kit folders), `settings.rpl`, `global_assign.rpl`,
  `autosave_<kit>.rpl`. Anything else is listed as unknown and kept. An
  empty file is valid only for `autosave_<kit>.rpl`.
- A developer script, `npm run rample:save -- <folder> [<folder>]`, prints
  a folder's decoded files, or the differences between two copies. It
  makes the hardware checks below a one-line compare.
- No IPC channel or UI yet.
- **As built:** the codec is `electron/main/rample/cbor.ts`, the reader
  `rampleSaveReader.ts` (with `rampleSaveFirmware.ts` and
  `rampleSaveDiff.ts`), the types `shared/rampleSave.ts`. Following the
  [CBOR library](#cbor-library) rule, a well-formed item outside the
  subset (a float, a byte string, a tag, another simple value, an integer
  beyond a safe JavaScript number, a map with a non-text key) is kept as
  an opaque item, not an error, so the file stays readable and its bytes
  exact; malformed input (truncated, trailing bytes, an indefinite length,
  a reserved head, a duplicate key, too deep, too big) is unreadable,
  with the byte offset. Each file also says whether it re-encodes byte
  for byte: a device file always should; one with a longer integer form
  than needed (hardware check 17) doesn't.
- **Affects:** Q-08. **Decisions:** D1 (fixtures; the stage starts
  with synthetic ones). **Hardware:** none; check 1 labels the fixtures.
- **Tests:** unit tests of the decoder against every fixture; the
  codec's encoder builds the synthetic fixtures (it has no other caller
  until stage 6); a byte-identical decode → encode round trip for every
  fixture; malformed inputs (truncated at every offset, trailing bytes,
  indefinite length, tag, float, deep nesting) each give a typed error;
  unknown and missing keys; the firmware guess for a 2.00-style key set,
  a pre-2.00 one, one with extra keys, and one that matches nothing;
  tagged `[Q-08]`.

### Stage 2: keep a copy of the folder (blocked on D2)

- **Setup from a card (UC-01)** copies `_save` into the store as an opaque
  backup, byte for byte, before importing kits. A copy that fails doesn't
  fail setup; the summary says so.
- **Before every write (UC-34)**, Romper reads the card's `_save` and
  stores a copy. Before stage 4 that's only a backup; from stage 4 on, it's
  also the "before" snapshot for anything Romper changes in the folder.
- Where and how many copies is D2. Recommended: inside the store's
  `.romperdb` folder (scans and setup never look there, and it travels
  with the store), as `rample-save/<date-time>/`, keeping the setup copy
  and the latest few.
- The copy is never written back automatically. Restoring it is a manual
  step until stage 6 gives it a button.
- **Affects:** UC-01, UC-34, Q-02, Q-03 (Romper reads one more folder on
  the card you chose).
- **Decisions:** D2.
- **Hardware:** none.
- **Risks:** a card with a damaged `_save` (a copy failure must not block
  setup or a write); store size (small: a few hundred bytes per kit).
- **Tests:** an e2e setup from a card with a seeded `_save` checks the
  copy is byte-identical and still not imported as a kit (it replaces the
  current "not copied" assertion); an integration test that a write
  stores the snapshot before writing; a test that an unreadable `_save`
  doesn't fail setup or the write.

### Stage 3: show the device's saved settings for a kit (blocked on D3)

- A read-only "On the Rample" view of a kit's latest copy of
  `<kit>.rpl`: per voice level, pitch, filter, bits, freeze, env, start,
  length and run mode; layer mode and selected layer; mute groups; CV
  assignments. Values are shown raw (0–254, with the middle marked) until
  checks 3–6 and 12 confirm the scaling and the enums; then as the device
  shows them.
- A kit card shows a small marker when the device has saved settings for
  that slot (UC-08).
- Says which copy it's from ("read from the card on …") and shows
  nothing, not defaults, when there's no file.
- **Affects:** UC-08, Q-08; UC-32 and UC-33, which it explains.
- **Decisions:** D3.
- **Hardware:** works with raw values on day one; checks 3–6 and 12 turn
  them into names and units.
- **Depends on:** stages 1b and 2.
- **Risks:** showing an inferred meaning as fact. Mitigation: raw values
  until a check confirms each field, and a test that every displayed
  label comes from a confirmed table.
- **Tests:** component tests for each field and for a missing or
  unreadable file; an e2e that sets up from a card with a seeded `.rpl`
  and shows the panel; screenshots and manual text, per CLAUDE.md.

### Stage 4: warn about settings left on the card, and offer a reset (blocked on D4, D5, checks 8 and 10)

- **Warn (no change to the card).** The write summary lists kits whose
  samples change, and kits it deletes, that still have a `_save/<kit>.rpl`,
  and says the device will apply the old settings to the new samples.
  Deleting a kit (UC-16) says the same in its popover.
- **Reset (the first write inside `_save`).** Optionally, the write
  deletes the `.rpl` of a changed or deleted kit, after the stage 2
  snapshot. Squarp's staff describe deleting the file as the reset
  (check 10 confirms it).
- **Q-04's wording changes**, from "the Rample's own settings folder is
  untouched" to saying exactly what a write may remove there, and only
  when you ask. The `_save` guard from stage 1a gains one named,
  tested exception: removing `_save/<kit>.rpl` for a kit in the plan.
- **Affects:** UC-34, UC-16, Q-04.
- **Decisions:** D4, D5.
- **Hardware:** 8 (the device really applies old settings to new
  samples), 10 (deleting the file resets the kit), 9 (what a selected
  layer beyond the kit's layers does, which decides whether "fewer
  layers" gets its own warning).
- **Risks:** deleting a file the user wanted. Mitigation: off unless
  chosen, only after a complete write, only the named kits' files, after
  a snapshot, and listed in the summary before you confirm.
- **Tests:** unit tests of the plan (which kits warn, which files a reset
  removes); the stage 1a guard tests updated for the one exception; e2e:
  a write with reset off leaves `_save` byte-identical, with reset on
  removes exactly the listed files and nothing after a cancel.

### Stage 5: start from the device's settings at setup (blocked on D6, checks 7 and 12)

- At setup from a card, seed Romper's own settings from the device's
  where the meaning is the same:
  - `layer_modes` → `voices.sample_mode`, only where the modes match
    (RANDOM → random, CYCLIC → round-robin; check 12). MANUAL, REVERSE
    CYCLIC and VELOCITY have no Romper mode and keep Romper's default.
  - SLICER (`slicer_quantize_postv200`) → the new kits'
    `slicer_division`, when it is one of Romper's divisions (check 7).
- Not seeded: `level` (the device's is a gain with drive above the
  middle, Romper's a preview volume), `start` and `length` (knob
  positions, not slices), effects.
- **Affects:** UC-01, UC-32, UC-33, Q-08.
- **Decisions:** D6.
- **Hardware:** 7, 12.
- **Tests:** unit tests of the mapping table, including unknown values;
  an e2e setup from a card with seeded files.

### Stage 6: write back (blocked on D7, D8, D9 and checks 14–18)

**6a. Whole files.** No format knowledge needed beyond stage 1's reader:
copy a kit's `.rpl` to the new slot when you duplicate a kit (UC-15), and
restore a stage 2 copy of the folder or of one file.

**6b. Values.** Edit a field of a kit file on the computer and write it
with the kit. Only fields confirmed by a hardware check can be edited.

- **Round-trip safety:** the decoded file keeps every key and its
  original bytes. An edit re-encodes only the changed value, in shortest
  form, and keeps key order; an unchanged file is written back
  byte-identical, or not written at all. Nothing writes a file Romper
  couldn't read completely.
- **Firmware fence:** the files carry no firmware version, so the
  `settings.rpl` key set stands in for one. Romper writes only when that
  key set matches a firmware it supports; otherwise it reads and shows,
  but doesn't write. A firmware is supported only once there is a real
  `_save` sample from it in the fixtures and checks 14–17 have passed on
  it (D8). With 2.00 and 3.00 both in use, that means a sample and checks
  from each (check 18, D9).
- **Conflicts:** the device may have changed a file since Romper last
  read it. Before writing, Romper compares the card's file with the copy
  it last read (contents, since there are no file times) and stops for
  that kit if they differ.
- **Dry run, backup, restore:** the write summary lists each `.rpl` it
  will change, with the old and new values; the stage 2 snapshot is taken
  first; a restore puts the snapshot back.
- **Affects:** UC-15, UC-32, UC-33, UC-34, Q-02, Q-04, Q-08.
- **Decisions:** D7, D8, D9.
- **Hardware:** 14–17 on every supported firmware (the device accepts a
  file Romper wrote, and how it treats missing, extra or reordered keys),
  18 (a 3.00 sample), plus whichever of 3–6 and 12 confirm the fields
  being edited, on each firmware.
- **Risks:** a file the device misreads silently (odd values, not an
  error). Mitigation: the firmware fence, only confirmed fields, a
  verified round trip, and checks 14–17 on a spare card first.
- **Tests:** property tests that decode → encode is the identity on
  every fixture and on generated files; tests that an edit changes only
  its bytes; e2e writes that check the card's `_save` against an expected
  copy; the full-pipeline validation compares `_save` byte for byte.

### Later candidates (not staged)

- **Mute groups in preview** (UC-30): the sequencer could honor the
  device's mute groups once check 5 confirms the direction. Romper's
  voice choke only stops sounds on the same voice.
- **Effects in preview:** pitch, filter, bits and drive per voice.
- **Device settings in the docs:** the manual pages could explain what
  the device does with a changed kit's saved settings, from check 8.

## Decisions for Pete

Recommendations, not decisions: each needs Pete's sign-off on the epic
before its stage is built.

| # | Question | Recommendation |
|---|---|---|
| D1 | May Pete's real `.rpl` files be committed as test fixtures? | Yes, unchanged, under `tests/fixtures/rample-save/<firmware>/` with a note of where they came from. They hold knob values, MIDI notes and settings, nothing personal. Stage 1 starts with synthetic fixtures either way. |
| D2 | Should Romper copy `_save` into the library, and when? | Yes: at setup from a card and before every write, into `.romperdb/rample-save/<date-time>/`, keeping the setup copy and the latest few. Never restored automatically. |
| D3 | Where and how should the device's saved settings show? | A read-only "On the Rample" section in the kit editor, collapsed by default, with raw values and the middle marked until hardware checks confirm the units; a small marker on kit cards whose slot has a saved file. Wording is Pete's. |
| D4 | Should the write summary warn about saved settings left behind? | Yes, as information, never blocking: list changed and deleted kits that still have a saved file. Say the same when deleting a kit. |
| D5 | Should a write offer to reset (delete) those files? | Yes, opt-in per write and off by default for changed kits; on by default for deleted kits is a reasonable alternative, since the kit is gone. Always after a snapshot. Q-04's wording changes to match. |
| D6 | Which device settings should seed Romper's at setup? | Only exact matches: RANDOM and CYCLIC layer modes, and SLICER when it's one of Romper's divisions. Not level, start, length or effects. |
| D7 | What may Romper write back, and in what order? | Whole-file operations first (copy with a duplicated kit, restore); value edits only for fields a hardware check has confirmed, starting with layer mode and selected layer. |
| D8 | Which firmware versions may Romper write for? | Read every version. Write only for a firmware with a real `_save` sample in the fixtures and checks 14–17 passed on it; aim for 2.00 and 3.00. |
| D9 | How to get a `_save` sample from firmware 3.00: update Pete's Rample, or find another 3.00 owner? | Run checks 1–13 on the current firmware first, with a full card copy. Then update to 3.00 (a forum user reports downgrading to 2.00 works, unverified) and run check 18. Asking on the Squarp forum for a sample is Pete's call. |

## Hardware verification protocol

What the bytes can't tell us. Pete runs these with the Rample; each one
changes one thing, saves it, and compares copies of `_save` before and
after. Checks 1–11 are the numbered checks of the original analysis
(cited by #617); 12–18 are new. The table after the steps says what each
check unblocks.

### Before you start

1. Use a spare card, or copy the whole card to the computer first, and
   keep that copy until every check is done.
2. Write down the firmware version: **Settings → INFO** (check 1). Note
   it with every copy you make, since nothing in the files records it.
3. Copy `_save` from the card to a folder named `00-baseline`. Copy
   *from* the card only. If you ever put a file back by hand on a Mac,
   use `cp -X` (or run `dot_clean` on the card afterwards), so macOS
   doesn't add `._` files beside it.
4. For each check: make the one change, save it as the check says
   (**STORE** for a kit, **SAVE SETTINGS** for a device setting), power
   the Rample off, take the card out, copy `_save` to a folder named
   after the check (`03-scaling`), and put the card back.
5. Compare with the copy before it. With stage 1b merged:
   `npm run rample:save -- 00-baseline 03-scaling`. Until then,
   `cmp -l` on the changed file shows the bytes that moved. Note what
   changed in the check's issue comment.

### The checks

1. **Firmware.** Record the version from **Settings → INFO**, and
   whether the module is a Rample or a Rample Turbo. Until this is done,
   the firmware behind Pete's files is a belief (2.00), not a fact.
2. **Autosave.** With AUTOSAVE on, load kit A0, power off and on, copy
   `_save`. Then load B0, power-cycle, copy again. Expect
   `autosave_C1.rpl` to become `autosave_A0.rpl`, then
   `autosave_B0.rpl`, still empty.
3. **Knob scaling.** On kit L4, voice 1: turn pitch fully right, filter
   fully left, level fully right, start fully right, length fully left,
   bits, freeze and env fully right. STORE. Expect 254, 0, 254, 254, 0,
   254, 254, 254. Then set pitch to +1 semitone (or one step), STORE, and
   record the value, to learn the scale.
4. **Run mode.** On voice 1 of L4, choose each run mode (one shot, toggle
   loop, gate) in turn and STORE after each. Record `loop` each time.
5. **Mute groups.** On L4 set "SP1 muted by SP2" only, STORE. Record
   which cell of `mute_group` becomes `true` (row 0, column 1, or row 1,
   column 0).
6. **CV assignment.** With ASSIGN = KIT, on L4 assign CV1 to Pitch on SP2,
   STORE. Record `assignments[0]`. Repeat with Levels/drive, then with
   "All samples". Then set ASSIGN = GLOBAL, assign CV2 to Filter on SP3,
   SAVE SETTINGS, and see which file changes: `global_assign.rpl`,
   `settings.rpl`, or both.
7. **SLICER (#617).** Change SLICER from its current value to /16, SAVE
   SETTINGS, copy. Then /32, then EXP, then /8. The list has changed
   between firmware versions (Free in 1.2, EXP and /128 in 2.00), so the
   index can't be guessed. Record
   `slicer_quantize_postv200` each time, and check that no kit file
   changed. Then, on one kit, set SLICER, play two voices, and confirm
   the setting quantizes both (it's device-wide).
8. **Old settings on new samples.** Note voice 1's level on L1 (stored
   as 42). On the computer, replace L1's voice-1 sample on the card
   (Romper write, or by hand), then load L1 on the device. Is voice 1
   still turned down?
9. **Fewer layers than the selected layer.** On F7, put voice 3 in MANUAL
   with layer 4 selected, STORE. Then leave voice 3 with two layers on the
   card and load F7. What does voice 3 play, and does the device show an
   error?
10. **Reset.** Delete `_save/L1.rpl` on the card (keep the copy), load L1.
    Does it load with every knob in the middle and the LAYER setting's
    mode? Does the file come back only after STORE?
11. **Lower case.** Rename a kit folder on a spare card to lower case
    (`a5`). Does the device open it? (This belongs with #573.)
12. **Layer modes.** On L4, voice 1: choose MANUAL, RANDOM, CYCLIC,
    REVERSE CYCLIC and VELOCITY in turn, STORE after each, and record
    `layer_modes[0]`. In MANUAL, select layer 3 and record
    `selected_layer[0]` (expect 2). Change the LAYER setting, SAVE
    SETTINGS, and record `layerMode`.
13. **Device setting enums.** Set CHANNEL to 1, SAVE SETTINGS, record
    `midi_channel_in` (0 or 1?). Step VELOCITY, VUMETER and CV IN through
    each choice, SAVE SETTINGS after each, and record the values.
14. **A file Romper wrote is accepted.** After stage 1b: on a spare card,
    replace `_save/L4.rpl` with a copy Romper re-encoded byte for byte
    (identical: this is a control). Then with one changed value (voice 1
    level 127 → 64). Load L4: is voice 1's level at a quarter?
15. **A missing key.** On a spare card, a copy of `L4.rpl` without
    `filter`. Does L4 load, with filter in the middle, or is the file
    ignored, or does the device misbehave? Delete the file to recover.
16. **An unknown key.** A copy of `L4.rpl` with an extra key `zz_test: 1`.
    Does L4 load normally? After STORE, is the key still there (the device
    keeps unknown keys) or gone?
17. **Key order and integer width.** A copy with keys in a different
    order, and one with 127 written in a longer form (`0x19 0x00 0x7f`).
    Does the device read both? This decides how strict the encoder must
    be.

18. **A sample from firmware 3.00** (D9). On a Rample running 3.00 (Pete's,
    after an update, or another owner's):
    1. Before updating, copy the whole card, and copy `_save` to
       `18-before`.
    2. Update, power on, and load a kit you stored before (L1). Do its
       settings still apply? Copy `_save` to `18-after-update`: did the
       update change any file by itself?
    3. SAVE SETTINGS without changing anything; copy to
       `18-save-settings`. Then set TAPE, % COMPRESS, COMPRESS, SIDECHAIN
       and PUNCH to non-default values, SAVE SETTINGS, copy to
       `18-master-fx`. Record the new keys and values.
    4. On L4 change one knob, STORE, copy to `18-store`: does a 3.00 kit
       file have new keys?
    5. Repeat checks 3, 7, 12 and 13 on 3.00, since 2.00 and 3.00 changed
       what some values mean.
    6. If you go back to 2.00 afterwards, load L4 and copy `_save` once
       more: does 2.00 read a 3.00 file?

    Every copy goes into the fixtures (D1), labeled with the firmware.

Checks 14–17 put computer-made files on the card. Do them on a spare
card, keep the baseline copy, and if the device misbehaves, delete the
file (check 10's reset) or restore the copy.

### What each check unblocks

| Check | Unblocks |
|---|---|
| 1 | Fixture labels (D1), the firmware fence (D8), the firmware the matrix assumes for Pete's files |
| 2 | The meaning of `autosave_<kit>.rpl` in stage 3 |
| 3 | Units in stage 3; editing knobs in stage 6b |
| 4 | Run mode names in stage 3 |
| 5 | Mute groups in stage 3; mute groups in preview |
| 6 | CV assignment names in stage 3 |
| 7 | Closing #617; SLICER seeding in stage 5 |
| 8 | The stage 4 warning's wording |
| 9 | Whether stage 4 warns about fewer layers |
| 10 | The stage 4 reset |
| 11 | #573 |
| 12 | Layer mode names in stage 3; stage 5 seeding |
| 13 | Device settings shown in stage 3 |
| 14–17 | Stage 6, once per supported firmware |
| 18 | The 3.00 row of the firmware matrix, 3.00 detection in stage 1b, stage 6 for 3.00 |

## Risks

- **Data loss on the card.** Every stage before 4 only reads. From stage
  4 on: a snapshot before any change, changes only after a complete
  write, only the files the summary listed, the stage 1a guard with named
  exceptions, and e2e tests that compare `_save` byte for byte.
- **Firmware variance.** Keys are added and renamed between versions
  (`postv200`, the 3.00 master effects), values change meaning without a
  new key (levels in dB in 2.00; Bitcrusher and Freeze in 2.00 and 3.00),
  and nothing in a file says which firmware wrote it. The reader keeps
  what it doesn't know and labels its firmware guess as a guess; the
  writer refuses key sets it hasn't verified (D8).
- **Inferred meanings shown as fact.** Raw values until a check confirms
  a field; the tables above mark each field.
- **A damaged or foreign file.** The reader reports it and moves on;
  setup and writes never fail because of `_save`.
- **macOS metadata files.** Writing to a FAT32 card from a Mac can leave
  `._<name>` files. Romper writes with plain file writes, which don't;
  stage 4 and 6 tests check that no `._` file appears in `_save`. Whether
  the device minds them is unverified.

## Not covered

- MIDI and CV behavior, which Romper can't preview.
- The `autosave_<kit>.rpl` file beyond reading its name.
- Writing `settings.rpl` or `global_assign.rpl`. Device settings stay the
  device's; stage 6 covers kit files only.
