# 🎛️ Rample Sample Manager

[![Tests](https://github.com/peteb4ker/romper/actions/workflows/test.yml/badge.svg)](https://github.com/peteb4ker/romper/actions/workflows/test.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=peteb4ker_romper&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=peteb4ker_romper)
[![codecov](https://codecov.io/gh/peteb4ker/romper/branch/main/graph/badge.svg)](https://codecov.io/gh/peteb4ker/romper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/release/peteb4ker/romper.svg)](https://github.com/peteb4ker/romper/releases/latest)

A cross-platform desktop app to manage sample kits for the **Squarp Rample** — a 4-voice Eurorack sampler. Built with **Electron**, **React**, **TypeScript**, and **Drizzle ORM**, this app makes it easy to organize, preview, and sync your sample kits.

## ✨ Features

- 🎵 **Kit Browser** - Browse and organize your Rample sample kits with metadata
- 🔊 **Sample Preview** - Listen to samples with built-in audio playback and XOX sequencer
- 📁 **Local Store Management** - Safe, non-destructive sample management with reference-only architecture
- ✏️ **Kit Editing** - Add, replace, and organize samples with undo/redo support
- 💾 **Safe Operations** - Validate and sync changes to SD card with format conversion
- 🌙 **Dark/Light Theme** - Modern UI that adapts to your preference

## 🏗️ Project Structure

```
romper/
  app/renderer/    # React UI components and renderer logic
  electron/        # Electron main process and native integrations
  shared/          # Shared utilities between renderer and main
  docs/            # Documentation
  tests/           # End-to-end tests
  .github/chatmodes/ # GitHub Copilot Chatmodes for development workflows
```

## 📚 Documentation

### For Users
- **[Getting Started Guide](docs/user/getting-started.md)** - Installation and first-time setup
- **[User Documentation](docs/index.md)** - Complete user guide and feature overview
- **[Keyboard Shortcuts](docs/user/keyboard-shortcuts.md)** - Speed up your workflow
- **[Settings Guide](docs/user/settings.md)** - Configure Romper preferences

### For Developers
- **[Architecture Overview](docs/developer/architecture.md)** - Core design patterns and decisions
- **[Contributing Guide](docs/developer/contributing.md)** - How to contribute to the project
- **[Development Setup](docs/developer/development.md)** - Set up your development environment
- **[Development Workflow](docs/developer/development-workflow.md)** - Task execution and quality standards
- **[Coding Guide](docs/developer/coding-guide.md)** - Human-readable development best practices
- **[Database Schema](docs/developer/romper-db.md)** - Complete database documentation

### For AI Development Tools
- **[CLAUDE.md](CLAUDE.md)** - Claude Code project instructions with context-aware loading
- **[Agent Instructions](.agent/)** - Machine-readable coding standards and patterns
- **[GitHub Copilot Instructions](.github/copilot-instructions.md)** - Copilot development standards

### Project Management
- **[Product Requirements](tasks/PRD.md)** - Complete project vision and requirements
- **[Current Tasks](tasks/tasks-PRD.md)** - Development progress and task tracking

## 💬 Development Workflows

The project uses structured workflows for different development tasks:

- [**Define.chatmode.md**](.github/chatmodes/Define.chatmode.md) - Create detailed Product Requirements Documents (PRDs)
- [**Plan.chatmode.md**](.github/chatmodes/Plan.chatmode.md) - Generate implementation task lists from PRDs
- [**Build.chatmode.md**](.github/chatmodes/Build.chatmode.md) - Execute tasks methodically with progress tracking

## 🚀 Getting Started

### Install dependencies

```sh
npm install
```

### Development

```sh
npm run dev      # Start development with hot reload
```

### Building

```sh
npm run build    # Build for production
```

### Testing

```sh
npm run lint     # Run ESLint
npm test         # Run unit and integration tests
npm run test:e2e # Run end-to-end tests
```

## ⚙️ Environment Variables

Romper supports the following environment variables for configuration:

- **`ROMPER_SDCARD_PATH`** - Path to your Rample SD card directory (for backward compatibility)
- **`ROMPER_LOCAL_PATH`** - Path to your local sample library directory (takes precedence over ROMPER_SDCARD_PATH)
- **`ROMPER_SQUARP_ARCHIVE_URL`** - URL to the Squarp factory samples archive (defaults to official Squarp URL)

Example usage:
```sh
# Point to your SD card
export ROMPER_SDCARD_PATH="/Volumes/RAMPLE/KITS"

# Or use a local directory
export ROMPER_LOCAL_PATH="/Users/yourusername/RampleSamples"

# Use a custom sample archive
export ROMPER_SQUARP_ARCHIVE_URL="https://custom-url.com/samples.zip"

npm run dev
```

## 🎯 Getting Started with Romper

Romper can work with your SD card in several ways:

### 📱 **From your existing Rample SD card**
If you already have a Rample with sample kits, just point Romper to your SD card directory and start managing your existing kits.

### 🏭 **From Squarp factory samples**
Automatically download the official factory sample packs from [squarp.net](https://squarp.net) and use Romper to organize them into your preferred kit structure.

### 📁 **From an empty folder**
Start fresh! Create a new folder and let Romper help you build your sample library from scratch. Perfect for organizing your own samples into Rample-compatible kits.

---

## 🚀 Features

- 🎚️ **Drag-and-drop sample assignment** to Rample kit voices (1–4)
- 📂 **Browse and manage kits** directly on your Rample SD card
- 🧠 **Kit metadata editing** via `.rample_labels.json` (friendly labels, locked status, role mapping)
- 🎧 **Preview individual samples** using the Web Audio API
- 🥁 **Kit rhythm previews** using built-in pattern templates (e.g., Boom Bap, Techno, Ambient)
- 🛡️ **Protect factory kits** from accidental overwrite with locking
- 🎛️ Enforces **Rample’s strict folder & file format rules**

## User Requirements

Here’s a full list of user requirements for your **Rample Sample Manager** app, formatted in Markdown. You can paste this directly into your `README.md` under a section like `## 🧰 User Requirements`.

---

## 🧰 User Requirements

This desktop application is designed to manage sample kits on the SD card used by the **Squarp Rample**. It should be intuitive, fast, and protective of the card’s contents. Key user requirements include:

### 🧭 Core Functionality

* **SD Card Access**

  * Detect and browse the contents of an inserted SD card.
  * Recognize the standard Rample folder structure (`KITS`, `SAMPLES`, `.rample_labels.json`).

* **Kit Management**

  * View a grid of kits labeled by bank and slot (e.g., `A0`, `B7`).
  * Select a kit and view its 4 voice assignments.
  * Assign or change samples for each voice.
  * Rename kits and slots using a metadata file (`.rample_labels.json`).
  * Kits automatically refreshed if updated on disk

* **Sample Browser**

  * Browse all samples on the SD card by folder.
  * Filter/search samples by name.
  * Audition/play samples before assigning them.
  * Display sample metadata: name, length, bitrate, etc.

* **Drag and Drop**

  * Support dragging samples into voice slots.
  * Optionally support drag-and-drop between kits.

* **File Safety**

  * Never modify or overwrite original `.wav` files.
  * All changes must only affect the `.KIT` binary files and the optional metadata file.

---

### 🎛️ Advanced Features

* **Kit Labeling**

  * Support custom human-readable labels via `.rample_labels.json` sidecar file.

* **Conflict Detection**

  * Warn if sample assignments conflict with other kits (e.g., duplicate use or missing files).

* **Export & Backup**

  * Allow exporting a backup of current kits and metadata.
  * Optionally allow cloning a kit to another slot.

* **Dark Mode**

  * Default to a dark UI theme, suitable for studio environments.
  * Optional light mode toggle.

---

### 🖥️ Platform Requirements

* **Cross-Platform Support**

  * Runs on macOS, Windows, and Linux using Electron.
  * All filesystem operations should be handled using Node’s `fs` module and Electron’s main process API.

* **Local-Only**

  * No cloud sync or online login — this is an offline, local utility.
  * All operations are performed on the local filesystem with no internet dependency.

---

## 🧱 Tech Stack

| Layer         | Tools                         |
|---------------|-------------------------------|
| UI            | React + Vite + Tailwind CSS   |
| Platform      | Electron (Chromium + Node.js) |
| File System   | Node `fs` + `path` modules     |
| Audio Engine  | Web Audio API                 |
| Audio Format  | `music-metadata`, `ffmpeg` (optional) |

---

## 📦 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start development servers

In **Terminal 1**:

```bash
npm run dev
```

In **Terminal 2**:

```bash
npm run start
```

Electron will launch and load the Vite dev server.

---

## 🧪 Preview Pattern Format

Preview kit playback is driven by rhythm pattern templates like:

```json
{
  "id": "boom_bap",
  "tempo_bpm": 90,
  "steps_per_bar": 16,
  "bars": 1,
  "sequence": [
    { "step": 0, "kick": true },
    { "step": 4, "snare": true },
    { "step": 2, "hat": true }
  ]
}
```

These are matched against voice roles (e.g., `kick`, `snare`, `hat`) inferred from filenames or defined in `.rample_labels.json`.

---

## 📝 Kit Metadata Example

Stored in `.rample_labels.json` at the root of the SD card:

```json
{
  "A0": {
    "label": "Glitch Drums",
    "locked": false,
    "roles": {
      "1": "kick",
      "2": "snare",
      "3": "hat",
      "4": "fx"
    }
  }
}
```

---

## 🛠️ Roadmap

- [x] Scaffold Electron + React + Vite project
- [x] Load and display kits from SD card
- [ ] Drag-and-drop sample assignment
- [ ] Validate and convert sample formats
- [ ] Kit preview via sequenced pattern playback
- [ ] UI for metadata editing and kit locking
- [ ] Export/share kits with metadata

---

## 🧃 Credits

Inspired by the excellent design and openness of the [Squarp Rample](https://squarp.net/rample).

---

## 📄 License

MIT License — feel free to fork and remix.
