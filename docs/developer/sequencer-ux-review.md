<!--
title: Step Sequencer UX Review and Proposal
priority: medium
status: accepted; Phase 0 merged (#371); refresh (Phases 1, 2, 4 and part of 3) in progress
updated: 2026-09-30
context_size: medium
-->

# Step Sequencer: UX Review and Proposal

Scope: design and UX only. Nothing here adds a capability the sequencer
doesn't already have. Each item changes how an existing capability looks,
reads, or responds.

Method: I read the sequencer code (`KitStepSequencer`, `StepSequencerGrid`,
`StepSequencerControls`, `SliceStrip`, `SliceStepEditor`, and the logic,
slicer and keyboard hooks), then ran the app in dev mode against a copy of
a real local store. I captured it idle, playing, with the slicer open, with
the right-click popover open, and in both themes. I reproduced the
behaviors marked **verified** in the running app.

## What the sequencer is for

The Rample has no sequencer of its own. Romper's sequencer is an
**audition instrument**: it lets you hear a kit in a musical context before
writing it to the SD card. So it should:

1. **Feel like a TR-style box** (808/909, Elektron, OP-Z). It should be
   instantly readable, put the running light first, and keep everything
   one gesture away.
2. **Behave like a pro desktop app.** That means predictable keys, honest
   undo, discoverable controls, and accessible contrast.
3. **Tell the truth about the hardware.** Voice choke, stereo as a voice
   setting, and slices that match the Rample's SLICER.

Point 3 is already strong. Most of what follows is about points 1 and 2.

## What already works (keep it)

- **Rample livery** on every row (1 red, 2 yellow, 3 green, 4 blue),
  matching the voice panels.
- **The TR layout:** 4×16 with beat groups of four, lit steps, and
  per-row mute.
- **Timing:** a drift-free worker clock with an 80 ms lookahead, so audio
  lands on the grid even when React is busy.
- **Slice steps read well:** the slice number is on the pad, the dice
  marks a random step, and a bar shows length.
- **Experiments are safe:** locks and roll undo exist, and the slicer's
  hint line tells you what to do next.
- **Full keyboard grid navigation** that skips stereo-linked secondary
  rows.

## Findings

Severity: **High** = wrong or destructive behavior; **Med** = slows or
confuses real use; **Low** = polish.
Lens: **SEQ** = classic sequencer practice, **APP** = desktop app UX,
**CODE** = found by reading the code against the pixels.

### A. Defects to fix first

| #  | Sev  | Lens     | Finding |
|----|------|----------|---------|
| A1 | High | APP/CODE | **Escape on the step popover also leaves the kit (verified; RE-59).** Right-clicking a step leaves focus on the step button, not in the popover. Escape then closes the popover (`usePopoverDismiss`) *and* triggers back-navigation (`useGlobalKeyboardShortcuts`), because that handler only skips events whose target is inside a dialog. |
| A2 | High | CODE     | **Cmd/Ctrl+Z doesn't undo a roll in an editable kit (verified; RE-60).** The global undo listener runs in the capture phase on `document` and stops propagation, so the slicer's own Cmd+Z handler never runs. The Undo button's tooltip promises the shortcut. Instead the keypress undoes the last *sample* operation in the kit. |
| A3 | High | APP      | **Pattern edits aren't undoable, and Cmd+Z quietly undoes something else (RE-60).** Step toggles, conditions and slice edits are not on the undo stack. After clicking steps, Cmd+Z reverts an unrelated sample add, move or delete. Decision (Q1): sequencer edits join the kit's undo history. |
| A4 | Med  | APP      | **Two "current step" selections can disagree.** The slice strip follows the last *clicked* step, while the right-click popover edits the step under the pointer. With step 5 selected, right-clicking step 9 shows "Step 5 plays slice 5" in the strip beside a popover for step 9. Right-click should also select its step. |

### B. Classic sequencer lens

| #  | Sev | Finding | Proposal |
|----|-----|---------|----------|
| B1 | Med | **The running light is weak**, especially in the light theme: a 2 px white ring on light-grey off-steps. On a TR, the chase light is the brightest thing on the panel. | Light the whole **playhead column**: a soft band behind all four rows, plus a marker in a step ruler (B2). On-steps should *fire* (a brief brighten) when they trigger, which also shows the effect of conditions and mutes. |
| B2 | Med | **No step ruler, and beat groups are faint.** Groups are split only by a 1 px line at 30% opacity. The 808 colors its four groups so you can read position at a glance. | Add a thin ruler above the grid (1 · 5 · 9 · 13, or beats 1–4) that carries the playhead marker. Give alternating beat groups a slightly different off-step tint instead of hairlines. |
| B3 | Med | **No keyboard transport.** In every DAW and most grooveboxes, Space starts and stops playback. Here Space toggles the focused step, and nothing starts playback from the keyboard. | **Space = play/stop** while the sequencer is open; **Enter toggles the step**. Space keeps previewing the selected sample when the sequencer is closed, as now. (Q2) |
| B4 | Med | **Conditions are cryptic.** The menu lists bare `1:2 … 4:4`, which is Elektron shorthand that newcomers can't read. On slice rows the condition is 7 px text in a corner. White-on-yellow `2:2` on voice 2 has poor contrast. | Draw conditions as **four pips** (●○○○ = 1:4) on the pad and next to each menu option, with a plain-language line such as "Plays on loop 2 of every 4". Use dark ink on the light voice colors (yellow, green). |
| B5 | Low | **The cycle counter hides when stopped** and moves the transport column when it appears. Conditions depend on it, but the UI never shows the 4-loop cycle. | Always show a **4-pip loop indicator** under BPM and light the current loop. It explains A:B conditions without any extra text. |
| B6 | Low | **Row labels sit on a 40%-tint chip** that looks disabled. | Keep the labels **numbers only**, like the hardware (Q3). Use a full-color chip, and make it **flash when its voice fires**, like a trigger LED. |
| B7 | Low | **BPM is a bare number field.** Arrow keys work only after clicking in, and the 30–180 limits aren't visible. | Make it a scrub field: drag or scroll to change, Shift for ×10, and double-click to type. Same control, hardware-style handling. |
| B8 | Low | **Play is shown in amber**, the same color as "Modified" and warnings. | Use the `--transport-play` token only for transport, and don't reuse that hue for warnings, or move transport to a "running" color. This is a design-token decision. |

### C. Desktop app UX lens

| #   | Sev | Finding | Proposal |
|-----|-----|---------|----------|
| C1  | Med | **Four unlabeled icon controls per row** (scissors, a 3-state mode icon, speaker, slider) with no column headers. You only learn what sample mode does from its tooltip, and it cycles blindly on click. | Add tiny **column headers** (Slice · Mode · Mute · Level) above row 1. Show the mode as a 3-way segmented control or a small menu with labels. Use a hardware-style **M** button for mute with a clear lit state. Show the level value while hovering or dragging. |
| C2  | Med | **Muting dims the whole row to 40%**, including the unmute button and the level slider. The control you need next is the faded one. | Dim only the **steps**; keep the row's controls at full strength. |
| C3  | Med | **Session state and saved kit settings look the same.** Mute lasts for the session only, while slice, mode and level are saved to the kit. Side by side, they look identical. | Group them: performance controls (Mute) beside the row label; saved kit settings (Slice, Mode, Level) on the right. The position then tells you what persists. |
| C4  | Med | **Hidden gestures and keys.** Right-click opens step options, scroll nudges slices, and `[ ] { } D L R` work in the grid, but only tooltips mention them. | Generalize the slicer's hint line into a **sequencer status line**: one contextual sentence, plus a `?` overlay listing the keys. Show a small corner tick on hover for pads that have a right-click menu. Put an `S` keycap on the Show/Hide handle. |
| C5  | Low | **The focus ring always shows** (step 1 has a blue ring even when the grid isn't focused), and it's the same blue as the slicer's selected step. | Apply `:focus-visible` semantics to the grid: show the ring only while the grid has keyboard focus. Give the slice selection its own treatment (voice-colored underline). |
| C6  | Low | **LED glow bleeds** about 12 px onto neighboring off-steps and tints them, so they read as half-lit. | Tighten the glow (smaller spread, or inset glow) so off-steps stay crisp. |
| C7  | Med | **The slice strip doesn't line up with the grid.** The strip is 960 px wide and the grid has its own width, so slice *n* doesn't sit above step *n*, even though step *n* plays slice *n* by default at /16. | Give the strip the grid's column geometry: at /16 each slice sits exactly above its step; at /8 each slice spans two steps; at /32 two slices share a step. The waveform then becomes a ruler for the grid. |
| C8  | Low | **The slicer toolbar is crowded**: Slices, Roll, Undo, Amount, Vary length, "up to", and Close, all on one line. | Keep **Slices**, **Roll** and **Undo** on the toolbar. Move Amount, Vary length and Max length into a small ▾ menu attached to Roll. |
| C9  | Low | **Drawer height is fixed.** With the slicer open, the drawer covers about 45% of the window and hides voice slots 9–12. | Use a draggable top edge with a remembered height, or move the slicer strip into its own collapsible band. This is a layout change, not a new capability. |
| C10 | Low | **Pads are dense with states.** A 32 px pad can show up to 13 states (see D2) drawn with four different methods. | Adopt the state-layer spec in D2 so every new state has a defined place. |

### D. What I added as a reviewer

You asked me to bring my own strengths. Three things came from reading
the code and the running UI side by side, and from having no muscle
memory for the app:

**D1. Event plumbing is part of UX.** A1 and A2 never show in a
screenshot. They come from listener order: a capture-phase `document`
listener runs before the grid's handlers, and Escape is handled in two
places. The fix is a rule: **the sequencer owns Escape, Space, Enter and
Cmd+Z while it has focus.** Global shortcuts should yield to it, not race
it. One keyboard-routing table, kept in the spec and tested, prevents the
next collision.

**D2. A state vocabulary for the step pad.** I listed every state a pad
can show today: off, on, focused, playhead, condition (on), condition
(off-dot), slice number, random (dice), locked, length bar, roll flash,
hover preview, and selected. Those are 13 states in 32 px. Proposed
layers, one job each:

| Layer            | Carries            |
|------------------|--------------------|
| Fill             | On / off           |
| Center glyph     | What plays (slice number, dice) |
| Top-left         | Condition pips     |
| Top-right        | Lock               |
| Bottom edge      | Length bar         |
| Outer ring       | Keyboard focus only |
| Column band      | Playhead           |
| Brief brighten   | Fired / just rolled |

With this table, a state can only be added where it has a slot, and
tests can assert each layer.

**D3. A first-time user's view.** I come to the app fresh each session,
so I hit the discoverability gaps (C1, C4, B4) first. Those are the same
gaps a new Rample owner hits in their first five minutes. The product
requirements target "first kit within 5 minutes", and the sequencer is
part of that journey.

## Proposed layout (sketch)

```
            1       5       9       13            Slice Mode  M  Level
          ▼ ·   ·   · │ ·   ·   · │ ·   ·   · │ ·   ·   ·
 ▶  ┌──────┐┌───────────────┬───────────────┬───────────────┬───────────────┐
120 │1 Kick││ ■ □ □ □ │ ■ □ □ □ │ ■ □ □ □ │ ■ □ ●● ●●  │  ✂    1st   M  ▬▬▬○
BPM │2 Clap││ □ □ □ □ │ ■ □ □ □ │ □ □ ●○ ○● │ □ □ □ □   │  ✂    1st   M  ▬▬▬○
●○○○│3 HH  ││ □ □ ■ □ │ □ □ ■ □ │ □ □ ■ □ │ □ □ ■ □   │  ✂    R-R   M  ▬▬○─
loop│4 Flex││ □ ■ ■ ■ │ □ ■ ■ ■ │ □ ■ ■ ■ │ □ ■ ■ ■   │  ✂    Rnd   M  ▬▬○─
    └──────┘└─────────▲─────────────────────────────────────────────────────┘
                 playhead column band
 Status: Space play/stop · Enter toggle · right-click step options · ? keys
```

## Decisions (2026-09-30)

- **Q1:** step, condition and slice edits go into the kit's undo history.
- **Q2:** Space plays and stops; Enter toggles the step.
- **Q3:** row labels stay numbers only.
- **Size:** controls may grow. The window has plenty of free space, so
  pads, the transport and the row controls can be bigger than today's
  32 px pads.

## Plan

Each phase is one PR. Phase 0 is fixes. Phases 1–4 are independent of
each other and can land in any order.

| Phase | Items | Size | Notes |
|-------|-------|------|-------|
| 0. Fixes and keys | A1–A4, B3 | M | Merged in #371; see "Keyboard routing" below. |
| 1. Readability | B1, B2, B4 (visual), B6, C2, C5, C6, D2 | M | Done in the refresh branch (`claude/sequencer-refresh`). |
| 2. Row controls | C1, C3, B7, B8 | M | Done in the refresh, except B8: transport keeps its amber. |
| 3. Discoverability | B4 (menu), B5, C4 | S–M | B4 menu and B5 done in the refresh; C4 (status line, `?` overlay, keycaps) open. |
| 4. Slicer layout | C7, C8, C9 | M | C7 and C8 done in the refresh; C9 partly (the drawer may grow to 640 px; no drag handle). |

### The refresh, as built

- **Size:** pads scale with the window, 32–48 px wide and up to 40 px
  tall (`sequencerLayout.ts`, CSS variables on the sequencer root).
- **Playhead:** a lit column over the ruler and all rows, a running light
  in the step ruler, and a flash on each pad that fires. A step whose
  condition isn't met this loop doesn't flash.
- **Beat groups:** off pads alternate shade by beat; no hairlines.
- **Rows:** a full-color number chip (numbers only) that flashes when the
  voice fires; an **M** mute button beside it; then the pads (only they
  dim when muted); then the saved settings under column headers: Slice,
  a 3-way **Sample** switch (1st / Rnd / R-R), and **Level** with its
  value.
- **Conditions:** drawn as dots (●○○○ = 1:4) on the pad, and in the
  popover with a plain-language line.
- **Transport:** a 56 px Play/Stop, a BPM field you can scroll (Shift:
  ×10), and a four-dot loop indicator that is always shown.
- **Ink:** text on lit voice colors uses `--voice-N-ink` (dark on yellow
  in light mode; dark on all voices in dark mode).
- **Slicer:** the waveform shares the step columns' geometry, so at /16
  slice n sits above step n. Roll's settings moved into a ▾ menu next to
  Roll.

Verification for each phase: unit tests for state and keyboard routing,
then screenshots of the running app (`run-app` skill) in both themes,
idle and playing. Phase 0 also gets an e2e check that Escape on the
popover keeps you in the kit.

## Keyboard routing (Phase 0)

Components that own a key handle it first. The app-wide shortcut listener
(`useGlobalKeyboardShortcuts`) runs in the bubble phase on `document` and
skips events already marked handled (`defaultPrevented`).

| Key | Where focus is | Does |
|-----|----------------|------|
| `Space` | Grid, or anywhere except a button, field or select, while the sequencer shows | Play / stop |
| `Enter` | Grid | Toggle the focused step |
| `Escape` | Step options popover (takes focus when it opens) | Close it; focus returns to the grid |
| `Escape` | Grid, slicer open | Close the slicer |
| `Escape` | Grid, slicer closed | Back to the kit list |
| `Cmd/Ctrl+Z`, `Shift+Z`, `Y` | Anywhere but a text field | Undo / redo. Sample edits only in editable kits; sequencer edits always. |

Key events from portalled popovers bubble through React to the grid, so
the grid ignores events whose target is outside its own DOM.

Undo records a `SEQUENCE_EDIT` action holding the step pattern, trigger
conditions and slice steps before and after the edit
(`useSequenceHistory`). Undo and redo write the snapshot back over IPC,
then reload the kit. Edits with the same merge key within one second
merge into one undo step: scroll-wheel nudges of one step, or a slice
click that also turns its step on. The slice strip's Undo button undoes
the next action when it is a sequencer edit.
