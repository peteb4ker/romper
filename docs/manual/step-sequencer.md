---
layout: manual
title: Step Sequencer
prev_page:
  url: /manual/kit-editor
  title: Kit Editor
next_page:
  url: /manual/syncing
  title: Syncing
---

The step sequencer lets you audition all four voices together in a rhythmic pattern. Rather than clicking individual play buttons, you can program a looping 16-step sequence that plays your kit's samples in context -- hear how a kick, snare, hi-hat, and clap work together before syncing to the Rample.

Toggle the sequencer with the **Show/Hide Sequencer** button at the bottom of the kit view, or press `S`.

![Step sequencer]({{ site.baseurl }}/images/manual/step-sequencer.png)

## Grid Basics

The sequencer is a **4-row, 16-step grid** representing one bar of 16th notes:

- Each row corresponds to one voice (Voice 1 through 4, top to bottom)
- Click any step to toggle it on or off
- Active steps are highlighted in the voice's color with an LED glow effect
- Vertical dividers mark every 4 steps (beat boundaries) for visual orientation

## Transport Controls

![Transport controls]({{ site.baseurl }}/images/manual/transport-controls.png){: .img-left}

On the left side of the sequencer:

- **Play/Stop button** -- Start or stop playback. The button glows orange while playing
- **BPM control** -- Set the tempo (30--180 BPM). Click the field to type a value, or use the up/down arrow keys to nudge by 1 BPM
- **Cycle counter** -- Appears during playback, showing which cycle (loop repetition) the sequencer is on. This is especially useful with trigger conditions (see below)

A moving **playhead** highlights the current step during playback with a white ring.

## Trigger Conditions (Step Logic)

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

## Sample Selection Mode

When a voice has multiple samples loaded, the sample mode button (to the right of the step grid) controls which sample plays on each trigger. Click the button to cycle through three modes:

- **1st** (first) -- Always plays the first sample in the voice. This is the default
- **Rnd** (random) -- Randomly picks a sample from the voice on each trigger, adding natural variation
- **R-R** (round-robin) -- Cycles through samples in order (1st trigger plays sample 1, 2nd plays sample 2, and so on), then wraps back to the beginning

Round-robin and random modes are powerful for creating realistic drum patterns -- load multiple kick or hi-hat variations into a single voice and let the sequencer cycle through them automatically.

## Slicer

The slicer plays **parts of a long sample** from each step -- a drum break, a vocal phrase, a chord progression -- the same way the Rample plays a slice when an external sequencer sends it *start point* and *length* (CC x4 and CC x5).

**To slice a sample:**

1. Put a long sample in one of the voice's slots.
2. Click the **✂** button at the right of that voice's sequencer row.
3. A waveform strip appears above the grid, cut into slices, and every lit step in the row shows the slice it plays. Step 1 plays slice 1, step 2 plays slice 2 and so on, so a one-bar loop sliced into 16 plays back as the original loop at its own tempo.
4. Press **Play**, then start changing things.

**To choose what a step plays**, click the step, then click a slice on the waveform. Drag across several slices for a longer hit. Hovering a step shows its slice on the waveform; clicking a slice plays it so you can explore the sample by ear (Alt/Option-click plays it without assigning it). The line under the waveform always tells you what to do next.

On a slice row, clicking a lit step **selects** it; clicking the selected step again turns it off. The scroll wheel over a step moves it to the previous or next slice (Shift + scroll changes its length), and right-clicking a step lets you type a slice number, change the length, make it random, or lock it.

**Slices** sets how many equal parts the sample is cut into: /8, /12, /16, /24, /32, /48, /64 or /128, like the Rample's **SLICER** setting. It applies to the whole kit. Changing it never loses anything -- switch back and your slices are exactly where they were -- so trying another division is a quick way to find something new.

### Happy accidents

- **🎲 Roll** gives the row's steps random slices. The result stays put, so when something great comes up, keep it. **Undo** takes back the last roll, or any other sequencer edit.
- **Amount** decides how much a roll changes: 25% nudges the pattern, 100% rewrites it.
- **Lock** a step (right-click, or `L`) to keep it while you roll everything else -- for example, keep the kick on step 1.
- **Random slice each time** (right-click, or `R`) makes a step pick a new slice every time it plays, shown as a dice on the step, so the pattern never repeats exactly.
- **Vary length** makes rolls and random steps pick a random length too, up to the length you choose.

Slicing works together with everything else: trigger conditions still decide *whether* a step plays, and the sample mode (1st / Rnd / R-R) still decides *which* slot plays -- the slice is then taken from that slot. Sample mode **Rnd** plus random slices gives the most surprising results.

**Note**: Like the rest of the sequencer, slicing is a preview inside Romper. It is not written to the SD card. To play slices on the Rample, sequence **start point** (CC x4) and **length** (CC x5) from your external sequencer, with SLICER set to the same division.

## Voice Volume and Mute

![Voice controls]({{ site.baseurl }}/images/manual/voice-controls.png){: .img-left}

Each voice has a **volume slider** on the right side of its row. Drag the slider to adjust that voice's playback volume (0--100%). Volume changes are saved to the kit.

**Note**: Voice volume only affects preview playback in Romper -- it is **not written to the SD card** during sync. If you need volume adjustments that carry over to the Rample hardware, use the per-sample [gain control]({{ site.baseurl }}/manual/kit-editor#gain-control) in the Kit Editor, which is baked into each WAV file on sync.

The **speaker icon** next to the volume slider toggles mute for that voice. When muted:

- The voice is silenced during sequencer playback
- The row fades to reduced opacity as a visual indicator
- Mute state is session-only and resets when you reopen the kit

Muting is useful for isolating voices -- mute everything except the hi-hat to focus on its pattern, or mute a voice temporarily while adjusting the others.

## Stereo Linked Channels

When two voices are configured for stereo playback (e.g., Voices 1+2 or Voices 3+4), the sequencer automatically combines them into a **single stereo row**. The primary voice's label changes to show the pairing (e.g., "1+2"), and the secondary voice's row is hidden. Steps, trigger conditions, volume, mute, and sample mode all control both channels together through the primary voice's row.

## Persistence

Sequencer patterns, trigger conditions, BPM, sample modes, and slicer settings are all saved per-kit in the database. Your patterns persist across sessions. Voice mutes are session-only.

## Example: Building a Pattern with the C0 Factory Kit

This example uses the factory default **C0** kit to demonstrate steps, trigger conditions, sample selection modes, and volume controls working together. Try recreating this pattern and pressing play to hear how it sounds.

![Step sequencer example pattern]({{ site.baseurl }}/images/manual/step-sequencer-example.png)

Here's what's programmed in each voice:

- **Voice 1 (Kick)** -- A single hit on step 1 with a **3:4** trigger condition, so it only fires on the 3rd of every 4 cycles. Sample mode is set to **Rnd** (random) to vary which kick sample plays each time.
- **Voice 2 (Hi-Hat)** -- A busy pattern with most steps active (steps 2--7 and 9--16), creating a driving hi-hat rhythm. No trigger conditions, so it plays every cycle. Sample mode is **Rnd** for subtle variation between hits.
- **Voice 3 (Snare)** -- Two hits using different trigger conditions: step 2 with **2:4** (fires on the 2nd cycle) and step 9 with **4:4** (fires only on the 4th cycle). This creates a snare pattern that evolves over 4 bars. Sample mode is **Rnd**.
- **Voice 4 (Clap)** -- A single hit on step 2 with a **1:4** condition, so it only sounds on the 1st of every 4 cycles. Sample mode is **Rnd**.

**What to listen for**: Because each voice uses different trigger conditions across a 4-cycle span, the pattern evolves over 4 bars before repeating. The kick appears only on bar 3, the snare shifts between bars 2 and 4, and the clap anchors bar 1 -- all while the hi-hat drives steadily underneath. Watch the **cycle counter** next to the BPM to follow which bar you're on.

**To recreate this pattern:**

1. Open the **C0** kit and press `S` to show the sequencer
2. Click steps to activate them in each row (refer to the screenshot above)
3. Right-click each step that needs a condition and select the appropriate **A:B** value
4. Click the **sample mode** button on each row until it shows the shuffle icon (**Rnd**)
5. Press **Play** and listen to the pattern evolve over 4 cycles

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Show/hide sequencer | `S` |
| Play / stop | `Space` |
| Toggle step | `Enter` |
| Navigate steps | Arrow keys |
| Undo / redo any sequencer edit | `Cmd+Z` / `Cmd+Shift+Z` (`Ctrl+Z` / `Ctrl+Y`) |
| Close step options, then the slicer | `Escape` |
| Previous / next slice (slice rows) | `[` / `]` |
| Shorter / longer slice (slice rows) | `{` / `}` |
| Random slice each time (slice rows) | `R` |
| Lock step (slice rows) | `L` |
| Roll slices (slice rows) | `D` |
| Undo the last roll | `Cmd+Z` / `Ctrl+Z` |
