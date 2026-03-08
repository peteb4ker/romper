---
layout: manual
title: Kit Editor
prev_page:
  url: /manual/kit-browser
  title: Kit Browser
next_page:
  url: /manual/syncing
  title: Syncing
---

The Kit Editor view is where you build and audition your kits. It shows all four voices with their sample slots, playback controls, and the step sequencer.

## Opening a Kit

Click any kit card in the Kit Browser to open it. The header shows:

![Kit Details header]({{ site.baseurl }}/images/manual/kit-editor-header.png)

- **Back button** -- Returns to the Kit Browser
- **Kit navigation** -- Previous/Next arrows to step through kits sequentially (or use `,` and `.` keys)
- **Kit ID and name** -- The bank/slot and editable name field
- **Favorite bookmark** -- Toggle bookmark
- **Lock toggle** -- Protect the kit from edits
- **Scan Kit button** -- Re-analyze samples and refresh voice name detection

## Voice Panels

The main area shows four voice panels, one for each of the Rample's voices. Each panel is color-coded:

![Voice panel]({{ site.baseurl }}/images/manual/voice-panel.png)

- **Voice 1** -- Red
- **Voice 2** -- Yellow
- **Voice 3** -- Green
- **Voice 4** -- Blue

### Voice Header

Each voice panel has a header showing:

- **Voice number and name** -- The name is either manually set or auto-detected from sample filenames (e.g., "Kick", "Snare", "Closed HH")
- **Sample count** -- How many of the 12 available slots are filled

### Sample Slots

Each voice has up to **12 sample slots**, matching the Rample's 12-layer-per-voice capability. Filled slots show:

- **Slot number** (1 through 12)
- **Sample filename**
- **Play button** -- Click to audition the sample
- **Waveform display** -- Visual representation of the audio
- **Delete button** -- Remove the sample from this slot

## Assigning Samples

### Drag and Drop

The primary way to add samples is drag and drop:

1. Open a file browser window alongside Romper
2. Drag one or more `.wav` files from your filesystem onto a voice panel or a specific slot
3. Romper validates the files and assigns them to available slots

**Rules and limits:**

- Only `.wav` files are accepted. Other formats are rejected with a warning.
- A maximum of 12 samples per voice. If you drop more than 12, only the first 12 are added.
- Duplicate samples within the same voice are prevented.
- Dropping a duplicate sample that already exists in a *different* voice triggers a warning but is allowed.
- Drop targets highlight as you drag over them so you can see exactly where samples will land.

### Stereo and Mono Handling

The Rample supports both mono and stereo playback, and Romper handles this with two levels of control:

**Global setting** -- In Settings, the **Treat Stereo as Mono** toggle (on by default) controls the default behavior. When enabled, stereo samples are treated as two linked mono channels during sync.

**Per-sample override** -- Each sample row has a stereo/mono toggle that overrides the global setting for that specific sample. When a stereo sample is set to mono mode, it occupies its own slot plus the matching slot in the next voice (stereo linking). If there isn't room, Romper shows a warning.

### Voice Names and Kit Type

Romper automatically analyzes sample filenames to suggest voice names. For example, if Voice 1 contains files named `KICK_LOW_01.wav`, `KICK_LOW_02.wav`, etc., Romper labels that voice "Kick".

You can also name voices manually by editing the name field in the voice header.

The **kit type** (Drum, Loop, Vocal, FX, Synth/Bass) is inferred from the combination of voice names. A kit with voices named Kick, Snare, HiHat, and Clap would be classified as a Drum kit.

Click the **Scan Kit** button (or press `/`) to re-run the analysis at any time.

## Previewing Samples

### Single Sample Playback

Click the **play icon** on any sample row to hear it. The currently playing sample is highlighted. Click again or click a different sample to stop it.

**Voice choke**: Each voice is monophonic -- when you trigger a new sample on a voice, any previously playing sample on that voice stops automatically. This mirrors how the Rample hardware behaves.

**Volume**: Adjust the global preview volume using the slider in the status bar at the bottom of the window.

### Step Sequencer

The step sequencer lets you audition all four voices together in a rhythmic pattern. Rather than clicking individual play buttons, you can program a looping 16-step sequence that plays your kit's samples in context -- hear how a kick, snare, hi-hat, and clap work together before syncing to the Rample.

Toggle the sequencer with the **Show/Hide Sequencer** button at the bottom of the kit view, or press `S`.

![Step sequencer]({{ site.baseurl }}/images/manual/step-sequencer.png)

#### Grid Basics

The sequencer is a **4-row, 16-step grid** representing one bar of 16th notes:

- Each row corresponds to one voice (Voice 1 through 4, top to bottom)
- Click any step to toggle it on or off
- Active steps are highlighted in the voice's color with an LED glow effect
- Vertical dividers mark every 4 steps (beat boundaries) for visual orientation

#### Transport Controls

![Transport controls]({{ site.baseurl }}/images/manual/transport-controls.png){: .img-left}

On the left side of the sequencer:

- **Play/Stop button** -- Start or stop playback. The button glows orange while playing
- **BPM control** -- Set the tempo (30--180 BPM). Click the field to type a value, or use the up/down arrow keys to nudge by 1 BPM
- **Cycle counter** -- Appears during playback, showing which cycle (loop repetition) the sequencer is on. This is especially useful with trigger conditions (see below)

A moving **playhead** highlights the current step during playback with a white ring.

#### Trigger Conditions (Step Logic)

![Condition popover]({{ site.baseurl }}/images/manual/condition-popover.png){: .img-right}

Trigger conditions let you control *which cycles* a step fires on, effectively creating patterns much longer than 16 steps. Right-click any step to open the condition popover.

Each condition uses an **A:B** format, meaning "fire on the Ath repetition of every B cycles":

| Condition | Meaning | Effective pattern length |
|-----------|---------|--------------------------|
| **Always** (default) | Fires every cycle | 16 steps |
| **1:2** | Fires on odd cycles (1st of every 2) | 32 steps |
| **2:2** | Fires on even cycles (2nd of every 2) | 32 steps |
| **1:4** | Fires on the 1st of every 4 cycles | 64 steps |
| **2:4** | Fires on the 2nd of every 4 cycles | 64 steps |
| **3:4** | Fires on the 3rd of every 4 cycles | 64 steps |
| **4:4** | Fires on the 4th of every 4 cycles | 64 steps |

For example, to create a snare that only hits every other bar: activate a step on the snare row and set its condition to **1:2**. To build a fill that only plays on the 4th repetition, use **4:4**. By combining different conditions across steps, you can create evolving patterns up to 64 steps long within the 16-step grid.

Active steps with a trigger condition display the condition label (e.g., "4:4") on the step button. Inactive steps with a condition show a small dot as a reminder.

#### Sample Selection Mode

When a voice has multiple samples loaded, the sample mode button (to the right of the step grid) controls which sample plays on each trigger. Click the button to cycle through three modes:

- **1st** (first) -- Always plays the first sample in the voice. This is the default
- **Rnd** (random) -- Randomly picks a sample from the voice on each trigger, adding natural variation
- **R-R** (round-robin) -- Cycles through samples in order (1st trigger plays sample 1, 2nd plays sample 2, and so on), then wraps back to the beginning

Round-robin and random modes are powerful for creating realistic drum patterns -- load multiple kick or hi-hat variations into a single voice and let the sequencer cycle through them automatically.

#### Voice Volume and Mute

![Voice controls]({{ site.baseurl }}/images/manual/voice-controls.png){: .img-left}

Each voice has a **volume slider** on the right side of its row. Drag the slider to adjust that voice's playback volume (0--100%). Volume changes are saved to the kit.

The **speaker icon** next to the volume slider toggles mute for that voice. When muted:

- The voice is silenced during sequencer playback
- The row fades to reduced opacity as a visual indicator
- Mute state is session-only and resets when you reopen the kit

Muting is useful for isolating voices -- mute everything except the hi-hat to focus on its pattern, or mute a voice temporarily while adjusting the others.

#### Stereo Linked Channels

When two voices are configured for stereo playback (e.g., Voices 1+2 or Voices 3+4), the sequencer automatically combines them into a **single stereo row**. The primary voice's label changes to show the pairing (e.g., "1+2"), and the secondary voice's row is hidden. Steps, trigger conditions, volume, mute, and sample mode all control both channels together through the primary voice's row.

#### Persistence

Sequencer patterns, trigger conditions, BPM, and sample modes are all saved per-kit in the database. Your patterns persist across sessions. Voice mutes are session-only.

#### Sequencer Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Show/hide sequencer | `S` |
| Toggle step | `Space` or `Enter` |
| Navigate steps | Arrow keys |

## Navigating Between Kits

You don't need to return to the Kit Browser to switch kits. Use:

- **Previous kit**: `,` (comma) key or the left arrow in the header
- **Next kit**: `.` (period) key or the right arrow in the header

This lets you quickly compare kits side by side.
