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

- **macOS** -- `Romper-x.x.x.dmg` (drag to Applications)
- **Windows** -- `Romper-Setup-x.x.x.exe` (run the installer)
- **Linux** -- `Romper-x.x.x.AppImage` (make executable and run)

Romper requires no additional dependencies. It runs entirely offline after installation.

## First Launch

When you open Romper for the first time, the setup wizard walks you through choosing where to store your kit data.

### Choosing a Local Store

Romper needs a directory on your computer to keep its database and configuration. This is your **local store**. The wizard gives you several options:

**Start from an SD Card**

If you already have a Rample SD card with kits on it:

1. Insert your SD card and mount it on your computer
2. Select **Load from SD Card** in the wizard
3. Choose the mounted SD card volume
4. Romper scans the standard Rample folder structure (`KITS/`, `SAMPLES/`) and imports all existing kits

Your kits, sample references, and metadata will appear in the Kit Browser immediately.

**Start with Factory Samples**

If you're new to the Rample or want a clean starting point:

1. Select **Download Factory Samples** in the wizard
2. Romper downloads the official Squarp sample packs
3. Factory kits are imported into your local store

This gives you professionally organized kits to explore and learn from.

**Start with an Empty Library**

If you want to build everything from scratch:

1. Select **Create Empty Library**
2. Choose a directory for your local store
3. You'll start with a blank kit grid ready to populate

### Recovering an Existing Store

If you've used Romper before and your settings were lost (reinstall, new machine), you can point Romper at an existing `.romperdb` directory to pick up where you left off. Select **Choose Existing Local Store** in the wizard and browse to the directory.

## The Main Interface

Once setup is complete, you'll see the Kit Browser -- Romper's main view.

The interface has three main areas:

**Header Bar** -- Contains the Sync button, New Kit button, filter toggles (Favorites, Modified), the Validate Store button, and Settings access.

**Kit Grid** -- The central area showing all your kits as cards, organized by bank. Each card shows the kit ID, name, voice sample counts, and status indicators.

**Status Bar** -- Fixed at the bottom, showing your local store path, theme toggle, and links to the Rample manual and About dialog.

![Status bar]({{ site.baseurl }}/images/manual/status-bar.png)

## Connecting Your SD Card

You can connect an SD card at any time, not just during initial setup:

1. Insert your Rample SD card into your computer
2. Use the **Sync to SD Card** button in the header to interact with it
3. Romper validates your kits and copies them to the card

For full details on the sync process, see [Syncing](syncing).

## What's Next

Now that Romper is set up, explore the [Kit Browser](kit-browser) to see how to navigate your library, or jump to [Kit Editor](kit-editor) to learn about editing kits and assigning samples.
