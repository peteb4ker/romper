---
layout: manual
title: Kit Browser
prev_page:
  url: /manual/getting-started
  title: Getting Started
next_page:
  url: /manual/kit-editor
  title: Kit Editor
---

The Kit Browser is Romper's main view. It shows all your kits in a visual grid organized by bank, letting you quickly find, filter, and manage your sample library.

![Kit Browser header bar]({{ site.baseurl }}/images/manual/kit-browser-header.png)

## Navigating Banks

Kits are organized into 26 banks, labeled **A** through **Z**, matching the Rample's hardware layout. Each bank can hold up to 100 kit slots (0 through 99).

The **bank navigation bar** runs along the left side of the kit grid. Click any letter to jump to that bank, or use the **A through Z keys** on your keyboard to jump to a bank that has kits. Hover over the bar to see each bank's name.

![Bank navigation bar]({{ site.baseurl }}/images/manual/bank-nav.png){: .img-left}

Each bank that contains kits starts with a header showing its letter and artist name (e.g., "A ALWIS"). Empty banks are skipped in the grid view, and their letters are dimmed in the navigation bar. Click a dimmed letter to open that bank with an **Add Kit** card, so you can create its first kit.

### Editing Bank Names

Each bank header shows a pencil icon that lets you edit the bank's artist name inline. Click the pencil (or click the existing name) to enter edit mode, type the new name, and press **Enter** to save or **Escape** to cancel. Clearing the name removes it entirely: Romper deletes the bank's label file from your local store and forgets the name, and the next sync removes the name file from the card. A bank name becomes a file name, so it can't contain `/ \ : * ? " < > |`; Romper shows a message and keeps the old name if you type one of them.

A bank keeps its name when it has no kits: open it from its dimmed letter to name it, and hover the letter to see the name.

Bank names are stored in the database and written as RTF label files (`A - Artist Name.rtf`) to your local store. When you sync to an SD card, these RTF files are also written to the card root, as on the factory card. The [Rample manual](https://squarp.net/rample/manual/) doesn't mention these files, so whether the Rample shows the names is unverified on hardware.

## Kit Cards

Each kit appears as a card in the grid showing:

![Kit card]({{ site.baseurl }}/images/manual/kit-card.png)

- **Kit ID** -- The bank letter and slot number (e.g., `A0`, `B3`)
- **Kit alias** -- The custom name you've given the kit, if any
- **Voice sample counts** -- Four numbers showing how many samples are loaded in each voice, shown once the kit has at least one sample
  - **Empty** (red) -- No samples assigned
  - **Partial** (blue) -- Some sample slots filled
  - **Full** (bold green) -- All 12 sample slots populated
- **Voice names** -- Labels like "Kick", "Snare", "HiHat", set automatically from sample filenames or by you in the Kit Editor
- **Kit type icon** -- Drum, Loop, Vocal, FX, or Synth/Bass, inferred from the voice names (a folder icon if no voice has a name)
- **Stereo icon** -- Appears if any voices in the kit are linked as a stereo pair
- **Lock icon** -- Appears on read-only kits (see [Kit Status Indicators](#kit-status-indicators))
- **Quarantine icon** (red warning octagon) -- Appears on a quarantined kit, which won't be written to the card until it's fixed; hover over it to see why (see [Kit Status Indicators](#kit-status-indicators))
- **Amber border** -- The kit has changed since it was last written to the SD card
- **Favorite** -- Click the favorite icon to add a kit you use often to your favorites, or remove it; or press `;` on the focused kit
- **Duplicate** and **Delete** buttons -- See [Duplicating Kits](#duplicating-kits) and [Deleting Kits](#deleting-kits)

Click any kit card to open it in the [Kit Editor](kit-editor) view.

## Creating Kits

Click the **Add Kit** card at the end of a bank's kit list to create a blank kit in that bank. Romper puts it in the bank's first free slot (for example `B2` after `B0` and `B1`), and it appears in the browser ready for editing. A bank with all 100 slots in use has no **Add Kit** card.

To create the first kit in an empty bank, click the bank's dimmed letter in the navigation bar. The bank opens in the grid with an **Add Kit** card.

If your library has no kits yet (for example after choosing **Blank Folder** during setup), the browser shows bank **A** with an **Add Kit** card, which creates kit `A0`. To start in another bank, pick its letter in the navigation bar.

Add Kit cards are hidden while a search or filter is active.

### Duplicating Kits

To copy an existing kit to a different slot:

1. Click the **Duplicate kit** button (copy icon) on the kit's card
2. Type the target slot, for example `B5`. It must be a free slot from `A0` to `Z99`
3. Click **Duplicate** or press **Enter**

All samples, voice settings and the step sequence are copied to the new location. The copy is editable, isn't a favorite, and is marked as modified until you next write it to the card.

### Deleting Kits

The **Delete kit** button (trash icon) appears only on editable kits. Click it, and a popover tells you how many sample references the kit holds; click **Delete** to confirm. Your sample files on disk aren't affected. The next write to the SD card removes the kit from the card.

## Filtering and Search

The header bar provides several ways to narrow down the kit grid:

### Search

Type in the search field to filter kits. The grid updates in real time as you type (minimum 2 characters). Search is case-insensitive and matches partial text across multiple fields:

- **Kit ID** -- The bank letter and slot number (e.g., `A0`)
- **Kit alias** -- Custom short names you've assigned to kits
- **Bank artist** -- The artist field associated with a bank
- **Voice names** -- Custom or auto-detected names for each voice (e.g., "Kick", "Snare")
- **Sample filenames** -- The filenames of samples assigned to any voice in the kit
- **"Stereo"** -- Typing "stereo", or any part of it such as "ste", will match any kit that has stereo-linked voices

When a search matches on sample filenames, kit cards update to highlight the matching sample names within each voice, making it easy to spot exactly which samples matched your query.

### Favorites Filter

Click the **Favorites** toggle (favorite icon with count) to show only your favorite kits. This is useful when you have hundreds of kits but regularly work with a small set.

### Modified Filter

Click the **Modified** toggle to show only kits marked as changed since they were last written to your SD card (the cards with an amber border). Adding, removing or moving samples, changing a sample's gain, renaming a voice, and linking or unlinking a stereo pair mark a kit as modified. Renaming or clearing a bank's name marks every kit in that bank, since the name is written to the card beside them. A new or duplicated kit starts marked. Writing to the card clears the mark on every kit, except a kit with a sample the write skipped.

## Kit Status Indicators

- **Read-only** (lock icon) -- Kits imported during setup open read-only, so they can't be changed by accident. To edit one, open it in the Kit Editor and turn on the switch in the header; it reads **Editable** when on and **Locked** when off. Kits you create or duplicate start editable.
- **Modified** (amber border) -- The kit has changed since it was last written to the SD card. The Kit Editor header shows **Modified** for these kits too.
- **Quarantined** (red warning octagon) -- The kit breaks a stereo pair, or holds a WAV file Romper can't read, so it isn't written to the card and its copy on the card is left as it is. The icon's tooltip reads "Quarantined: this kit won't be written to the card until it's fixed". Open the kit to see what's wrong and how to fix it; the Kit Editor header shows **Quarantined** too. Romper finds a file it can't read when it opens the kit, scans it, or writes to the card, and the icon shows from then on. See [Stereo and Mono Handling]({{ site.baseurl }}/manual/kit-editor#stereo-and-mono-handling) and [Missing and Unreadable Files]({{ site.baseurl }}/manual/kit-editor#missing-and-unreadable-files).

  ![Kit card of a quarantined kit, with the red warning octagon beside its ID]({{ site.baseurl }}/images/manual/kit-card-quarantined.png)

## Scanning Your Library

Use **File > Scan All** (`Cmd+Shift+S` / `Ctrl+Shift+S`) to rescan your library. After you confirm, Romper reads the bank names from the RTF label files, then re-reads each kit's folder in your local store. New WAV files in a read-only kit's folder are added (up to 12 per voice), missing WAV details are filled in, and voices without a name are named from their samples. Existing samples, gain, slot order and stereo links are kept (a scan never links or unlinks voices), and editable kits never gain samples from their folders. The result also says what the next write will do about stereo: pairs it will link automatically, voices it will mix down to mono, and quarantined kits (see [Stereo and Mono Handling]({{ site.baseurl }}/manual/kit-editor#stereo-and-mono-handling)). Banks are also scanned automatically at startup.

Scan All scans every kit in your library, whatever the search or filters show, and also works with a kit open in the Kit Editor. In the Kit Browser, the header shows its progress; in the Kit Editor, a message shows the result when it finishes.

To scan a single kit, open it in the Kit Editor and click **Scan Kit** or press `/`. In an editable kit, this only names voices: each voice whose first sample's filename suggests a name (such as "Kick") gets that name, unless it already has one.

## Keyboard Navigation

You can move around the Kit Browser with the keyboard:

| Action | Shortcut |
|--------|----------|
| Jump to bank | `A` through `Z` |
| Move between kits | Arrow keys |
| Open selected kit | `Enter` |
| Add the focused kit to favorites, or remove it | `;` (semicolon) |

Every letter jumps to its bank, so `F` jumps to bank F. `;` works on the open kit in the Kit Editor too. Navigation starts from the first kit. Click an empty part of the grid first, or press a bank letter to start from that bank's first kit. **Left** and **Right** step through the kits in order. **Up** and **Down** move to the kit in the same column of the row above or below, crossing from one bank to the next.

For the complete shortcut list, see [Keyboard Shortcuts](keyboard-shortcuts).
