# 🎛️ Rample Sample Manager

A cross-platform desktop app to manage sample kits for the **Squarp Rample** — a 4-voice Eurorack sampler. Built with **Electron**, **React**, and **Vite**, this app makes it easy to organize, preview, and protect your SD card kits.

---

# Monorepo Structure

This repository is organized as a monorepo with two main packages:

- `app/` – The React/Vite renderer and shared logic
- `electron/` – The Electron main process, preload scripts, and native modules

```
romper/
  app/         # React renderer, shared code, tests, and app-specific configs
  electron/    # Electron main process, preload, resources, and electron-specific configs
  docs/        # Documentation
  tasks/       # Project management and PRD
  ...          # Shared configs (eslint, tailwind, vite, tsconfig, etc.)
```

## Getting Started

### Install dependencies (from repo root)

```sh
npm install
```

### App (Renderer)

```sh
cd app
npm run dev      # Start Vite dev server
npm run build    # Build for production
npm run test     # Run Vitest unit tests
```

### Electron (Main/Preload)

```sh
cd electron
npm run start    # Start Electron in development mode
npm run build    # Build Electron main/preload
npm test         # (if tests are present)
```

## Notes
- Each package manages its own dependencies and build/test scripts.
- Shared configuration is in the repo root and referenced by both packages.
- See each package's README or package.json for more details.

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
