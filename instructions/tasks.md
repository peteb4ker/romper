# Romper Sample Manager – Implementation Task List

## 📁 Sample Management
- [ ] Implement drag-and-drop sample assignment to kit voices/slots in the UI
  - Support multiple file drag-and-drop from OS file explorer only.
  - If multiple files are dropped and the 12 slot limit is exceeded, only the first 12 are added; display a warning for the rest.
  - Provide visual feedback (highlight/placeholder) when dragging over a voice/slot.
  - Validate dropped files as .wav immediately; ignore and warn for invalid files.
- [ ] Enforce 4 voices per kit, with up to 12 slots per voice. The UI always displays 4 voices and enforces slot limits at the UI level. Exceeding the slot limit is not possible; a warning is given if attempted.
- [ ] Inside the SD card, each kit must be in a folder named ?X where: ? is the bank letter, from A to Z. X is the number of the kit, from 0 to 99. E.g., A0, E10, R7, G69, Z99.
- [ ] A kit folder must include at least the voice 1 sample (a valid .wav file starting with '1'), otherwise the kit is invalid. Empty kits are allowed but marked as empty and ignored on sync. Invalid kits (e.g., invalid WAV, duplicate samples per voice) cannot be synced.
- [ ] You can drop stereo samples in your kits. Rules are the same as for mono samples. A stereo sample will fill 2 mono voices if stereo is enabled, or 1 slot if treated as mono.
- [ ] There should be a global setting (default: enabled) to treat stereo samples as mono, settable in app settings. Per-sample stereo/mono toggle is also available. Global toggle sets default for new samples; per-sample toggle is independent. Toggling global does not update existing samples. Conversion to mono happens on SD card write only.
- [ ] When a mono-attributed stereo sample is persisted to the SD card, it is converted to mono using averaging. Show a progress indicator in the status bar for long-running tasks. The original file is untouched; conversion is always from the original path.
- [ ] Prevent duplicate samples in a voice. Duplicates across voices in a kit show a warning (but are allowed). Duplicates across kits are allowed.
- [ ] Store kit plan/sample assignment metadata locally (SQLite). Every metadata change is persisted immediately. Undo/redo is out of scope but data layer should be designed for future support.
- [ ] Display warning or error if user attempts to exceed slot/voice limits (should not be possible at UI level, but warn if attempted).
- [ ] Display warning or error if duplicate sample is added to a voice. Warnings, info, and errors are shown centrally at the top of the app.

## 🎧 Previewing
- [ ] Implement preview for individual `.wav` samples (UI and audio engine)
- [ ] Implement preview for full kits using built-in MIDI test patterns
- [ ] Display waveform view for each sample in the UI

## 📋 Kit Planning
- [ ] Allow creation, duplication, and editing of kit plans without SD card present
- [ ] Allow assignment of samples to specific bank/kit folders in the UI
- [ ] Detect and warn about missing samples in a kit plan
- [ ] Allow locking individual kits to prevent accidental overwriting
- [ ] Implement tagging and favoriting for kits and samples
- [ ] Kit browser organizes all kits by bank (A-Z). At the top, A-Z buttons are shown; only banks with kits are enabled. Clicking or pressing A-Z scrolls/zooms to that bank.

## 🔄 Sync to SD
- [ ] Implement option to initialize app state from SD card
- [ ] Only allow sync when SD card is mounted
- [ ] Prevent sync if any samples in the plan are missing from disk
- [ ] Copy samples destructively to SD card (after user confirmation)
- [ ] Sync both metadata and sample files to SD card

## 🖥 UI & UX Structure
- [ ] Implement main kit browser and kit detail page
- [ ] Place action buttons at the top of the page
- [ ] Implement status bar at the bottom with pertinent information (including progress indicators)
- [ ] Display information, error, and warning messages in a central location at the top of the screen, styled appropriately
- [ ] Implement A-Z hotkeys to scroll to the corresponding bank

## ⚠️ Error Handling & Edge Cases
- [ ] Handle invalid/corrupt `.wav` files gracefully
- [ ] Handle SD card removal during sync or file operations
- [ ] Handle duplicate sample names or hash collisions
- [ ] Handle slot/voice limit violations with user feedback
- [ ] Handle missing samples when opening or syncing a kit plan

## 🏎 Performance
- [ ] Ensure the app is performant with 0 to 2600 kits (test with large datasets)

## 🔒 Security & Privacy
- [ ] Ensure no user data is collected or sent externally
- [ ] Ensure no cloud sync or external network access
- [ ] Ensure the app is standalone and only interacts with the SD card

## 🧪 Testing & Quality
- [ ] Implement unit tests for all business logic (using vitest)
- [ ] Achieve at least 80% code coverage
- [ ] Implement at least one integration test to verify the application loads successfully
- [ ] Add tests for A-Z hotkey navigation
- [ ] Add tests for info/error/warning message display
- [ ] Add tests for kit locking/prevent overwrite
- [ ] Add tests for tagging/favoriting
- [ ] Add tests for missing sample detection/warning

## 🔄 Migration & Customization
- [ ] Ensure migration of existing kits/metadata is not supported
- [ ] Ensure no customization options are present
- [ ] Ensure no undo/redo functionality is present

## 🚀 Release & Distribution
- [ ] Implement GitHub release workflow for app distribution
- [ ] Ensure macOS distribution is working
- [ ] Implement Windows distribution

## 🗂 Metadata & Storage
- [ ] Use `better-sqlite3` for performant local storage
- [ ] Store info for banks, kits, voices, slots, sample paths, tags, favorites in the database
- [ ] Use SHA-256 hash for source file change detection (optional, not enforced)
- [ ] Implement schema for editable, reusable kit plans

## 🧩 Non-Functional Requirements
- [ ] Ensure sub-50ms UI interaction delay
- [ ] Use native filesystem APIs (no browser sandboxing)
- [ ] Ensure destructive sync is only allowed after confirmation and local backup
- [ ] Ensure no multi-user or multi-computer sync is required

## 🚫 Explicit Non-Goals
- [ ] Ensure no browsing of external sample folders (only drag-and-drop)
- [ ] Ensure no `.KIT` binary file editing
- [ ] Ensure no cloud sync or account system
- [ ] Ensure no sample version tracking or collaboration features
