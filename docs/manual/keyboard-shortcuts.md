---
layout: manual
title: Keyboard Shortcuts
prev_page:
  url: /manual/syncing
  title: Syncing
---

Romper is designed for fast keyboard-driven workflow. Every major action has a shortcut, and visible focus indicators help you track where you are when navigating without a mouse.

## Kit Browser

| Action | Shortcut |
|--------|----------|
| Jump to bank | `A` through `Z` |
| Move between kits | Arrow keys |
| Open selected kit | `Enter` |

When you press a bank letter, focus jumps to the first kit in that bank.

## Kit Details

| Action | Shortcut |
|--------|----------|
| Previous kit | `,` (comma) |
| Next kit | `.` (period) |
| Scan/rescan kit | `/` (slash) |
| Navigate sample slots | Up / Down arrows |
| Play selected sample | `Space` or `Enter` |
| Toggle step sequencer | `S` |

### Kit Navigation

The comma and period keys let you step through kits sequentially without returning to the Kit Browser. This is particularly useful for comparing similar kits or reviewing a series of edits.

The slash key triggers a rescan of the current kit, re-analyzing sample filenames to refresh voice names and kit type detection.

## Step Sequencer

| Action | Shortcut |
|--------|----------|
| Show / hide sequencer | `S` |
| Toggle current step | `Space` or `Enter` |
| Navigate between steps | Arrow keys |

When the sequencer is focused, the arrow keys move between steps in the 4x16 grid. Space toggles the step under the cursor on or off.

### Slicer

These work on a step in a row with slice mode (✂) turned on. Everything they do can also be done with the mouse.

| Action | Shortcut |
|--------|----------|
| Previous / next slice | `[` / `]` |
| Shorter / longer | `{` / `}` (Shift + `[` / `]`) |
| Random slice each time on / off | `R` |
| Lock on / off (rolls skip it) | `L` |
| Roll the row | `D` |
| Undo the last roll | `Cmd+Z` / `Ctrl+Z` |
| Change slice / length with the mouse | Scroll wheel / Shift + scroll wheel over the step |

## Menu Shortcuts

| Action | Shortcut |
|--------|----------|
| Scan All (banks + kits) | `Cmd+Shift+S` (macOS) / `Ctrl+Shift+S` (Windows/Linux) |

## General Tips

- **Focus indicators** are visible throughout the app, so you always know which element is selected
- **Bank hotkeys** work from anywhere in the Kit Browser -- you don't need to focus the bank nav bar first
- Most keyboard navigation follows standard conventions: `Tab` to move between UI regions, `Enter` to activate, `Escape` to dismiss dialogs
