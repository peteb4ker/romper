---
layout: manual
title: Keyboard Shortcuts
prev_page:
  url: /manual/syncing
  title: Syncing
---

Romper is designed for fast keyboard-driven workflow. Many actions have a shortcut, and visible focus indicators help you track where you are when navigating without a mouse.

## Kit Browser

| Action | Shortcut |
|--------|----------|
| Jump to bank | `A` through `Z` |
| Move between kits | Arrow keys |
| Open selected kit | `Enter` |
| Bookmark the focused kit | `F` |

When you press a bank letter, focus jumps to the first kit in that bank. Letters for banks with no kits do nothing.

The arrow keys don't move on from the first kit in the list, and `Up` and `Down` can land on the wrong kit where one bank ends and the next begins. `F` also jumps to bank F if it has kits.

## Kit Details

| Action | Shortcut |
|--------|----------|
| Previous kit | `,` (comma) |
| Next kit | `.` (period) |
| Scan/rescan kit | `/` (slash) |
| Navigate sample slots | Up / Down arrows |
| Play selected sample (sequencer hidden) | `Space` |
| Toggle step sequencer | `S` |
| Undo / redo the last edit | `Cmd+Z` / `Cmd+Shift+Z` (macOS), `Ctrl+Z` / `Ctrl+Y` or `Ctrl+Shift+Z` (Windows/Linux) |
| Back to the Kit Browser | `Escape` |

**Edit → Undo** and **Edit → Redo** in the menu bar do the same. In a text field, such as a voice name, they undo your typing instead.

### Kit Navigation

The comma and period keys let you step through kits sequentially without returning to the Kit Browser. This is particularly useful for comparing similar kits or reviewing a series of edits.

In a read-only kit, the slash key rescans the kit, the same as **Scan Kit**. In an editable kit, it only names voices: each voice whose first sample's filename suggests a name (such as "Kick") gets that name, replacing any name already set.

## Step Sequencer

| Action | Shortcut |
|--------|----------|
| Show / hide sequencer | `S` |
| Play / stop | `Space` |
| Toggle current step | `Enter` |
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
