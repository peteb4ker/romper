---
layout: manual
title: User Manual
next_page:
  url: /manual/getting-started
  title: Getting Started
---

Romper is a desktop application for managing sample kits on the [Squarp Rample](https://squarp.net/rample), a 4-voice Eurorack sampler module. Instead of manually copying, renaming, and organizing WAV files on an SD card, Romper gives you a visual interface to build kits, audition samples, and sync to hardware.

## What Romper Does

The Squarp Rample reads sample kits from an SD card organized in a strict folder structure: 26 banks (A through Z), up to 100 kit slots per bank (00 through 99), and 4 voices per kit with up to 12 sample layers each. Romper automates the folder structure, naming, and organization so you can focus on choosing the right samples.

Romper manages that complexity for you:

- **Browse** all your kits in a visual grid organized by bank
- **Assign samples** by dragging WAV files onto voice slots
- **Preview** individual samples or entire kits with the built-in step sequencer
- **Sync** validated kits to your SD card with automatic backup

## Key Concepts

### Kits

A kit is a collection of 4 voices. Each voice holds up to 12 sample layers that the Rample can switch between. Kits are identified by their bank letter and slot number -- for example, `A0` is the first kit in Bank A.

### Voices

The Rample has 4 independent voices, color-coded in Romper to match the Rample hardware:

- **Voice 1** -- Red
- **Voice 2** -- Yellow
- **Voice 3** -- Green
- **Voice 4** -- Blue

### Reference-Only Editing

Romper never modifies your original sample files. When you assign a sample to a kit, Romper stores a reference to the file's location on your filesystem. The actual file is only copied when you sync to the SD card. This means your sample libraries stay untouched and you can freely experiment with kit arrangements.

### Local Store

Romper keeps its database and metadata in a local store directory (a `.romperdb` folder). This is where kit configurations, favorites, and sequencer patterns are saved. The local store is separate from your SD card -- think of it as your working copy.

## Manual Contents

- [Getting Started](getting-started) -- Installation, first-time setup, and connecting your SD card
- [Kit Browser](kit-browser) -- Navigating banks, filtering kits, and managing your library
- [Kit Details](kit-details) -- Editing voices, assigning samples, and using the step sequencer
- [Syncing](syncing) -- Writing kits to your SD card and managing factory samples
- [Keyboard Shortcuts](keyboard-shortcuts) -- Complete shortcut reference for fast workflow
