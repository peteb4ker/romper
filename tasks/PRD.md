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
42. There is a global volume control to adjust the application audio volume.
43. Later: copy and paste sequences between kits

## Centralized Message Display (Info, Warning, Error)

- The application must display all information, warning, and error messages in a central location at the top of the screen.
- The message display system must support multiple simultaneous messages, displaying them in a stack or queue (not just the latest message).
- Each message must be styled according to its type (info, warning, error).
- Messages should be individually dismissible by the user, and info/warning messages should auto-dismiss after a timeout.
- The system must ensure that no messages are lost if multiple are triggered in quick succession; all should be visible until dismissed or expired.
- The message display logic and UI must be fully unit tested, including scenarios with multiple messages.

## 4-Channel, 16-Step XOX-Style Step Sequencer for Kit Preview

### Introduction/Overview
Add a programmable 4-channel, 16-step XOX-style step sequencer to the kit preview feature. This allows users to quickly program and audition rhythmic patterns using the first sample in each kit voice, making kit previewing more interactive and realistic.

### Goals
- Allow users to program a 4x16 step pattern for each kit.
- Enable playback of the programmed pattern using the first sample in each voice.
- Provide a visually clear, interactive, and keyboard-navigable step grid.
- Persist the test pattern per kit in the labels JSON file.

### User Stories
- As a musician, I want to program a step sequence for a kit so I can preview how the kit sounds in a musical context.
- As a musician, I want to use both mouse and keyboard to toggle steps and navigate the grid for fast editing.
- As a musician, I want my test pattern to be saved with the kit so I can return to it later.

### Functional Requirements
1. The system must display a 4x16 step grid (4 voices, 16 steps per voice) at the bottom of the KitDetails view.
2. Each row (voice) in the grid must be color-coded and match the corresponding color used as a highlight / indicator in the voice panel.
3. Each step must be clickable to toggle on/off, with clear visual feedback (e.g., backlit button style).
4. The grid must support keyboard navigation (arrow keys to move, spacebar to toggle).
5. The user must be able to start and stop playback of the pattern; playback loops continuously at 120 BPM.
6. During playback, the system must play the first sample in each voice for each active step.
7. If a voice has no sample assigned, it is muted for that row.
8. The test pattern must be saved per kit in the labels JSON file and loaded automatically.
9. Only one pattern per kit is supported.
10. No accent/velocity per step; steps are on/off only.
11. Exporting patterns and advanced sequencing features (e.g., swing, step probability) are out of scope.
12. For each of the 16 steps, 0 to 4 samples can be played concurrently.
13. For each voice, if a sample is playing when the next step triggers, that next step chokes the first and starts the second.  Samples are only choked if there is an active step that restarts the voice.  Otherwise, samples pley until they end.

### Non-Goals (Out of Scope)
- Exporting patterns to external formats.
- Multiple patterns per kit.
- Accent/velocity per step.
- Advanced sequencing features (swing, probability, etc.).
- Adjustable tempo (for now; may be added later).
- Choke groups

### Design Considerations
- The sequencer appears at the bottom of the KitDetails view, sliding up from the status bar area.
- Each row uses a distinct color, matching the voice panel for visual consistency.
- Step buttons use a modern, backlit look for clear state indication.
- Keyboard navigation is custom (not browser focus-based).
- The UI is accessible via keyboard but does not require screen reader support.

### Technical Considerations
- Pattern data is stored in the labels JSON file per kit.
- Playback uses the first sample in each voice.
- Future enhancements may include adjustable tempo, per-step sample selection, and SQLite persistence.

### Success Metrics
- Users can program and play a 4x16 pattern for any kit, using both mouse and keyboard, and the pattern is saved and loaded per kit.

### Open Questions
- None at this time.

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
- A-Z hotkeys will scroll to the corresponding bank and move keyboard focus to the first kit in that bank.
- Arrow keys (Up/Down/Left/Right) move focus between kits in the kit browser grid, wrapping between columns as appropriate.
- Enter/Space selects the focused kit.
- Focus indicators must be visible and accessible.
- Navigation is disabled at the first/last kit as appropriate.
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
- Precompute and memoize kit sample counts and voice label sets in the kit browser. These values should be calculated only once per kit list load/change, not on every render, to maximize performance and minimize UI update latency.

## 8. Success Metrics
- Success is measured by the number of kits that are created in the app.

## 9. Open Questions
- None at this time.

## Accessibility Requirements

- All UI elements must be accessible to users with disabilities, following WCAG 2.1 AA guidelines where possible.
- All interactive elements must be keyboard-navigable and have visible focus indicators.
- All UI elements must have sufficient color contrast in both light and dark mode.
- All icons and images must have appropriate alt text or aria-labels.
- The application must be fully usable in both light and dark mode, with accessibility maintained in both themes.




