<!-- 
layout: default
-->

# Kit Details

Each kit contains four voices, and each voice can hold up to 12 sample slots. This page describes assigning samples, previewing them, and using the built‑in step sequencer.

## Assigning Samples

1. Drag `.wav` files from your operating system into a voice or specific slot.
2. Invalid files are ignored and a warning appears in the message area.
3. If more than 12 files are dropped on a voice, only the first 12 are added.
4. Duplicate samples are prevented within a voice. Duplicates across voices trigger a warning but are allowed.
5. The UI highlights drop targets while dragging.

### Stereo and Mono

- **Global Setting**: The settings page has a **Treat Stereo as Mono** toggle (on by default).
- **Per-Sample Override**: Each sample row lets you override the global setting.
- When a stereo sample is set to mono, it occupies the next slot of the current voice and the matching slot in the next voice. If space is unavailable, a warning is shown.

### Voice Names and Kit Type

- You may name each voice manually.
- When unnamed, Romper scans the sample names to infer a voice (kick, snare, clap, etc.).
- Kit type (Drum, Loop, Vocal, FX, Synth/Bass) is inferred from the set of voices.

## Previewing Samples and Kits

- Click the play icon on a sample to preview it.
- Use the **Play Kit** button to audition the first sample of each voice using the step sequencer pattern.

### Keyboard Navigation

- **`,` (comma)**: Navigate to previous kit
- **`.` (period)**: Navigate to next kit
- **`/` (slash)**: Scan/rescan current kit (analyzes samples and infers voice names)
- **Up/Down arrows**: Navigate between sample slots
- **Space/Enter**: Play selected sample
- **`S`**: Toggle step sequencer visibility

### Step Sequencer

A four‑row, 16‑step grid appears below the kit details:

- Click steps or use keyboard navigation to toggle them.
- The grid plays back at a fixed tempo when you press **Play**.
- Patterns are saved to the database per kit.

**Step Sequencer Controls:**

- **Arrow keys**: Navigate between steps
- **Space**: Toggle current step on/off
- **`S`**: Show/hide sequencer

## Locking Kits

- Toggle the lock icon to prevent accidental edits or overwriting during sync.

When finished, visit the [Syncing](./syncing.md) page to copy kits to your SD card.
