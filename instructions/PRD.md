# Product Requirements Document (PRD)

# 📄 Product Requirements Document (PRD): Romper Sample Manager

## 1. Introduction/Overview
Romper is a cross-platform desktop application for organizing, previewing, and syncing sample kits for the **Squarp Rample** Eurorack sampler. It streamlines sample selection, kit creation, and SD card management through a user-friendly UI backed by metadata enrichment.

## 2. Goals
- Allow users to seamlessly navigate hundreds of kits.
- Enable users to find kits and samples within a few seconds.
- Support syncing hundreds of kits to an SD card in (ideally) under a minute.
- Ensure sub-50ms UI interaction delay for responsiveness.
- Support both macOS and Windows platforms.

## 3. User Stories
- As a musician, I want to drag-and-drop sample files into kit voices/slots so I can quickly build new kits.
- As a musician, I want to preview individual samples and entire kits so I can audition sounds before syncing.
- As a musician, I want to build and manage kits without needing the SD card present so I can plan ahead.
- As a musician, I want to lock kits to prevent accidental overwriting so my work is protected.
- As a musician, I want to sync kits and voices to the mounted SD card so I can use them on my Rample.
- As a musician, I want to track and resolve missing source files so my kits are always complete.
- As a musician, I want to tag and favorite samples and kits so I can organize and find them easily.
- As a musician, I want persistent metadata storage so my kit plans and tags are always saved.
- As a musician, I want to create and edit reusable kit plans locally so I can experiment and iterate.

## 4. Functional Requirements
1. The system must allow drag-and-drop sample assignment to kit voices/slots from the OS file explorer.
2. The UI must always display 4 voices per kit, each with up to 12 slots.
3. If multiple files are dropped and the 12 slot limit is exceeded, only the first 12 are added; a warning is displayed for the rest.
4. The UI must provide visual feedback (highlight/placeholder) when dragging over a voice/slot.
5. Dropped files must be validated for `.wav` extension immediately; invalid files are ignored and a warning is shown.
6. The system must prevent duplicate samples per voice; warn (but allow) duplicates across voices in a kit; duplicates across kits are allowed.
7. Kit plan/sample assignment metadata must be stored locally (SQLite); every change is persisted immediately.
8. Kit folders on SD card must be named ?X (A0, E10, etc.); enforced at UI level.
9. A kit folder must include at least the voice 1 sample (a valid .wav file starting with '1') to be valid; empty kits are allowed but marked as empty and ignored on sync.
10. Invalid kits (invalid WAV, duplicate per voice, etc.) cannot be synced.
11. There must be a global setting (in app settings page) to treat stereo samples as mono (enabled by default); can be toggled per sample.
12. When stereo samples are enabled, a stereo sample fills the next available slot in the current voice and the corresponding slot in the next voice; if not enough slots, a warning is shown and the sample is not added.
13. Per-sample stereo/mono toggle: global toggle sets default for new samples, but does not affect existing samples.
14. When a mono-attributed stereo sample is persisted to the SD card, it is converted to mono using averaging; original file is untouched, path is stored in metadata.
15. Progress indicator for long-running tasks (e.g., mono conversion) is shown in the status bar.
16. Warning, info, and error messages are shown centrally at the top of the app.
17. The system must allow previewing of individual `.wav` samples and full kits using built-in MIDI test patterns.
18. The UI must display a waveform view for each sample.
19. The system must allow creation, duplication, and editing of kit plans without SD card present.
20. The system must allow assignment of samples to specific bank/kit folders.
21. The system must detect and warn about missing samples in a kit plan.
22. The system must allow locking individual kits to prevent accidental overwriting.
23. The system must support tagging and favoriting for kits and samples.
24. The system must allow initialization from the SD card, initializing metadata from the existing banks, kits and samples.
25. Sync is only allowed when SD card is mounted.
26. Sync is prevented if samples in plan are missing.
27. The system must copy samples destructively to SD card (after user confirmation).
28. Sync must include both metadata and sample files.
29. The app must be performant from 0 to 2600 kits.
30. The app must use `better-sqlite3` for performant local storage.
31. The app must use native filesystem APIs (no browser sandboxing).
32. The app must be distributed via GitHub releases, with macOS and Windows support.
33. Voices can be given a name by the user.
34. There is an extensible voice name scanning function that, for voices with no names, will look at the samples in that voice and infer the name of that voice. The specification for that is as follows:
   - kick: ["kick", "kk", "bd"]
   - snare: ["snare", "sn", "sd"]
   - clap: ["clap"]
   - closed_hh: ["hh closed", "hh close", "close", "ch", "chh", "closed", "cldHat"]
   - open_hh: ["hh open", "oh", "open"]
   - hh: ["hihat", "hat", "hh"]
   - perc: ["perc", "glass", "clave"]
   - tom: ["tom", "floor tom"]
   - rim: ["rim"]
   - ride: ["ride"]
   - crash: ["crash"]
   - fx: ["fx", "effect", "laser"]
   - bass: ["bass", "808", "sub"]
   - vox: ["vox", "vocal", "voice"]
   - synth: ["pad", "stab", "bell", "chord", "lead", "saw", "JP8"]
   - loop: ["loop"]
   - conga: ["conga"]
35. There is a kit type inference function that will look at the names of the voices in a kit and, based on predetermined rules, mark the kit as a Drum Kit, Loop Kit, Vocal Kit, FX Kit, or Synth Kit. The logic for this is as follows:
   - If all voices are the same and that voice is 'vox', 'loop', or 'fx', use the corresponding kit type.
   - If all voices are 'synth' or 'bass', use 'Synth/Bass Kit'.
   - Otherwise, use 'Drum Kit'.
36. In the kit browser, kit item cards show useful kit metadata including:
   - The kit ID (e.g., A0)
   - The kit name (e.g., House Kit)
   - The icon for the kit type
   - The number of samples assigned for each of the 4 voices. Zero has a red color, 1-11 has a light green color, and 12 has a bold green color indicating 'full'.
   - De-duped labels of the voice names (e.g., "Kick, Snare, Open HH, Closed HH", or "FX" if 4x FX voices)
37. The user can navigate previous and next progressing through kits. Back/forward buttons are disabled for the first and last kit, respectively.
38. The user can toggle between light and dark mode. The toggle is persistent between app launches.
39. There is a link to the Squarp Rample manual: https://squarp.net/rample/manual/ (opens in the system browser).
40. When restoring factory samples, the app should prompt the user with a clear warning message before proceeding. A progress indicator is shown during the operation, and errors are handled gracefully. The process downloads the factory pack, unzips it, enumerates the folders in the factory zip, deletes those folders from the user space, and moves the new folders in place. Metadata is rescanned for these samples.
41. In the kit browser, the user can navigate kits with the arrow keys and hit enter to view the kit. Within a kit, the user can navigate sample slots with up/down arrows and voices with left/right arrows. Hitting space on a sample will preview it.

## 5. Non-Goals (Out of Scope)
- No browsing external sample folders (only drag-and-drop)
- No `.KIT` binary file editing
- No cloud sync or account system
- No need to track sample versions or support collaboration features
- Migration of existing kits/metadata is not supported at this time
- No customization options are provided
- No undo/redo functionality at this time

## 6. Design Considerations (Optional)
- The app consists of a main kit browser and a kit detail page.
- Action buttons are located at the top of the page.
- A status bar at the bottom displays pertinent information.
- Information, errors, and warning messages are displayed in a central location at the top of the screen and are styled appropriately.
- Edge cases (invalid/corrupt files, SD removal, duplication, slot/voice limits, missing samples, etc.) are handled and more will be added as needed.
- A-Z hotkeys will scroll to the corresponding bank.
- UI is built with React and styled with Tailwind CSS.
- There is light and dark mode support.
- The UI must be highly responsive (sub-50ms interaction delay).
- The Rample bank/kit/voice/sample structure is as follows:
  - 26 banks, labeled A to Z
  - Each bank has 100 kit folders: 0 to 99
  - Each kit always has 4 voices
  - Each voice supports up to 12 sample slots
  - Only `.wav` files are supported as samples
- Factory kits can be restored from [RampleSamplesV1-2.zip](https://data.squarp.net/RampleSamplesV1-2.zip)

## 7. Technical Considerations (Optional)
- Built with Electron, React, Vite, and Tailwind CSS.
- Cross-platform: macOS and Windows support.
- Uses `better-sqlite3` for local storage.
- Uses native filesystem APIs for file operations (no browser sandboxing).
- Destructive sync is only allowed after confirmation and local backup.
- No user data is collected.
- No cloud sync or external access.
- The app is standalone and isolated; the only external interaction is syncing with the SD card.
- Data is persisted locally only; no cloud sync is needed.
- No multi-user or multi-computer sync is required.
- Unit testing uses vitest.
- 80% code coverage is required.
- At least one integration test must check that the application loads successfully.
- Tests for A-Z hotkey navigation.
- Tests for info/error/warning message display.
- Tests for kit locking/prevent overwrite.
- Tests for tagging/favoriting.
- Tests for missing sample detection/warning.

## 8. Success Metrics
- Success is measured by the number of kits that are created in the app.

## 9. Open Questions
- None at this time.




