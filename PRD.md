# Product Requirements Document (PRD)

# 📄 Product Requirements Document (PRD): Romper Sample Manager

## 🧭 Purpose

Romper is a cross-platform desktop application for organizing, previewing, and syncing sample kits for the **Squarp Rample** Eurorack sampler. It streamlines sample selection, kit creation, and SD card management through a user-friendly UI backed by metadata enrichment.

## 🧰 Summary of Features

[ ] Drag-and-drop sample assignment to kit voices/slots
[ ] Preview individual samples and entire kits
[ ] Build and manage kits without SD card present
[ ] Lock kits to prevent accidental overwriting
[ ] Sync kits and voices to the mounted SD card
[ ] Track and resolve missing source files
[ ] Tagging system for samples and kits (including favoriting)
[ ] Persistent metadata storage via SQLite
[ ] Editable, reusable kit plans stored locally

---

## 🧱 System Design Overview

### 🎛 Rample SD Card Structure

* **Banks**: 26 total, labeled `A` to `Z`
* **Kits**: Each bank has 100 folders: `0` to `99`
* **Voices per Kit**: Always 4
* **Sample Slots per Voice**: Up to 12
* **Samples**: `.wav` files only
* **Factory Kits**: Can be restored from [RampleSamplesV1-2.zip](https://data.squarp.net/RampleSamplesV1-2.zip)

---

## 🧾 Functional Requirements

### 📁 Sample Management

* [ ] Drag and drop samples into voices/slots
* [ ] Support 4 voices × up to 12 slots per kit
* [ ] Prevent duplication by referencing source paths
* [ ] Store plan metadata locally

### 🎧 Previewing

* [ ] Preview individual `.wav` samples
* [ ] Preview full kits using built-in MIDI test patterns
* [ ] waveform view for each sample

### 📋 Kit Planning

* [ ] Create, duplicate, edit plans without SD card
* [ ] Assign samples to specific bank/kit folders
* [ ] Detect and warn about missing samples
* [ ] Allow locking individual kits from being overwritten
* [ ] Support tagging and favoriting kits and samples

### 🔄 Sync to SD

* [ ] Option to initialize from SD card
* [ ] Only allow sync when SD is mounted
* [ ] Prevent sync if samples in plan are missing
* [ ] Copy samples destructively to SD card (after user confirmation)
* [ ] Sync includes metadata and sample files

---

## 🖥 UI & UX Structure

- The app consists of a main kit browser and a kit detail page.
- Action buttons are located at the top of the page.
- A status bar at the bottom displays pertinent information.
- Information, errors, and warning messages are displayed in a central location at the top of the screen and are styled appropriately.
- A-Z hotkeys will scroll to the corresponding bank.

---

## ⚠️ Error Handling & Edge Cases

- All information, error, and warning messages are styled and shown in a central location.
- Edge cases (invalid/corrupt files, SD removal, duplication, slot/voice limits, missing samples, etc.) are handled and more will be added as needed.

---

## 🏎 Performance

- The app should be performant from 0 to 2600 kits.

---

## 🔒 Security & Privacy

- No user data is collected.
- No cloud sync or external access.
- The app is standalone and isolated; the only external interaction is syncing with the SD card.

---

## 🧪 Testing & Quality

- Unit testing uses vitest.
- 80% code coverage is required.
- At least one integration test must check that the application loads successfully.

---

## 🔄 Migration & Customization

- Migration of existing kits/metadata is not supported at this time.
- No customization options are provided.
- No undo/redo functionality at this time.

---

## 🚀 Release & Distribution

- The app is distributed via GitHub releases.
- macOS distribution is implemented.
- Windows distribution still needs to be implemented.

---

## 🗂 Metadata & Storage

### 💾 Metadata Backend

* [ ] Use `better-sqlite3` for performant local storage
* [ ] Store info for: banks, kits, voices, slots, sample paths, tags, favorites
* [ ] Use `SHA-256` hash for source file change detection (optional, not enforced)

### 🧠 Kit Plans (Example Schema)

```json
{
  "name": "Deep Techno Kit",
  "bank": "D",
  "kit": "27",
  "locked": false,
  "tags": ["techno", "dark", "fav"],
  "voices": [
    {
      "voice": 1,
      "slots": [
        { "path": "/Samples/Kick.wav", "label": "Kick", "hash": "..." }
      ]
    },
    { "voice": 2, "slots": [] },
    { "voice": 3, "slots": [] },
    { "voice": 4, "slots": [] }
  ]
}
```

---

## 🧩 Non-Functional Requirements

| Category          | Requirement                                                       |
| ----------------- | ----------------------------------------------------------------- |
| Platform          | macOS and Windows support                                         |
| UI Responsiveness | Sub-50ms interaction delay                                        |
| File Access       | Must use native filesystem (no browser sandboxing)                |
| Data Persistence  | Local-only storage; no cloud sync needed                          |
| Safety            | Destructive sync allowed only after confirmation and local backup |
| Portability       | No multi-user or multi-computer sync required                     |

---

## 🚫 Explicit Non-Goals

* No browsing external sample folders (only drag-and-drop)
* No `.KIT` binary file editing
* No cloud sync or account system
* No need to track sample versions or support collaboration


