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
- **Favorite** -- Click the favorite icon to add the kit to your favorites or remove it (or press `;`, the same key as in the Kit Browser)
- **Modified** -- Shown when the kit has changed since it was last written to the SD card: samples added, moved or deleted, a gain or voice name changed, or a stereo link changed
- **Quarantined** -- A red warning octagon and **Quarantined**, shown when the kit won't be written to the card until it's fixed. The notice above the voices says what's wrong and how to fix it (see [Stereo and Mono Handling](#stereo-and-mono-handling) and [Missing and Unreadable Files](#missing-and-unreadable-files))
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
- **File not found** or **Can't be read** -- Shown under the filename when the sample's file is missing or isn't a WAV Romper can read (see [Missing and Unreadable Files](#missing-and-unreadable-files))

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
- Stereo samples: if you drop a stereo sample on a mono voice that Romper would link automatically, it asks first, for example "kick.wav is stereo. Link voices 1 and 2 as a stereo pair?" Click **Link** to link the pair, or **Keep mono** to keep the voice mono; Romper remembers. A mono sample dropped on a stereo pair is added with a warning, and the kit is quarantined until you fix it. See [Stereo and Mono Handling](#stereo-and-mono-handling).
- New samples always go after the voice's last sample, wherever you drop them.
- Romper stores a reference to each file, not a copy, so keep your sample folders where they are.

### Moving Samples

In an editable kit, drag a sample onto another slot, in the same voice or another one, to move it there. The samples from that slot on shift down to make room, and the gap it leaves closes up.

### Stereo and Mono Handling

The [Rample manual](https://squarp.net/rample/manual/) says "A stereo sample will fill 2 mono voices" and "All layers must be of the same type (mono OR stereo) in a voice". In Romper, stereo is set per voice: a **stereo pair** is two neighbouring voices linked together, voices 1 and 2, 2 and 3, or 3 and 4, and the left voice's samples play in stereo across both voices' outputs. A voice that isn't linked is a **mono voice**; voice 4 always is. A stereo sample is a 2-channel WAV and a mono sample a 1-channel one.

Click the link icon between two neighbouring voices to link them; the left voice shows a **Stereo** badge. Nothing can be added to the right-hand voice while the pair is linked. Romper doesn't link voice 4, a voice that's already in a pair, or a voice whose next voice has samples or is in a pair, and says why, for example "Voices 2 and 3 can't be linked: voice 3 has samples." Click the **Stereo** badge to unlink the pair: the voice keeps its samples, and Romper says what changes, for example "Voices 1 and 2 are unlinked. Voice 1's stereo samples will be written to the card as mono." Linking and unlinking change what the next write puts on the card, so, like other edits, they need the kit to be editable; on a read-only kit the badge shows the pair but doesn't unlink it.

How Romper handles stereo:

1. **A mono voice is always fine.** It can hold any mix of stereo and mono samples. When you write to the card, its stereo samples are mixed down to mono, and the voice shows a note while that's so: **Mixed down to mono instead of playing across 2 voices**. The write summary lists it too.
2. **Linking automatically.** When you set up from an SD card, and when you write to the card, Romper links a voice with the next one if every sample on it is stereo, the next voice is empty and not in a pair, and you haven't chosen mono for that voice. The pair shows **Linked automatically**, and the setup or write summary says so. You choose mono for a voice by clicking **Keep mono** when you drop a sample, or by unlinking it; Romper remembers.
3. **Your links stay.** Romper never unlinks a pair. If the next voice is already in a pair, even an empty one, the voice stays mono and its note says why, for example "Voice 1 can't pair with voice 2 because voices 2 and 3 are linked. Unlink them to pair voices 1 and 2."
4. **A stereo pair must be clean, or the kit is quarantined.** A kit is **Quarantined** when a stereo pair holds a mono sample, when the right-hand voice of a pair has samples, or when one of its WAV files can't be read. A quarantined kit isn't written to the card, and its copy already on the card is left exactly as it is: not overwritten and not removed. The kit editor shows the **Quarantined** notice with what's wrong and how to fix it, and the write summary lists it. When you fix it, for example by unlinking the pair or replacing the sample, the next write writes the kit. A WAV that can't be read is found when Romper reads it: when you open the kit, scan it, or write it (see [Missing and Unreadable Files](#missing-and-unreadable-files)).
5. **Scanning changes nothing.** A scan reports what the next write will do: pairs it will link automatically, voices it will mix down to mono, and quarantined kits.
6. **Dropping samples.** If you drop a stereo sample on a mono voice that Romper would link automatically, it asks: "kick.wav is stereo. Link voices 1 and 2 as a stereo pair?" Click **Link**, or **Keep mono** to keep the voice mono. If you drop a mono sample on a stereo pair, it's added with a warning, "kick.wav is a mono sample, but voices 1 and 2 are a stereo pair and expect stereo samples.", the sample is labelled **Mono sample in a stereo pair**, and the kit is quarantined until you fix it.

Each message appears once, when it happens; the notes and labels stay while the state lasts.

The Rample manual doesn't say what the module does with a stereo sample on voice 4, with one on a voice whose next voice has samples, or with a voice that mixes mono and stereo samples, so all of this is Romper's design, unverified on hardware.

When you write to the card:

- A stereo sample on a stereo pair is written as it is.
- A stereo sample on a mono voice is mixed down to mono (the average of its two channels), because a mono voice plays one channel. The write summary lists the voice and marks the bank as needing conversion.
- A mono sample on a mono voice is written as it is. On a stereo pair it quarantines the kit, which isn't written until it's fixed.

### Missing and Unreadable Files

Romper checks a kit's sample files when you open it, so problems show before you write to the card. It reads the files it hasn't read yet, and the ones it last found missing or unreadable, so a file you've put back or replaced is seen too.

- **File not found** -- The sample's file has been moved or deleted. The slot is labelled **File not found**, and a notice above the voices says which file and how to fix it, for example "kick.wav on voice 1 wasn't found: it was moved or deleted. Put it back, or replace or remove the sample. Until then it's skipped when you write to the card." A missing file doesn't quarantine the kit: the rest of the kit is written, and the write summary lists the skipped sample.
- **Can't be read** -- The file is there, but it isn't a WAV Romper can read (it may be damaged, or in an unusual format). The slot is labelled **Can't be read**, the kit is **Quarantined**, and the quarantine notice says how to fix it, for example "Romper can't read kick.wav. Replace it with a WAV Romper can read, or remove it." The kit isn't written until you do.

A file that was readable when Romper last read it isn't read again when you open the kit, so a file deleted since then shows as missing after the next **Scan Kit**; a write finds it too, and skips it.

### Voice Names and Kit Type

Romper automatically analyzes sample filenames to suggest voice names. For example, if Voice 1 contains files named `KICK_LOW_01.wav`, `KICK_LOW_02.wav`, etc., Romper labels that voice "Kick".

In an editable kit, you can also name a voice yourself: click the pencil next to its name, type the name, and press `Enter` or click the tick. If the name can't be saved, the voice keeps its old name and a message says so.

The **kit type** (Drum, Loop, Vocal, FX, Synth/Bass) is inferred from the combination of voice names. A kit with voices named Kick, Snare, HiHat, and Clap would be classified as a Drum kit.

Click the **Scan Kit** button (or press `/`) to re-run the analysis at any time. What it does depends on the kit:

- In a locked kit, it rescans the kit's folder in your local store: it adds WAV files that aren't in the kit yet, reads their format, and names voices that don't have a name. Names you set stay. It never changes a stereo link; it lists what the next write will do about stereo: pairs it will link automatically, voices it will mix down to mono, and whether the kit is quarantined.
- In an editable kit, it names each voice that has samples but no name, from its first sample's filename. Names you set stay.

## Gain Control

In an editable kit, each sample slot has a small **gain knob** that lets you trim the volume of individual samples from **-24 dB to +12 dB**. This is useful for balancing samples within a voice -- for example, if one kick hit is louder than the others.

### Using the Gain Knob

- **Drag up/down** to adjust the gain
- **Scroll** the mouse wheel over the knob to nudge the value up or down by 1 dB; hold Shift for finer 0.5 dB steps
- **Click** the knob to reset it to **0 dB** (unity gain)
- Hover over the knob to see the current dB value
- With the keyboard, `Tab` to the knob, then use the arrow keys to change it by 1 dB (Shift: 0.5 dB), `Page Up` / `Page Down` by 6 dB, `Home` / `End` for -24 dB / +12 dB, and `0` for 0 dB

The knob scales up on hover so you can see the arc position clearly, even though it's compact in the sample row.

Gain changes can't be undone with **Undo**; click the knob to go back to 0 dB.

If a gain change can't be saved, the knob goes back to the saved gain and a message says so; try again.

### Gain vs. Voice Volume

Per-sample gain and the [voice volume slider]({{ site.baseurl }}/manual/step-sequencer#voice-volume-and-mute) in the step sequencer serve different purposes:

- **Per-sample gain** adjusts the relative loudness of individual samples within a voice. It is **baked into the WAV file** when you [write to the SD card]({{ site.baseurl }}/manual/syncing), so the Rample hardware plays the sample at the adjusted level
- **Voice volume** controls the overall playback level of an entire voice during sequencer preview. It is **not saved to the SD card** -- it only affects preview playback in Romper

When both are active during preview, Romper combines them: the sample plays at its gain-adjusted level, then the voice volume scales the output. On hardware, only the baked-in gain applies -- voice volume has no effect on the Rample.

## Previewing Samples

### Single Sample Playback

Click the **play icon** on any sample row to hear it. While it plays, the icon becomes a stop button; click it to stop. You can also click a sample row to select it, move the selection with the up and down arrow keys, and press `Space` to play it (while the sequencer is hidden).

**Voice choke**: Each voice is monophonic -- when you trigger a new sample on a voice, any previously playing sample on that voice stops automatically. This is meant to mirror the Rample, but the [Rample manual](https://squarp.net/rample/manual/) doesn't describe it, so it's unverified on hardware.

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
