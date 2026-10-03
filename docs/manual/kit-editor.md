---
layout: manual
title: Kit Editor
prev_page:
  url: /manual/kit-browser
  title: Kit Browser
next_page:
  url: /manual/step-sequencer
  title: Step Sequencer
---

The Kit Editor view is where you build and audition your kits. It shows all four voices with their sample slots, playback controls, and the step sequencer.

## Opening a Kit

Click any kit card in the Kit Browser to open it. The header shows:

![Kit Details header]({{ site.baseurl }}/images/manual/kit-editor-header.png)

- **Back button** -- Returns to the Kit Browser (or press `Escape`)
- **Kit navigation** -- Previous/Next arrows to step through kits sequentially (or use `,` and `.` keys)
- **Kit ID and name** -- The bank/slot and editable name field
- **Favorite bookmark** -- Toggle bookmark
- **Modified** -- Shown when the kit has changed since it was last written to the SD card: samples added, moved or deleted, a gain or voice name changed, or a stereo link changed
- **Locked / Editable switch** -- Turns editing on and off (see below)
- **Scan Kit button** -- Re-analyze samples and refresh voice name detection

### Locked and Editable Kits

Kits imported from an SD card or the factory samples open **Locked**: you can play and sequence them, but not change their samples. Click the switch to make the kit **Editable**. That shows the controls for adding, moving and deleting samples, the gain knobs, and the pencil for renaming voices. Kits you create or duplicate are editable from the start.

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

### Sample Slots

Each voice has up to **12 sample slots**, matching the Rample's 12-layer-per-voice capability. A column on the left numbers the slots 1 to 12. Filled slots show:

- **Play button** -- Click to audition the sample
- **Sample filename** -- Hover over the row to see the file's path and format
- **Gain knob** -- Per-sample volume trim (see [Gain Control](#gain-control) below); editable kits only
- **Delete button** -- Remove the sample from this slot; the samples below it move up. Romper asks first unless **Confirm destructive actions** is off in Preferences. Editable kits only
- **Waveform display** -- Visual representation of the audio

Right-click a sample to show its file in Finder or Explorer.

## Assigning Samples

### Drag and Drop

The primary way to add samples is drag and drop, in an editable kit:

1. Open a file browser window alongside Romper
2. Drag one or more `.wav` files from your filesystem onto a voice panel: onto its **Drop WAV files here** slot or onto any of its samples
3. Romper checks each file and adds it to the voice's next free slot

**Rules and limits:**

- Only `.wav` files that Romper can read are added. Other files are skipped, and a message names them.
- WAV files that aren't 44.1 kHz, 8- or 16-bit PCM are accepted; they're converted when you write to the card.
- A maximum of 12 samples per voice. If you drop more files than the voice has free slots, the rest are skipped, and a message names them. A full voice turns red and shows "Voice is full (12 samples maximum)" when you drag over it.
- A file that's already in the same voice is skipped, and a message says so. The same file can be used in other voices.
- When a drop skips several files, one message lists them all with the reason for each, for example "kick.wav wasn't added: voice 2 is full (12 samples). Delete one to make room."
- New samples always go after the voice's last sample, wherever you drop them.
- Romper stores a reference to each file, not a copy, so keep your sample folders where they are.

### Moving Samples

In an editable kit, drag a sample onto another slot, in the same voice or another one, to move it there. The samples from that slot on shift down to make room, and the gap it leaves closes up.

### Stereo and Mono Handling

Stereo is set per voice, as on the Rample. Click the link icon between two neighbouring voices to link them as a stereo pair; the left voice shows a **Stereo** badge, and its samples play in stereo across both voices' outputs. Nothing can be added to the right-hand voice while the pair is linked. Click the **Stereo** badge to unlink the pair: the voice keeps its samples, and any stereo files on it are mixed down to mono at the next write. Linking and unlinking change what the next write puts on the card, so, like other edits, they need the kit to be editable; on a read-only kit the badge shows the pair but doesn't unlink it.

When you write to the card:

- A stereo file on a linked voice is written as it is.
- A stereo file on a voice that isn't linked is mixed down to mono (the average of its two channels), because a mono voice plays one channel. The write summary marks the bank as needing conversion.
- Mono files are written as they are on either kind of voice.

To link a pair, the right-hand voice must be empty. Romper doesn't link a pair whose right-hand voice holds samples, and says so; delete or move them first.

### Voice Names and Kit Type

Romper automatically analyzes sample filenames to suggest voice names. For example, if Voice 1 contains files named `KICK_LOW_01.wav`, `KICK_LOW_02.wav`, etc., Romper labels that voice "Kick".

In an editable kit, you can also name a voice yourself: click the pencil next to its name, type the name, and press `Enter` or click the tick.

The **kit type** (Drum, Loop, Vocal, FX, Synth/Bass) is inferred from the combination of voice names. A kit with voices named Kick, Snare, HiHat, and Clap would be classified as a Drum kit.

Click the **Scan Kit** button (or press `/`) to re-run the analysis at any time. What it does depends on the kit:

- In a locked kit, it rescans the kit's folder in your local store: it adds WAV files that aren't in the kit yet, reads their format, and names voices that don't have a name. Names you set stay.
- In an editable kit, it names each voice that has samples but no name, from its first sample's filename. Names you set stay.

## Gain Control

In an editable kit, each sample slot has a small **gain knob** that lets you trim the volume of individual samples from **-24 dB to +12 dB**. This is useful for balancing samples within a voice -- for example, if one kick hit is louder than the others.

### Using the Gain Knob

- **Drag up/down** to adjust the gain
- **Scroll** the mouse wheel over the knob to nudge the value up or down by 1 dB; hold Shift for finer 0.5 dB steps
- **Click** the knob to reset it to **0 dB** (unity gain)
- Hover over the knob to see the current dB value

The knob scales up on hover so you can see the arc position clearly, even though it's compact in the sample row.

Gain changes can't be undone with **Undo**; click the knob to go back to 0 dB.

### Gain vs. Voice Volume

Per-sample gain and the [voice volume slider]({{ site.baseurl }}/manual/step-sequencer#voice-volume-and-mute) in the step sequencer serve different purposes:

- **Per-sample gain** adjusts the relative loudness of individual samples within a voice. It is **baked into the WAV file** when you [write to the SD card]({{ site.baseurl }}/manual/syncing), so the Rample hardware plays the sample at the adjusted level
- **Voice volume** controls the overall playback level of an entire voice during sequencer preview. It is **not saved to the SD card** -- it only affects preview playback in Romper

When both are active during preview, Romper combines them: the sample plays at its gain-adjusted level, then the voice volume scales the output. On hardware, only the baked-in gain applies -- voice volume has no effect on the Rample.

## Previewing Samples

### Single Sample Playback

Click the **play icon** on any sample row to hear it. While it plays, the icon becomes a stop button; click it to stop. You can also click a sample row to select it, move the selection with the up and down arrow keys, and press `Space` to play it (while the sequencer is hidden).

**Voice choke**: Each voice is monophonic -- when you trigger a new sample on a voice, any previously playing sample on that voice stops automatically. This mirrors how the Rample hardware behaves.

### Step Sequencer

The step sequencer lets you audition all four voices together in a rhythmic pattern. Program a looping 16-step sequence to hear how your kit's samples work together before syncing to the Rample. Toggle it with the **Show/Hide Sequencer** button at the bottom of the kit view, or press `S`.

See the full [Step Sequencer]({{ site.baseurl }}/manual/step-sequencer) guide for details on the grid, transport controls, trigger conditions, sample selection modes, voice volume/mute, and a walkthrough example.

## Navigating Between Kits

You don't need to return to the Kit Browser to switch kits. Use:

- **Previous kit**: `,` (comma) key or the left arrow in the header
- **Next kit**: `.` (period) key or the right arrow in the header

Kits come in slot order (A0, A1, ... B0), whatever search or filter you set in the Kit Browser. This lets you quickly compare kits one after another.

## Undo and Redo

Press `Cmd+Z` (`Ctrl+Z`) to undo and `Cmd+Shift+Z` (`Ctrl+Y`) to redo, or use **Edit > Undo** and **Edit > Redo**. Undo covers:

- Adding, deleting and moving samples (in an editable kit)
- Step, trigger condition and slice edits in the [step sequencer]({{ site.baseurl }}/manual/step-sequencer)

Gain, kit and voice names, the Locked/Editable switch and stereo links aren't undoable. The history belongs to the open kit: it's cleared when you open another kit or go back to the Kit Browser. While you're typing in a text field, `Cmd+Z` undoes your typing instead.
