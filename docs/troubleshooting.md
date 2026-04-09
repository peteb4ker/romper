---
layout: default
title: Troubleshooting
description: Solutions for common issues with Romper, the sample kit manager for Squarp Rample
---

<section class="page-content">
<div class="container">
<div class="prose">

# Troubleshooting

Solutions for common issues you may encounter when using Romper.

---

## SD card not detected

If Romper cannot see your SD card when syncing:

**macOS**
- Insert the SD card and check that it appears in Finder under Locations.
- Open **Disk Utility** and verify the card is mounted.
- If the card does not mount, try a different card reader or USB port.

**Windows**
- Insert the SD card and check that it appears as a drive letter in File Explorer.
- If it does not appear, open **Disk Management** (right-click Start > Disk Management) and check if the card is listed but unassigned.
- Try a different card reader or USB port.

**Linux**
- Check if the card is recognized with `lsblk` in a terminal.
- If listed but not mounted, mount it manually: `sudo mount /dev/sdX1 /mnt/sdcard` (replace `sdX1` with your device).
- Some desktop environments auto-mount removable media -- check your file manager.

**General tips**
- The SD card must be formatted as FAT32 (the standard format for the Rample).
- Try ejecting and reinserting the card.
- Test with a different SD card to rule out hardware issues.

---

## No kit folders found

When Romper imports from an SD card but finds no kits, the folder structure may not match what the Rample expects.

The Rample uses this naming convention:
- Bank folders are single letters: `A`, `B`, `C`, ... `Z`
- Kit folders within a bank are numbered: `A/0`, `A/1`, ... `A/99`
- Voice sample files within a kit follow specific naming patterns

If your SD card has a different structure (e.g., folders named `Bank_A` or `Kit_01`), Romper will not recognize them. Check the [Rample manual](https://squarp.net/rample/manual/) for the exact folder structure specification.

**Quick fix**: Start fresh by choosing "Factory Samples" or "Empty Library" in the Romper setup wizard, then rebuild your kits from within Romper.

---

## Factory download fails

Downloading the Rample factory samples requires an internet connection. If the download fails:

- **Check your connection** -- Ensure you have a stable internet connection. The factory sample set is approximately 1 GB.
- **Firewall or proxy** -- If you are behind a corporate firewall or proxy, the download may be blocked. Try from a different network.
- **Retry** -- Romper will offer to retry the download. Partial downloads are resumed automatically where possible.
- **Skip for now** -- You can skip the factory download during setup and start with an empty library. You can always import factory samples later.

---

## Not enough disk space

Romper needs space for its local store and for syncing to the SD card.

- **Local store**: Requires a few MB for the database, plus space for any cached data.
- **SD card sync**: The SD card needs enough free space for all the WAV files in your configured kits. Check the card's capacity -- standard Rample SD cards are typically 4 GB or larger.
- **Factory samples**: If downloading factory samples, ensure you have approximately 1 GB of free disk space on the drive where your local store is located.

**To free up space on the SD card**: Remove unused kits from banks you are not using. Romper's kit browser makes it easy to see which slots are occupied.

---

## Audio not playing

If samples do not produce sound when you click play or use the step sequencer:

- **Check system volume** -- Ensure your system volume is not muted and is turned up.
- **Check audio output device** -- In your operating system's sound settings, verify the correct output device is selected.
- **Try a different sample** -- The file may be corrupted or in an unsupported format. Romper supports WAV files.
- **Restart Romper** -- If audio worked previously but stopped, restarting the application can resolve transient audio system issues.
- **Check file paths** -- If you moved or deleted the original sample file after assigning it to a kit, Romper cannot play it. Reassign the sample from its new location.

---

## Local store became invalid

If Romper reports that your local store is invalid or corrupted:

- **Re-run the setup wizard** -- Romper will prompt you to set up a new local store. You can point it to the same directory, and Romper will attempt to recover existing data.
- **Choose a new directory** -- If recovery fails, choose a fresh directory for your local store and reimport your kits from your SD card.
- **Check disk health** -- Corrupted stores can indicate disk issues. Run your operating system's disk checking utility.
- **Backup consideration** -- The local store is a working copy. Your definitive data lives on your SD card and in your original sample files. Losing the local store means rebuilding your kit configurations, but no samples are lost.

</div>
</div>
</section>
