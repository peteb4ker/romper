<!--
title: Step Sequencer Slicer - Specification
priority: medium
status: specification
updated: 2026-09-30
context_size: medium
implementation_status: implemented on branch claude/inspiring-cray-avt5kh (Phases 0–4). Timing verified in the built app under Xvfb; not yet checked by ear on real hardware.
-->

# PRD: Step Sequencer Slicer

## Overview

Add a **slicer** to the step sequencer. A long sample (a drum break, a
vocal phrase, a chord progression) placed in a voice slot can be chopped
into equal slices and played back **one slice per step**. This is how
the Rample plays part of a sample when an external sequencer sends it
_start point_ (CCx4) and _length_ (CCx5) messages.

The feature is built to produce **happy accidents**. Three things are
single-click actions:

- re-rolling which slice each step plays,
- letting a step pick a new slice every time it fires,
- varying slice length.

Locks and undo mean experimenting never destroys a pattern you like.

### Goals

1. Put a long sample in a slot, flip one switch, and hear it played back
   as slices on the sequencer grid.
2. See the slices on a waveform, and choose for each step which slice
   plays and for how long.
3. Make randomization instant, repeatable, reversible, and partly
   controllable (locks, amount).
4. Match how the Rample slices, so the preview is believable. That means
   equal divisions, a monophonic voice, and start point plus length.

### Non-goals

- Nothing leaves Romper: no MIDI file export, no live MIDI out, and no
  syncing slice data to the SD card. See [Out of Scope](#out-of-scope).
- Randomizing _rhythm_ (which steps are on). The dice change **what**
  plays, never **when**.

## Background

### How the Rample slices (from the manual)

Source: <https://squarp.net/rample/manual/>. The relevant sections are
_Advanced parameters_, _Note about start point & sample length_,
_Settings → SLICER_, and the MIDI implementation chart.

- The Rample has no separate slice mode. Slicing is the combination of
  two per-voice parameters:
  - **start point**: "set the beginning of the sample playback". MIDI
    **CCx4**, 0–127, where `0` is the default (sample start).
  - **length**: "set the duration of the sample". MIDI **CCx5**, 0–127,
    where `127` is the default (full sample).
  - `x` is the voice number (1–4), or `5` for all voices. For example,
    CC14 is SP1 start point and CC35 is SP3 length.
- A **global** device setting, **SLICER**, quantizes both parameters:
  - `/8, /16, /32, /64, /128, /12, /24, /48` divide the sample into that
    many **equal parts** ("handy to edit … 'in beats'").
  - `EXP` gives 256 non-linear positions, with finer resolution near zero,
    for very short or glitchy lengths.
- Length is a fraction of the **total** sample length (100 % down to
  0 %), counted from the start point.
- Each Rample voice is **monophonic**: a new trigger replaces whatever
  the voice is playing. (Unverified on hardware: the manual doesn't say.)
- For tight drum-loop slicing the manual recommends `ANTICLIC = OFF`.
  Anticlick adds a short fade that "can be perceived as jitter".
- The Rample has no sequencer of its own. On hardware, an external
  sequencer chooses slices by sending CCx4/CCx5 before each note.

### Current state of Romper's sequencer

**The grid.** The sequencer is a preview-only grid of **4 voices × 16
steps** in the Kit Editor drawer. The code is `KitStepSequencer`,
`StepSequencerGrid` and `useKitStepSequencerLogic`.

**Per-step data:**

- `kits.step_pattern`: a velocity from 0 to 127. The UI only ever
  writes 0 or 127.
- `kits.trigger_conditions`: A:B cycle conditions.

**Per-voice data:**

- `voices.sample_mode`: `first`, `random` or `round-robin`.
- `voices.voice_volume`.
- `voices.stereo_mode`, which links two voices into one row.

**Playback.** A step trigger travels through
`onPlaySample(voice, sample, volume)` → `useKitPlayback.handlePlay` →
the slot's mounted `SampleWaveform`. That component calls
`AudioBufferSourceNode.start()` **with no offset or duration**, so
playing part of a sample is not possible today.

**Timing.** A `setInterval` Web Worker drives React state. Steps are not
scheduled on the `AudioContext` clock.

**Randomization.** The only randomization today is the per-voice **Rnd**
sample mode.

**Fit with existing plans.** `docs/developer/product-requirements.md` lists per-step sample
selection and per-step velocity as possible future enhancements. Slicing
fits alongside them: the existing per-step data says _whether_ a step
plays, and slice data adds _what_ it plays.

## Decisions (captured from Q&A, 2026-09-30)

| #   | Question                                     | Decision                                                                                                                                                                                                |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | End goal                                     | **Preview only**, inside Romper. Nothing is sent to hardware.                                                                                                                                           |
| D2  | "Control on one channel at a time"           | **Edit one voice at a time.** Any voice can be in slice mode, but the slice editor shows one voice at a time.                                                                                           |
| D3  | Editing UX                                   | **Waveform strip plus steps.** A sliced waveform strip appears above the grid. Select a step, then click or drag slices on the waveform. Steps show their slice number, and the scroll wheel nudges it. |
| D4  | Randomization                                | All four: a **re-roll button**, **live random per trigger**, **randomized length**, and **locks plus amount**.                                                                                          |
| D5  | Division scope                               | **Per kit**, like the Rample's single global SLICER setting.                                                                                                                                            |
| D6  | Division options                             | **/8, /12, /16, /24, /32, /48, /64, /128.** No EXP.                                                                                                                                                     |
| D7  | Default mapping when slice mode is turned on | **Sequential**: step _n_ plays slice _n_, wrapping round.                                                                                                                                               |
| D8  | Default playback                             | **One slice long, with a monophonic choke** and a short anti-click fade.                                                                                                                                |
| D9  | Which slot is sliced                         | **Slot choice stays independent.** Slicing applies to whichever slot is active when the step fires. See the note below and [Open Questions](#open-questions).                                           |
| D10 | Live random scope                            | **Per step.** Any step can be set to 🎲 instead of a fixed slice.                                                                                                                                       |
| D11 | Rhythm dice                                  | **No.** Dice change slices only.                                                                                                                                                                        |
| D12 | Undo                                         | **Single-level undo** of the last roll.                                                                                                                                                                 |

> **How D9 is read in this spec.** The voice's sample mode (1st / Rnd /
> R-R) chooses which slot plays, exactly as it does today and
> independently of slicing. The step's slice is then applied **in
> proportion** to that slot's audio: slice 5 of 16 is 25 %–31.25 % of
> whichever sample is playing. So Rnd sample mode plus slices varies both
> the slot and the slice.
>
> The waveform strip shows the voice's **currently selected slot** (the
> one highlighted in the voice panel), or the voice's first sample when
> another voice is selected. It does not jump between slots during
> playback: with Rnd or R-R that would redraw on every step. Slices are
> proportional, so the flash still marks the right region whichever slot
> fired.

## Learnability (added 2026-09-30)

Usage must be self-evident. Someone who has never read the manual should
be able to slice a break within a minute. So:

- **A hint line under the strip always says what to do next.** It changes
  with context:
  - no step selected: _"Click a step, then click a slice to choose what it
    plays."_
  - step selected: _"Step 3 plays slice 5. Click a slice to change it,
    drag for longer hits, or 🎲 Roll for surprises."_
  - it also mentions that clicking the selected step again turns it off.
- **Hovering a step previews its slice on the waveform** as a ghost
  highlight, so the link between steps and slices is visible before
  anything is clicked.
- **Every control is visible and labelled.** The dice and undo buttons
  show text labels, not just icons. Every control has a tooltip, and
  tooltips name the keyboard shortcut where one exists. Keyboard and
  scroll-wheel shortcuts are accelerators only; everything they do can
  also be done by clicking.
- **Turning slice mode on shows its result at once.** Active steps
  immediately show slice numbers, and the strip slides in.
- **Clicking a slice on the waveform plays it**, so the waveform can be
  explored by ear.

## User Experience

### 1. Turning slice mode on

- Each sequencer row gets a **✂ Slice toggle** in its row controls, next
  to the sample-mode button.
  - Off (the default): the voice behaves exactly as it does today.
  - On: the row becomes a **slice row**, and the toggle glows in the
    voice colour.
  - If the voice has no samples, the toggle is disabled and a tooltip
    explains why.
- The first time a voice goes into slice mode, every step that is
  already on gets the **sequential default** (D7):
  - Step _n_ (counting from 0) plays slice `n mod division`, one slice
    long.
  - With `/16`, a one-bar loop at its own BPM plays back as the original
    loop. That is the moment the user can tell it works, and the starting
    point for changing it.
- Turning slice mode off keeps the slice data. Turning it back on
  restores it unchanged.
- Stereo-linked voices (for example "1+2") are one row with one toggle.
  Slices apply to both channels together, like every other row control.

### 2. The slice strip (one voice at a time)

While at least one voice is in slice mode, a **slice strip** appears at
the top of the sequencer drawer, above the grid. It edits exactly one
voice at a time, called the **editing voice**.

- The editing voice is the slice row that was most recently clicked or
  focused with the keyboard.
- If several voices are in slice mode, the strip header shows small voice
  tabs (for example `V1 · V3`) for switching between them. The other
  slice rows still show their slice numbers but are not highlighted.
- **Closing the strip** (× in its header) hides the editor only. Slice
  mode stays on for every sliced voice, and they keep playing their slices,
  so several voices can be sliced at once without the strip open. Clicking a
  step on a sliced row, or turning ✂ on for another voice, opens it again.

```
┌ V1 ▸ breakbeat.wav (slot 1) ───────── Division [/16 ▾] ── 🎲 Roll  ↶ ── Amount [100%▾]  Vary length ☐ max [2▾] ┐
│▁▅█▃▁▇▂▁█▅▃▁▆▂▁▄▇▃▁█▂▁▅▃▁▇▅▂▁█▃▁▆▂▅▁▃█▂▁▄▆▂▁▅█▃▁▇▂▁█▅▃▁▆▂▁▄▇▃▁█▂▁▅▃▁▇▅▂▁█▃▁▆▂▅▁▃█▂▁▄▆▂▁▅█▃▁▇▂▁█▅▃▁▆│
│  1 │  2 │  3 │  4 │▓ 5 ▓│  6 │  7 │  8 │  9 │ 10 │ 11 │ 12 │ 13 │ 14 │ 15 │ 16 │                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 1  ✂ [ 1][  ][ 5][  ][ 3][  ][12][ 7][ 1][  ][🎲][  ][ 3][  ][ 9][ 7]   Rnd  🔊 ───●──
 2    [██][  ][  ][  ][██][  ][  ][  ][██][  ][  ][  ][██][  ][  ][  ]   1st  🔊 ──●───
          ▲ selected step 3 → slice 5 highlighted on the strip
```

**Strip header, from left to right:**

- **Voice and sample**: the voice label and the file name of the slot
  being shown.
- **Division**: a dropdown with `/8 /12 /16 /24 /32 /48 /64 /128`.
  - Its tooltip reads _"Kit-wide — like the Rample's SLICER setting"_
    (D5).
  - Changing it re-divides every slice row in the kit. Nothing stored is
    lost (see [Data Model](#data-model)).
- **🎲 Roll**: re-rolls the editing voice. See
  [Randomization](#4-randomization).
- **↶ Undo roll**: enabled only straight after a roll.
- **Amount**: `25% / 50% / 75% / 100%`.
- **Vary length**: a checkbox, plus a **max** length of 1, 2, 4 or 8
  slices.

**Waveform:**

- A full-width waveform of the slot being shown, drawn in the voice
  colour.
- A vertical line at every slice boundary, like the `/16` animation in
  the manual.
- Slice numbers under the waveform. At dense divisions (`/64`, `/128`)
  only every 4th or 8th number is labelled, but every line is still
  drawn.
- The **selected step's** slice range, from its start to start plus
  length, has a translucent highlight in the voice colour.
- Every other slice the voice uses gets a faint tick, so you can see
  which parts of the sample the pattern touches.
- During playback, the slice that is sounding flashes.

**Waveform interactions.** Each one acts on the selected step.

- **Click slice _k_**: start becomes _k_. Length stays the same, but is
  shortened if it would run past the end of the sample. The slice plays
  once so you can hear it.
- **Drag from slice _a_ to slice _b_**: start becomes the smaller of
  _a_ and _b_, and length becomes |_b_ − _a_| + 1. The span plays once.
- **Alt/Option-click**: plays the slice without assigning it, for
  browsing the sample.
- If no step is selected, a click only plays the slice.

### 3. Editing on the grid

**How steps look on slice rows:**

- Steps that are on show their **slice number**, counting from 1, instead
  of a plain lit LED.
- A length of more than one slice shows as a thin bar along the bottom
  edge. The bar is wider for longer lengths (1, 2, 4, 8+).
- Steps set to **live random** show 🎲 instead of a number.
- **Locked** steps show a small 🔒 mark in the corner.
- The existing A:B condition label moves to a small corner badge so it
  fits next to the slice number.

**Selecting versus toggling.** On a slice row, the user needs to select a
step without losing one-click on/off. The clicks work like this:

| Action on a slice row                        | Result                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Click a step that is **off**                 | Turns it on with the sequential default (slice `n mod division`, one slice long), **and selects it**.                                      |
| Click a step that is **on but not selected** | Selects it, and the strip highlights its slice. The step stays on.                                                                         |
| Click the **selected** step                  | Turns it off. Its slice data is kept, so turning it on again restores it.                                                                  |
| Scroll wheel over a step                     | Start slice ±1, wrapping round.                                                                                                            |
| Shift + scroll wheel                         | Length ±1, from 1 up to the division.                                                                                                      |
| Right-click                                  | Opens the existing popover with a new **Slice** section: start (a number field), length (− / +), **Random each trigger** ☐ and **Lock** ☐. |

Rows that are not in slice mode behave exactly as they do today.

**Keyboard.** These keys apply when a step on a slice row has focus.
They extend `docs/manual/keyboard-shortcuts.md`.

| Key                         | Action                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrow keys                  | Move focus. The focused step is the selected step.                                                                                                                      |
| `Space` / `Enter`           | Turn the step on or off, as today.                                                                                                                                      |
| `[` / `]`                   | Start slice −1 / +1.                                                                                                                                                    |
| `{` / `}` (Shift+`[` / `]`) | Length −1 / +1.                                                                                                                                                         |
| `R`                         | Turn live random on or off for the step.                                                                                                                                |
| `L`                         | Lock or unlock the step.                                                                                                                                                |
| `D`                         | Roll the editing voice (same as 🎲).                                                                                                                                    |
| `Cmd/Ctrl+Z`                | Undo the last roll. This applies **only** while focus is in the sequencer and the last sequencer action was a roll. Otherwise the key goes to the existing sample undo. |

### 4. Randomization

The aim is to make happy accidents cheap to create, to keep and to
reverse.

**4a. Roll (🎲 button or `D`).** A one-off re-roll of the editing voice.

- A step can be rolled if it is **on**, **not locked**, and **not set to
  live random**.
- **Amount** decides how many of those steps are rolled:
  `ceil(amount × eligible steps)`, picked at random, and always at least
  one. At 25 % the pattern changes gradually. At 100 % it is rewritten
  completely.
- Each rolled step gets a random start slice from `0 … division − 1`,
  every slice equally likely.
- If **Vary length** is on, each rolled step also gets a random length
  from `1 … max`. If it is off, lengths are left as they were.
- The result is **stored**. It plays the same on every loop until the
  next roll, which is how a happy accident is kept.
- Rolled steps flash briefly on the grid so you can see what changed.

**4b. Live random per trigger (a 🎲 step).** Set per step (D10).

- Turn it on from right-click → _Random each trigger_, or with the `R`
  key.
- Every time the step fires (after its A:B condition passes), it picks a
  new random start slice.
- If the voice has **Vary length** on, the step also picks a new random
  length from `1 … max`. Otherwise it uses the step's stored length.
- Rolls never change live-random steps, because they are random already.

**4c. Locks.**

- Rolls skip a locked step. Everything else still works on it: manual
  edits, turning it on or off, and conditions.
- A typical use: lock the kick on slice 1 at step 1 and the snare at
  step 5, then roll everything else until something great comes up.

**4d. Undo roll (D12), one level deep.**

- Just before each roll, the editing voice's slice data is copied in
  memory.
- **↶**, or `Cmd/Ctrl+Z` within the limits above, puts that copy back.
  The undo itself cannot be undone.
- The copy is thrown away, and ↶ disabled, by any manual slice edit on
  that voice, a kit change, or closing the kit.

### 5. Playback behaviour

- When a step on a slice row fires:
  1. The voice's sample mode chooses the slot, as it does today (D9).
  2. The start offset is `offset = start/div × duration`.
  3. The play length is
     `playLength = min(length/div × duration, duration − offset)`.
  4. The region plays with
     `AudioBufferSourceNode.start(when, offset, playLength)`.
- **Monophonic choke.** A new trigger on a voice stops whatever that
  voice is playing, including the same sample at a different slice. This
  matches the existing per-voice choke in `useKitPlayback`; that it matches
  the Rample is unverified on hardware.
- **Anti-click.** A fixed gain ramp of about 2 ms fades in at the start
  of the slice and fades out at its end or when it is choked. Users
  cannot change it in v1.
- Voice volume, per-sample `gain_db`, mute, stereo linking and A:B
  conditions all work as before.
- On the voice-panel waveform thumbnail, the playhead moves only across
  the part being played, not the whole file.
- **Timing requirement.** Playing a one-bar loop sliced at `/16`, in
  order and at its own BPM, must sound continuous, with no audible gaps
  or flams between slices. The target is trigger jitter of 5 ms or less.
  See [Risks](#risks-and-mitigation).

### 6. Edge cases

| Situation                                                                | Behaviour                                                                                                                                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The sample in the active slot is replaced or deleted                     | Slices are proportional, so the pattern still works with the new audio. If the voice ends up empty, slice steps make no sound and the ✂ toggle is disabled, but the data is kept. |
| The voice's slots are different lengths                                  | Each trigger slices whichever slot fired, in proportion.                                                                                                                          |
| A length runs past the end of the sample                                 | Playback stops at the end of the sample. It never wraps round.                                                                                                                    |
| Very short slices (for example `/128` of a 0.5 s sample is about 3.9 ms) | Allowed; glitchy on purpose. The anti-click ramp is cut to at most a quarter of the slice.                                                                                        |
| The division is changed                                                  | Every slice row is re-divided. Changing back restores the original positions exactly (see _Storage units_ below).                                                                 |
| The kit is switched while a roll could still be undone                   | The undo copy is thrown away.                                                                                                                                                     |

## Data Model

### Storage units: ticks

Slice positions are stored in **ticks**. Every sample is divided into
**384** ticks. 384 is the least common multiple of all the offered
divisions (8, 12, 16, 24, 32, 48, 64 and 128). This has two effects:

- Every slice boundary in every division falls exactly on a tick.
- Changing the division re-divides the stored ticks **when they are
  read**, and never rewrites the stored data. So `/16 → /12 → /16` gives
  back the original pattern. That also makes trying other divisions a
  safe way to generate happy accidents.

Converting between ticks and slices:

- `startSlice = floor(startTicks × div / 384)`
- `lengthSlices = max(1, round(lengthTicks × div / 384))`
- An edit made at a given division stores that division's boundary:
  `ticks = slice × 384 / div`.

### Schema changes (migration `0012_*`)

```ts
// shared/db/schema.ts

// kits
slicer_division: integer("slicer_division").notNull().default(16),
  // one of 8 | 12 | 16 | 24 | 32 | 48 | 64 | 128
slice_steps: text("slice_steps", { mode: "json" }).$type<
  (SliceStep | null)[][] | null
>(),
  // [voice 0-3][step 0-15]; null = no slice data for that step

// voices
slice_enabled: integer("slice_enabled", { mode: "boolean" })
  .notNull().default(false),
slice_roll_amount: integer("slice_roll_amount").notNull().default(100),
  // 25 | 50 | 75 | 100
slice_vary_length: integer("slice_vary_length", { mode: "boolean" })
  .notNull().default(false),
slice_max_length: integer("slice_max_length").notNull().default(2),
  // 1 | 2 | 4 | 8 (slices)
```

```ts
// app/renderer/components/hooks/shared/sliceConstants.ts (new)
export const SLICE_TICKS = 384;
export const SLICER_DIVISIONS = [8, 12, 16, 24, 32, 48, 64, 128] as const;
export type SlicerDivision = (typeof SLICER_DIVISIONS)[number];

export interface SliceStep {
  start: number; // ticks, 0 … SLICE_TICKS - 1
  length: number; // ticks, 1 … SLICE_TICKS
  random: boolean; // live random per trigger (D10)
  locked: boolean; // skipped by rolls
}
```

- `slice_steps` sits next to `step_pattern` and `trigger_conditions`.
  It is saved the same way `useStepPattern` and `useTriggerConditions`
  save theirs: update the UI first, save over IPC, and roll back if the
  save fails.
- Slice data for steps that are off is **kept**, so turning a step off
  and on again restores its slice.
- A `null` cell means "no slice chosen yet" and plays the **sequential
  default** (step _n_ → slice `n mod division`). Turning slice mode on
  therefore needs no data write, and the defaults follow the division.
- The undo-roll copy lives in renderer memory only and is never saved.
- Slice data is **not synced** to the SD card.
- Update `docs/developer/romper-db.md`.

### IPC additions

| Channel                       | Payload                                                                    |
| ----------------------------- | -------------------------------------------------------------------------- |
| `update-slice-steps`          | `kitName, sliceSteps`                                                      |
| `update-kit-slicer-division`  | `kitName, division`                                                        |
| `update-voice-slice-settings` | `kitName, voiceNumber, { enabled?, rollAmount?, varyLength?, maxLength? }` |

Wire these through `electron/main/dbIpcHandlers.ts`,
`electron/preload/index.ts` and `shared/electronApi.ts`, following the
existing `update-trigger-conditions` and `update-voice-sample-mode`
handlers.

## Implementation Plan

### Phase 0: timing spike (small, done first)

- Measure trigger jitter on today's path (worker → React state →
  `SampleWaveform` effect), using a `/16` loop at 120–170 BPM.
- If jitter is over 5 ms, or gaps are audible, give the slicer a
  **scheduled playback path**:
  - one shared `AudioContext`,
  - slice sources scheduled a short time ahead on the audio clock with
    `start(when, …)`,
  - still driven by the existing worker.

  Voices that are not slicing can move to this path later.

- Record the measurement and the chosen path in a short note in this
  spec.

> **Phase 0 outcome (2026-09-30).** Measured in the built Electron app
> (under Xvfb, fake audio output) by recording every
> `AudioBufferSourceNode.start()` call during a sliced `/16` loop at 120 BPM,
> where the ideal step is 125 ms:
>
> | Path                                                  | Step interval (min / median / max) |
> | ----------------------------------------------------- | ---------------------------------- |
> | Existing: `setInterval` worker, sound started at once | 114.6 / 126.9 / 137.0 ms           |
> | New: drift-free worker, sound scheduled 80 ms ahead   | 125.0 / 125.0 / 125.0 ms           |
>
> The old path had about ±10 ms of jitter. It also drifted: `setInterval`
> ran slow, so 120 BPM played at about 118. That fails the 5 ms target, so
> the **scheduled path was built**, and it applies to **every voice**, not
> only slice voices, so voices can't flam against each other:
>
> - The worker times each step from the start (self-correcting
>   `setTimeout`) and sends the step's ideal time with it.
> - Each trigger carries `startAt` = ideal time + `SCHEDULE_AHEAD_MS`
>   (80 ms). `SampleWaveform` maps that to its audio clock with
>   `getOutputTimestamp()`. `currentTime` alone moved in ~10 ms chunks and
>   still jittered.
> - Chokes and retriggers stop the old sound **at the new sound's start
>   time** (`stopAt`), so scheduling ahead never opens a gap.
> - The cost is that sound lags the on-screen playhead by 80 ms. Previews
>   you click still play immediately.
>
> Still to confirm by ear on real hardware: success criterion 1.

### Phase 1: core slice playback

- Add region playback. Pass `offset` and `duration` with the play trigger
  through `useKitPlayback.handlePlay` and `SampleWaveform`, or use the
  scheduled path from Phase 0. This includes the anti-click ramp and the
  playhead calculation.
- Add the migration and schema changes.
- Add `sliceConstants.ts`: tick conversion, the sequential default, and
  the re-division helpers.
- Add the `useSliceSteps` hook and the IPC handlers.
- Add the ✂ toggle to each row, apply the sequential default when it is
  turned on, and show slice numbers on steps.
- Make the trigger logic choose the slot first, then the slice, then the
  region to play.

### Phase 2: slice strip and editing

- Build the `SliceStrip` component: full-width waveform, slice lines,
  labels, selection highlight, ticks for used slices, and the flash on
  the slice that is playing.
- Add the kit-wide division dropdown. Changing the division must not
  lose stored data.
- On slice rows, add the select-versus-toggle clicks, the scroll-wheel
  nudges, the new popover section and the keyboard shortcuts.
- Add editing-voice selection and the voice tabs.

### Phase 3: randomization

- Add rolls, with the amount, vary-length and max-length settings stored
  per voice.
- Add live random per step, locks, and the flash on rolled steps.
- Add single-level undo of a roll, including the scoped `Cmd/Ctrl+Z`.

### Phase 4: docs and polish

- Add a **Slicer** section to `docs/manual/step-sequencer.md`.
- Update `docs/manual/keyboard-shortcuts.md`.
- Take new screenshots with `scripts/capture-screenshots.ts`.
- Update `docs/developer/romper-db.md`.

## Test Plan

**Unit tests for `sliceConstants`:**

- tick ↔ slice conversion for every division,
- `/16 → /12 → /16` returning the original pattern,
- the sequential default wrapping round (`/8` over 16 steps),
- lengths shortened at the end of the sample,
- a minimum length of one slice.

**Unit tests for rolls.** Use an injectable seeded random number
generator so results are repeatable. Check that:

- only eligible steps change,
- the amount calculation is right, including the minimum of one step,
- varied lengths stay within their bounds,
- locked and live-random steps are untouched,
- undo restores the exact copy, and a manual edit throws the copy away.

**Hook tests for `useKitStepSequencerLogic`.** Check that:

- a slice step calls the playback callback with the right offset and
  duration,
- the slot is chosen by sample mode before the slice is applied,
- live random picks a slice within range,
- A:B conditions and mute still apply.

**Component tests for `StepSequencerGrid` and `SliceStrip`:**

- the ✂ toggle,
- the select-versus-toggle clicks,
- the scroll-wheel nudges,
- the popover fields,
- the keyboard shortcuts,
- assigning slices by clicking and dragging on the waveform,
- aria labels.

**Integration and database tests:**

- the migration applies to an existing database and fills in defaults,
- `slice_steps` and the voice settings survive a save and reload,
- the IPC rollback path.

**End-to-end test (Playwright).** Turn on slice mode for a voice and see
sequential numbers. Roll, undo, change the division and change it back.
The state must persist after reopening the kit.

## Success Criteria

1. With slice mode on at `/16`, a one-bar break plays back as the
   original loop at its own BPM, with no audible gaps.
2. Any step that is on can be pointed at any slice and length with **one
   click** on the waveform.
3. One click on 🎲 audibly changes the pattern, and one click on ↶ brings
   back the previous pattern exactly.
4. A roll never changes a locked step. Live-random steps change from loop
   to loop.
5. Changing the division and then changing it back leaves the pattern
   exactly as it was.
6. Voices that are not in slice mode behave exactly as before, and all
   existing sequencer tests pass.
7. Slice data is saved per kit and survives restarting the app.

## Risks and Mitigation

- **Risk:** the `setInterval` + React timing may be too jittery, so
  slices flam or leave gaps. That would spoil the central "it plays the
  loop back" moment.
  **Mitigation:** the Phase 0 spike, falling back to scheduling slice
  voices on the `AudioContext` clock.
- **Risk:** playback currently needs each slot's `SampleWaveform` to be
  mounted, and every slot has its own `AudioContext`.
  **Mitigation:** if Phase 0 adds a shared scheduled path, decode and
  cache the audio buffers there instead of in the thumbnail.
- **Risk:** on slice rows a click selects a step before it turns it off.
  Normal rows don't behave that way, so this may surprise people.
  **Mitigation:** it only happens on rows showing ✂. The selected step
  has its own ring, and the manual explains the behaviour.
- **Risk:** `Cmd/Ctrl+Z` is also the shortcut for undoing sample edits.
  **Mitigation:** it undoes a roll only while focus is in the sequencer
  and the last sequencer action was a roll. Otherwise it goes to sample
  undo.
- **Risk:** the new single-key shortcuts (`R`, `L`, `D`, `[`, `]`) may
  clash with Kit Editor shortcuts.
  **Mitigation:** they only work while a step on a slice row has focus.
  Check them against `useKitEditorKeyboardNav.ts` during Phase 2.
- **Risk:** the preview differs from the hardware. There is no EXP
  division, the anti-click fade is fixed, and nobody has checked how the
  Rample turns CC values into slices.
  **Mitigation:** the feature is presented as a preview. The divisions
  and the start/length behaviour follow the manual. Checking against real
  hardware is left for any future MIDI export work.

## Open Questions

1. **D9, "active slot".** This spec reads it as _the slot chosen by the
   voice's sample mode when the step fires_, with the strip showing the
   slot selected in the voice panel. It could instead mean _a slot pinned
   in the UI that overrides sample mode while slicing_. That change is
   small: add a `slice_slot` voice setting and skip `selectSample`.
2. Should the roll settings (amount, vary length, max length) be stored
   per voice, as specified here, or once for the whole kit?

## Out of Scope

- Exporting a MIDI file (notes plus CC4/CC5), and sending live MIDI to a
  Rample.
- The `EXP` division and arbitrary slice counts.
- Randomizing which steps are on (rhythm dice).
- Undo history for more than one roll.
- Choosing the slot per step. Per-step sample choice is still a separate
  possible enhancement in `docs/developer/product-requirements.md`.
- Syncing slice data or the SLICER setting to the SD card.
- Swing, per-step velocity, pitch, and other per-step parameter changes.

---

## Implementation Notes

### Related Files

- `app/renderer/components/KitStepSequencer.tsx`: row state and wiring.
- `app/renderer/components/StepSequencerGrid.tsx`: `StepButton`,
  `ConditionPopover` and the per-row controls.
- `app/renderer/components/StepSequencerDrawer.tsx`: the drawer that
  will hold the slice strip.
- `app/renderer/components/SampleWaveform.tsx`: region playback, the
  playhead and anti-click.
- `app/renderer/components/hooks/kit-management/useKitStepSequencerLogic.ts`:
  step trigger, then slot, then slice.
- `app/renderer/components/hooks/kit-management/useKitPlayback.ts`:
  what `handlePlay` receives, and the choke.
- `app/renderer/components/hooks/kit-management/useKitEditorLogic.ts`:
  hook wiring and the selected slot.
- `app/renderer/components/hooks/shared/stepPatternConstants.ts`, plus
  the new `sliceConstants.ts` and `useSliceSteps.ts`.
- `shared/db/schema.ts`, `electron/main/db/migrations/`,
  `electron/main/db/operations/kitCrudOperations.ts` and
  `voiceCrudOperations.ts`.
- `electron/main/dbIpcHandlers.ts`, `electron/preload/index.ts` and
  `shared/electronApi.ts`.
- `docs/manual/step-sequencer.md`, `docs/manual/keyboard-shortcuts.md`
  and `docs/developer/romper-db.md`.

### References

- Squarp Rample manual: <https://squarp.net/rample/manual/>
  - _Advanced parameters_: start point and length.
  - _Note about start point & sample length_: the `/16` slicing
    animation and the EXP illustration.
  - _Settings → SLICER_ and _Settings → ANTICLIC_.
  - _MIDI implementation chart_: CCx4 is start point (0 is the default)
    and CCx5 is length (127 is the default). x is the voice (1–4), or 5
    for all voices.
- `docs/manual/step-sequencer.md`: how the sequencer works today.
- `docs/developer/product-requirements.md`: sequencer non-goals and possible future enhancements.
