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
- Kit folders sit at the root of the card, named with a bank letter and a number from 0 to 99: `A0`, `A1`, ... `Z99`
- The WAV files sit directly in the kit folder, and each file name starts with its voice number (1 to 4), for example `1 KICK.wav`

Romper imports only folders named like this and ignores everything else on the card. If your SD card has a different structure (e.g., folders named `Bank_A` or `Kit_01`), Romper will not recognize them. Check the [Rample manual](https://squarp.net/rample/manual/) for the exact folder structure specification.

**Quick fix**: Start fresh by choosing **Squarp.net Factory Samples** or **Blank Folder** in the Romper setup wizard, then rebuild your kits from within Romper.

---

## Factory download fails

Downloading the Rample factory samples requires an internet connection. If the download fails:

- **Check your connection** -- Ensure you have a stable internet connection. The factory sample archive is about 313 MiB.
- **Firewall or proxy** -- If you are behind a corporate firewall or proxy, the download may be blocked. Try from a different network.
- **Retry** -- When the connection drops or stalls, Romper makes up to 3 attempts, each downloading the whole archive again. If all of them fail, click **Initialize Local Store** to try again. Other failures, such as a full disk or a damaged archive, aren't retried: Romper shows the reason straight away.
- **"Didn't match the expected checksum"** -- Romper checks that the download is the exact archive it expects. A mismatch means the download was damaged on the way, or Squarp changed the file on its server. Try again once; if it fails the same way, update Romper, or set up from an SD card instead.
- **Use another source** -- You can set up from an SD card or a blank folder instead. Romper can only download the factory samples during first-time setup, so you can't add them to a library later.

---

## Not enough disk space

Romper needs space for its local store and for syncing to the SD card.

- **Local store**: The database takes a few MB. Kits imported during setup, from an SD card or the factory archive, are copied into the local store, so it also needs room for their WAV files.
- **SD card sync**: The SD card needs enough free space for all the WAV files in your configured kits. Check the card's capacity -- standard Rample SD cards are typically 4 GB or larger.
- **Factory samples**: Setup checks for at least 1 GB of free disk space on the drive where your local store will be, and 500 MB for an SD card import.

**To free up space on the SD card**: Delete kits you don't use in Romper's kit browser (a kit must be editable to delete it). The next write removes them from the card.

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

If Romper can't open your local store (for example, you moved or deleted the folder or the database inside it, or it's on a drive that isn't connected), it shows the **Invalid Local Store** dialog, at launch or while it's running. Romper keeps the store's location, so nothing is lost. An edit made after the database went missing isn't saved; make it again once the store is back:

- **Try Again** -- If the store is on a drive that isn't connected, connect it (or put the folder back where it was) and click **Try Again**. Romper opens the store as usual.
- **Choose another directory** -- Click **Choose Another Local Store Directory**, pick a folder that holds a local store, and click **Use This Directory**.
- **Set up a new store** -- Click **Set Up a New Local Store** to forget the old location and open the setup wizard, for example to reimport your kits from your SD card if the store is lost. The setup steps won't use a folder that already holds a local store; use **Choose Existing Store** for that.
- **Exit App** -- Quit without changing anything.
- **Check disk health** -- Corrupted stores can indicate disk issues. Run your operating system's disk checking utility.
- **Backup consideration** -- The local store is the master copy of your library; the SD card is a copy Romper writes from it. Include the local store folder in your own backups. Without it, importing your SD card brings the kits and audio back, but not Romper's own data: kit and voice names, sequencer patterns, and where each sample came from.

---

## "Something Romper was doing in the background didn't finish"

This message means something Romper started without waiting for it failed, for example a save or a file check. Romper shows the message once for a burst of these failures, not once for each.

- **Check your last change** -- Look at what you just did, such as a sample, a setting or a name. If it didn't take effect, do it again.
- **If it keeps happening** -- Restart Romper. If the message still comes back, open the Developer Tools (below) and look in the **Console** tab for `A background task failed`. Include that line in a bug report.

---

## Inspecting Romper with Developer Tools

If something is misbehaving and you want to capture diagnostic output for a bug report -- or you simply want to inspect the running app -- you can enable the Chromium Developer Tools in an installed build by launching Romper with the `ROMPER_ENABLE_DEVTOOLS` environment variable set to `1`. By default this is off, so installed releases do not expose **Reload** / **Force Reload** / **Toggle Developer Tools** in the View menu.

**macOS** (terminal):

Quit Romper first, then run:

```sh
ROMPER_ENABLE_DEVTOOLS=1 /Applications/Romper.app/Contents/MacOS/romper
```

**Linux** (terminal):

```sh
ROMPER_ENABLE_DEVTOOLS=1 romper
```

**Windows** (PowerShell):

```powershell
$env:ROMPER_ENABLE_DEVTOOLS = "1"; & "$env:LOCALAPPDATA\Romper\romper.exe"
```

Once the app is running with the variable set, the View menu gains a separator followed by the standard DevTools entries. The default shortcut is `Cmd+Option+I` on macOS and `Ctrl+Shift+I` on Windows / Linux. Use the **Console** tab for renderer errors and the **Network** tab to see whether assets failed to load.

</div>
</div>
</section>
