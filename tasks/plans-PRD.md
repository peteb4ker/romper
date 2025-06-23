# Kit Plans PRD

## 1. Introduction/Overview

The Kit Plans feature enables users to create new kits or modify existing kits before persisting them to local or remote storage. This is analogous to a simplified git working copy. Kit plans solve the problem of adding new samples to a kit and clearly seeing what those changes are before saving. They also help users manage potentially many copies of the same samples across multiple kits without confusion. Romper plans automate the complexity of file structure, naming, and format conversion, allowing users to work with samples from anywhere on their filesystem (e.g., Splice, XO, Ableton) without manual copying or conversion.

## 2. Goals

- Allow users to create, edit, and manage kit plans for new and existing kits.
- Enable users to add, replace, or remove samples in kit slots before committing changes.
- Automate file format validation and conversion for Rample compatibility.
- Persist plan state and metadata in a local SQLite database (Romper DB).
- Provide undo/redo for plan actions (add, remove, replace sample).
- Support drag-and-drop sample assignment from the filesystem.
- Allow toggling plan mode on/off per kit.
- Ensure all changes are previewable and reversible before commit.

## 3. User Stories

- As a Rample owner, I want to create a new kit from my own samples, so I can use my favorite sounds on my hardware.
- As a user, I want to add, replace, or remove samples in a kit and see the changes before saving, so I can experiment without risk.
- As a user, I want to drag and drop multiple samples into a kit and have them automatically assigned to available slots, so I can quickly build kits.
- As a user, I want to preview how my kit will sound before committing changes, so I can be sure how the kit will sound before I move the kit to the SD card and play on hardware.
- As a user, I want to undo or redo changes to my kit plan, so I can easily correct mistakes.
- As a user, I want to see warnings if my samples are in the wrong format, so I know what will be changed on commit.

## 4. Functional Requirements

1. The system must allow users to enable plan mode for an existing kit.
2. Each kit has exactly one plan, which can be toggled on or off.
3. Plan mode is on by default for new kits and off for pre-existing kits (e.g., factory kits).
4. The system must allow users to add, replace, or remove samples in kit slots via drag-and-drop or UI controls.
5. The system must support adding multiple samples at once, incrementally filling slots up to the 12-slot limit per voice.
6. The system must validate that only valid WAV files (8 or 16 bit, 44100 Hz, mono or stereo) are added; invalid files are rejected.
7. The system must warn users if a sample is not in the correct format and indicate that it will be converted on commit.
8. The system must persist all plan changes immediately to the Romper DB (SQLite) in the local store.
9. The system must provide undo/redo for sample addition, removal, and replacement actions.
10. The system must allow users to preview planned samples, including uncommitted ones, from their source location.
11. The system must allow users to commit a plan, which copies and converts all samples to the local store in the correct format and updates the kit state to 'committed.'
12. The system must handle stereo sample assignment according to the 'default to mono samples' global setting, with user prompts for ambiguous cases.
13. The system must initialize the Romper local store and Romper DB if they do not exist, using a wizard to select the source (SD card, Squarp.net archive, or blank folder) and target location.
14. The system must validate that the local store and Romper DB are in sync, warning the user if discrepancies are found.
15. The system must allow users to change the location of the local store and reinitialize as needed.
16. The system must support deleting a sample from a slot as a plan action, and undoing that deletion.
17. The system must display appropriate UI messages for add, replace, and delete actions (e.g., 'Add sample', 'Replace sample').
18. The system must support previewing stereo samples as mono to represent how the sample will sound on the Rampler hardware.
19. There are up to 12 samples per voice.
20. There are exactly 4 voices per kit.
21. The system should use the existing notification system for info, warning, errors and progress.

## 5. Non-Goals (Out of Scope)

- Cloud sync and multi-user editing are not supported in this feature.
- SD card sync operations are out of scope for this PRD (handled elsewhere).
- The Romper DB is not copied to the SD card.
- Advanced versioning (beyond undo/redo) is not included.
- No support for non-WAV audio formats, ever.

## 6. Design Considerations

- UI must clearly indicate plan mode status (on/off) for each kit.
- Drag-and-drop targets should provide clear feedback ('Add sample', 'Replace sample').
- Warnings for format conversion should be visible but non-blocking.
- The plan commit action should be prominent and require confirmation.
- The local store setup wizard should be accessible from settings and on first launch if not configured.
- Undo/redo controls should be easily accessible.
- All UI must be accessible in both light and dark modes.
- The progress of any long running action should be indicated using the application notification system.

## 7. Technical Considerations

- The Romper DB is a SQLite database stored in the `.romperdb` folder within the local store.
- Only one local store and associated DB are active at a time, as set in application settings.
- The local store can be initialized from SD card, Squarp.net archive (https://data.squarp.net/RampleSamplesV1-2.zip), or a blank folder.
  - For SD card source, any folder can be chosen. It is valid if it contains at least one subfolder matching ^[A-Z].*?(?:[1-9]?\d)$; otherwise, a warning is shown and the user must choose another folder.
- All plan changes are persisted immediately to the DB for reliability.
- Sample format conversion (to 16 bit 44100 Hz, mono/stereo as needed) is handled on commit.
- Stereo sample assignment logic must handle edge cases (e.g., last voice, conflicting slots).

## 8. Success Metrics

- Users can create, edit, and commit kit plans without manual file management.
- All plan actions (add, replace, delete, undo/redo) work as described and are persisted.
- Users receive clear warnings for format issues and can preview all planned changes.
- No more than 12 samples per voice and 4 voices per kit are allowed.
- The local store and DB remain in sync, with errors surfaced to the user if not.

## 9. Open Questions

- Should there be a way to export/import plans for sharing between users?
 - No
- What is the expected behavior if the local store or DB becomes corrupted or unsynced?
 - In the future there will be a mechanism to resolve issues.
- Should there be a way to batch commit multiple plans at once?
 - Yes
- Are there additional user prompts or confirmations needed for destructive actions (e.g., deleting a sample, overwriting a slot)?
 - Yes - destructive actions require a prompt.
- Should the plan commit process be cancellable or undoable after starting?
 - No

## 10. Romper DB Schema

The Romper DB is a SQLite database with the following schema (no separate plan table):

### kits
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `name` TEXT NOT NULL (e.g. A0, B2, Z99)
- `alias` TEXT (optional, human-readable name)
- `artist` TEXT (optional, artist name)
- `plan_enabled` BOOLEAN NOT NULL DEFAULT 0 (true for user kits, false for imported/factory kits)

### samples
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `kit_name` TEXT (FK to kits.name)
- `filename` TEXT NOT NULL
- `slot_number` INTEGER NOT NULL CHECK(slot_number BETWEEN 1 AND 12)
- `is_stereo` BOOLEAN NOT NULL DEFAULT 0

- There is no plan table. Each kit may have plan_enabled true/false.
- There is always 0..1 plan per kit, tracked by the plan_enabled flag.
- All imported/factory kits have plan_enabled = false.
- All new/user kits have plan_enabled = true by default.

### Local Store Setup Flow Update (2025-06-14)

- The local store setup wizard flow is now:
  1. User chooses the **source** (SD card, Squarp.net archive, or blank folder)
  2. User chooses the **target** location for the local store
  3. User confirms and imports
- This replaces the previous flow (target first, then source).
- All UI, logic, and documentation must reflect this new order for clarity and user experience.

## Local Store Setup Wizard Flow (Updated 2025-06-17)

The local store setup wizard consists of four discrete actions, which must be performed in order:

1. **Choose the source** (SD card, Squarp.net archive, or blank folder)
2. **Choose the target** location for the local store
3. **Initialize the local store** (copy/download/unzip files, create folders, and initialize the Romper DB)
4. **Cancel** (can be done at any time)

- Step 2 cannot be performed before step 1 is complete and valid.
- Step 3 cannot be performed before step 2 is complete and valid.
- Step 4 (cancel) can be performed at any time.
- The user can only progress from 1 → 2 → 3 if each choice is valid.
- The user can go back from 3 → 2 → 1 to redo their choice at any time before initialization.

### Progress Bar Usage

The progress bar in the wizard is used for:
- Downloading the Squarp.net archive zip (if selected as source)
- Unzipping or moving files into place
- Writing to the database (Romper DB initialization and record insertion)

### UI/UX Requirements
- The wizard must enforce the step order and only enable the next step when the current step is valid.
- The user must be able to go back to previous steps to change their choices before initialization.
- The cancel action must be available at all times and immediately stop any in-progress operation.
- Progress and error states must be clearly displayed during long-running actions (download, unzip, DB write).
- All UI must be accessible in both light and dark modes, with keyboard navigation and visible focus indicators.

---
_Last updated: 2025-06-17_

