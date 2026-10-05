---
layout: manual
title: Getting Started
prev_page:
  url: /manual/
  title: User Manual
next_page:
  url: /manual/kit-browser
  title: Kit Browser
---

> Romper is designed for users who are already familiar with the Squarp Rample. We recommend reading the [Rample manual](https://squarp.net/rample/manual/) before getting started with Romper, as this guide assumes you understand concepts like banks, kits, voices, and sample layers.

This guide walks you through installing Romper, setting up your local store, and loading your first kits.

## Installation

Download the latest release for your operating system from the [Releases page](https://github.com/peteb4ker/romper/releases):

- **macOS** (Apple silicon) -- `Romper.dmg` (drag to Applications)
- **Windows** -- `Romper-x.x.x.Setup.exe` (run the installer)
- **Linux** -- `romper_x.x.x_amd64.deb` (Debian, Ubuntu) or `romper-x.x.x-1.x86_64.rpm` (Fedora, openSUSE), or the `Romper-linux-x64-x.x.x.zip` archive

Romper requires no additional dependencies and works offline. It goes online only to download the factory samples, if you choose to, and on macOS to check for updates.

## First Launch

When you open Romper for the first time, the setup wizard walks you through choosing where to store your kit data.

### Choosing a Local Store

Romper needs a directory on your computer to keep its database and kits. This is your **local store**. The wizard has three steps: choose a source, choose a target folder, then click **Initialize Local Store**.

For the target, type a path, click **Choose…** to pick a folder (Romper puts the store in a `romper` folder inside it, unless its name already ends in `romper`), or click **Use Default** for `Documents/romper` in your home folder. If a path wasn't picked with **Choose…**, Romper asks you to confirm it with **Use This Folder**. The folder must not already hold a local store.

**Start from an SD Card**

If you already have a Rample SD card with kits on it:

1. Insert your SD card and mount it on your computer
2. Click **Rample SD Card** in the wizard and choose the mounted SD card volume
3. Choose a target folder and click **Initialize Local Store**
4. Romper copies the kit folders at the root of the card (`A0` to `Z99`) into your local store and imports them, naming each voice from its sample filenames. A voice whose samples are all stereo is linked with the next voice automatically when that voice is empty, so they're written back in stereo (see [Stereo and Mono Handling]({{ site.baseurl }}/manual/kit-editor#stereo-and-mono-handling)). The card's bank names (its `A - Name.rtf` files) become your banks' names, so writing back to the card keeps them. Other folders on the card are ignored.

Your kits then appear in the Kit Browser.

**Start with Factory Samples**

If you're new to the Rample or want a clean starting point:

1. Click **Squarp.net Factory Samples** in the wizard
2. Choose a target folder and click **Initialize Local Store**
3. Romper downloads Squarp's factory sample archive (about 313 MiB, requires internet), checks that it's the file Romper expects, extracts it into your local store and imports the kits. The downloaded archive is deleted afterwards.

This gives you professionally organized kits to explore and learn from. If the download fails, Romper tries again, up to 3 attempts in all. Each attempt starts the download from the beginning.

**Disk space:** Setup checks for at least **1 GB of free space** at your target location for factory samples, and 500 MB for an SD card import.

**Start with an Empty Library**

If you want to build everything from scratch:

1. Click **Blank Folder** in the wizard
2. Choose a target folder and click **Initialize Local Store**
3. When setup completes, click **Open Kit Browser**. The browser shows bank A with an **Add Kit** card, which creates your first kit (see [Creating Kits](kit-browser#creating-kits))

### Cancelling Setup

To stop setup while it runs, click **Cancel** and confirm. Romper stops the download, copy or import, removes what setup wrote to the target folder, and closes the wizard. On first launch, closing the wizard quits Romper; the wizard opens again the next time you start it.

### Recovering an Existing Store

If you've used Romper before and your settings were lost (reinstall, new machine), you can point Romper at an existing local store to pick up where you left off. Click **Choose Existing Store** in the wizard, then **Browse for Existing Store**, and choose the folder that contains the `.romperdb` folder (not the `.romperdb` folder itself).

### Switching to Another Local Store

To use a different local store later, choose **File > Change Local Store...**, or open Preferences (`Cmd+,` / `Ctrl+,`), go to **Advanced** and click **Change...**. Choose the folder that contains the `.romperdb` folder, and the Kit Browser reloads from that store. If the folder isn't a local store, Romper says why and keeps using the current one.

## The Main Interface

Once setup is complete, you'll see the Kit Browser -- Romper's main view.

The interface has three main areas:

**Header Bar** -- Contains the Romper icon (click it for the About dialog), search, filter toggles (Favorites, Modified), the **Write** button for syncing to an SD card, and the Settings gear.

**Kit Grid** -- The central area showing all your kits as cards, organized by bank. Each card shows the kit ID, alias, voice sample counts, and status indicators.

**Status Bar** -- Fixed at the bottom, showing your local store path, links to the Romper and Rample manuals, and a theme toggle.

![Status bar]({{ site.baseurl }}/images/manual/status-bar.png)

**Settings** -- Click the gear in the header, or press `Cmd+,` (macOS) / `Ctrl+,` (Windows/Linux), to open Preferences. **Appearance** sets a light, dark or system theme, and **Advanced** shows the local store path and lets you switch to another local store. With **Confirm destructive actions** on (the default) on the **Sample Management** tab, deleting a sample asks first; turn it off to delete at once. Romper remembers these settings the next time it opens.

## Connecting Your SD Card

You can connect an SD card at any time, not just during initial setup:

1. Insert your Rample SD card into your computer
2. Click **Write** in the header
3. Romper checks your kits and writes them to the card

For full details on the sync process, see [Syncing](syncing).

## Troubleshooting Setup

**"No kit folders found"** -- The SD card path you selected doesn't contain the expected folder structure. Rample kits use folders at the root of the card named with an uppercase letter followed by a number from 0 to 99 (e.g., A0, B1, C12). Make sure you're selecting the correct mounted volume.

**"Not enough disk space"** -- Setup checks for about 1 GB free for factory samples and 500 MB for an SD card import. Free up space at your target location and try again.

**"Cannot write to" the target** -- The target directory isn't writable. Choose a location in your Documents folder or another directory you have write access to.

**"This folder already contains a Romper local store"** -- Choose another folder, or click **Choose Existing Store** to use the store that's there.

**"Factory samples download failed after 3 attempts"** -- The connection dropped or stalled each time, and the message says how. Check your internet connection and click **Initialize Local Store** to try again. The factory samples download is about 313 MiB and needs a stable connection.

**"Didn't match the expected checksum"** -- Romper refuses an archive that isn't the exact file it expects, and doesn't download it again on its own. The download may have been damaged on the way, or Squarp changed the file on its server. Click **Initialize Local Store** to try once more; if it fails the same way, update Romper, or set up from an SD card instead.

**Sample limit notice** -- Rample supports a maximum of 12 samples per voice. If a voice on your card has more, Romper keeps the first 12, and after setup it lists each kit and voice with how many samples were skipped and lists the files it left out, so you can move them to another voice or kit. Click **Continue** to open the Kit Browser.

**Stereo voices** -- After setup, Romper also lists each stereo pair it linked automatically, for example "Kit A0: voices 1 and 2 linked automatically as a stereo pair." Any other voice holding stereo samples stays a mono voice, and its stereo samples are mixed down to mono when you write to the card; the kit editor notes it on the voice. What the Rample does with stereo samples on a voice it can't pair is unverified on hardware.

**Local store becomes invalid** -- If you move or delete your local store folder, or it's on a drive that isn't connected when Romper starts, Romper shows the **Invalid Local Store** dialog and keeps the store's location. Connect the drive (or put the folder back) and click **Try Again**, choose another store, or set up a new one. See [Troubleshooting]({{ site.baseurl }}/troubleshooting#local-store-became-invalid).

## What's Next

Now that Romper is set up, explore the [Kit Browser](kit-browser) to see how to navigate your library, or jump to [Kit Editor](kit-editor) to learn about editing kits and assigning samples.
