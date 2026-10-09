---
layout: manual
title: Keyboard Shortcuts
prev_page:
  url: /manual/syncing
  title: Syncing
---

Romper is designed for fast keyboard-driven workflow. Many actions have a shortcut, and visible focus indicators help you track where you are when navigating without a mouse. The single-key shortcuts below ignore presses with `Cmd`, `Ctrl` or `Alt` held, so menu shortcuts such as `Cmd+,` (Preferences) don't also trigger them.

A shortcut that works in both the Kit Browser and the Kit Editor, such as `;` for a favorite, is the same key in both. Letters are bank jumps in the Kit Browser, so these shortcuts use a number or a symbol instead.

## Kit Browser

| Action | Shortcut |
|--------|----------|
| Jump to bank | `A` through `Z` |
| Move between kits | Arrow keys |
| Open selected kit | `Enter` |
| Add the focused kit to favorites, or remove it | `;` (semicolon) |

When you press a bank letter, focus jumps to the first kit in that bank. Letters for banks with no kits do nothing. Every letter is a bank, so `F` jumps to bank F.

`Left` and `Right` step through the kits in order. `Up` and `Down` move to the kit in the same column of the row above or below, crossing from one bank to the next.

## Kit Details

| Action | Shortcut |
|--------|----------|
| Previous kit | `,` (comma) |
| Next kit | `.` (period) |
| Scan/rescan kit | `/` (slash) |
| Navigate sample slots | Up / Down arrows |
| Move the selected sample up or down a slot | `Option+Up` / `Option+Down` (macOS), `Alt+Up` / `Alt+Down` (Windows/Linux) |
| Move the selected sample to the previous or next voice | `Option+Left` / `Option+Right` (macOS), `Alt+Left` / `Alt+Right` (Windows/Linux) |
| Show the selected sample's file in Finder or Explorer | `Shift+F10` or the context-menu key |
| Play selected sample (sequencer hidden), unless a button or field has focus | `Space` |
| Toggle step sequencer | `S` |
| Add the open kit to favorites, or remove it | `;` (semicolon) |
| Undo / redo the last edit | `Cmd+Z` / `Cmd+Shift+Z` (macOS), `Ctrl+Z` / `Ctrl+Y` or `Ctrl+Shift+Z` (Windows/Linux) |
| Back to the Kit Browser | `Escape` |

**Edit → Undo** and **Edit → Redo** in the menu bar do the same. In a text field, such as a voice name, they undo your typing instead.

### Moving Samples

The move keys do what dragging a sample does (see [Moving Samples](kit-editor#moving-samples)), so they work in editable kits only, mark the kit modified, and `Cmd+Z` / `Ctrl+Z` undoes them. The sample stays selected, and keeps focus if it had it, so you can press the key again to keep moving it.

- `Up` and `Down` swap the sample with the one above or below it. The first sample doesn't move up, and the last doesn't move down.
- `Left` and `Right` move it to the same slot of the voice on that side, or after that voice's last sample if it has fewer. The right-hand voice of a stereo pair is skipped, since nothing can be added to it. Voice 1 doesn't move left, and voice 4 doesn't move right.
- A sample can't move into a full voice; a message says so, as it does for a drag.

`Shift+F10` and the context-menu key do what right-clicking the selected sample does.

### Kit Navigation

The comma and period keys let you step through kits sequentially without returning to the Kit Browser. This is particularly useful for comparing similar kits or reviewing a series of edits.

In a read-only kit, the slash key rescans the kit, the same as **Scan Kit**. In an editable kit, it only names voices: each voice whose first sample's filename suggests a name (such as "Kick") gets that name, unless it already has one.

## Step Sequencer

| Action | Shortcut |
|--------|----------|
| Show / hide sequencer | `S` |
| Play / stop | `Space` |
| Toggle current step | `Enter` |
| Step options: trigger condition and slice | `C` (or the context-menu key, or `Shift+F10`) |
| Navigate between steps | Arrow keys |
| Undo / redo a step, condition or slice edit | `Cmd+Z` / `Cmd+Shift+Z` (macOS), `Ctrl+Z` / `Ctrl+Y` (Windows/Linux) |
| Close the step options, then the slicer, then the kit | `Escape` |
| Show all sequencer shortcuts | `?` |

While the sequencer is showing, `Space` plays and stops it, as in a DAW, unless a button or field has focus. When the grid is focused, the arrow keys move between steps in the 4x16 grid and `Enter` toggles the step under the cursor.

Step, condition, slice and roll edits go into the kit's undo history alongside sample edits, and you can undo them in locked kits too. Other sequencer settings, such as BPM, level and sample mode, can't be undone. Quick repeated edits to one step, such as scrolling through slices, undo in one go.

### Slicer

These work on a step in a row with slice mode (✂) turned on. Everything they do can also be done with the mouse.

| Action | Shortcut |
|--------|----------|
| Previous / next slice | `[` / `]` |
| Shorter / longer | `{` / `}` (Shift + `[` / `]`) |
| Random slice each time on / off | `R` |
| Lock on / off (rolls skip it) | `L` |
| Roll the row | `D` |
| Undo the last roll (or a step, condition or slice edit) | `Cmd+Z` / `Ctrl+Z` |
| Change slice / length with the mouse | Scroll wheel / Shift + scroll wheel over the step |
| Play a span without assigning it | `Option` (macOS) / `Alt` (Windows/Linux) + click or drag on the waveform |

## Menu Shortcuts

| Action | Shortcut |
|--------|----------|
| Scan All (banks + kits) | `Cmd+Shift+S` (macOS) / `Ctrl+Shift+S` (Windows/Linux) |
| Preferences | `Cmd+,` (macOS) / `Ctrl+,` (Windows/Linux) |
| Undo / Redo (Edit menu) | `Cmd+Z` / `Cmd+Shift+Z` (macOS), `Ctrl+Z` / `Ctrl+Shift+Z` (Windows/Linux) |

## General Tips

- **Focus indicators** are visible throughout the app, so you always know which element is selected
- **Bank hotkeys** work from anywhere in the Kit Browser -- you don't need to focus the bank nav bar first
- Most keyboard navigation follows standard conventions: `Tab` to move between UI regions, `Enter` to activate, `Escape` to dismiss dialogs
- While a dialog is open, the Kit Browser and Kit Editor shortcuts wait until it closes, and `Tab` and `Shift+Tab` stay inside it. Dialogs that need an answer, such as the setup wizard or an invalid local store, don't close on `Escape`
- A sample's **gain knob** takes the arrow keys, `Page Up` / `Page Down`, `Home` / `End` and `0` (see [Gain Control](kit-editor#gain-control))
