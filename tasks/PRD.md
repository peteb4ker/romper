# Romper Sample Manager - Product Requirements Document (PRD)

## 1. Introduction/Overview

Romper is a cross-platform desktop application for organizing, previewing, and syncing sample kits for the **Squarp Rample** Eurorack sampler. It streamlines sample selection, kit creation, and SD card management through a user-friendly UI backed by metadata enrichment.

The folder structure, file naming conventions, voice count (4 voices per kit), WAV format requirements, and other technical specifications referenced throughout this document are defined by the Squarp Rample hardware and software specifications. For complete details on these device attributes, refer to the official [Squarp Rample manual](https://squarp.net/rample/manual/).

Kits are editable, enabling users to create new kits or modify existing kits before persisting them to local or remote storage. This is analogous to a simplified git working copy. Kits solve the problem of adding new samples to a kit and clearly seeing what those changes are before saving. They also help users manage potentially many copies of the same samples across multiple kits without confusion. Romper automates the complexity of file structure, naming, and format conversion, allowing users to work with samples from anywhere on their filesystem (e.g., Splice, XO, Ableton) without manual copying or conversion.

This software is open source and not developed or endorsed by Squarp.

## 1.1 Problem Statement

Managing samples for the Squarp Rample currently requires manual file management using a basic file browser. Users must:

- Manually copy, rename, and reformat WAV files to match Rample's specific naming conventions
- Navigate complex folder structures (26 banks × 100 kits × 4 voices × 12 samples)
- Convert audio formats manually (stereo to mono, sample rate conversion)
- Manage dozens of kits without preview capabilities
- Risk data loss when making changes directly to SD card

This process is slow, error-prone, and becomes unwieldy when managing dozens of kits. For users who want to iterate quickly and experiment with different sample combinations, the current workflow is a significant barrier to creativity.

## 1.2 Target Users

While all users are "Rample owners," they fall into different experience levels:

### Primary User: The Creative Experimenter
- **Profile**: Owns a Rample, wants to make music efficiently
- **Pain Points**: Current workflow kills creative flow, too much time on file management
- **Goals**: Quick iteration, easy experimentation, reliable sync to hardware
- **Technical Level**: Comfortable with basic file operations, can convert audio formats

### Secondary User: The Workflow Optimizer
- **Profile**: Experienced Rample user, manages many kits, values efficiency
- **Pain Points**: Scaling current workflow to hundreds of kits is impossible
- **Goals**: Batch operations, organizational tools, fast navigation
- **Technical Level**: Advanced user, understands audio formats, wants keyboard shortcuts

## 1.3 User Journeys

The three main user journeys are:

### Setup Journey
- **Goal**: Get Romper configured and ready to use
- **Current Pain Points**:
  - None: the app is in its default state prior to this step.
  - SD card might be corrupted or have unexpected structure
- **Key Steps**: Run setup wizard → Choose source → Choose target → Initialize
- **Success Criteria**: User can immediately start creating/editing kits

#### Setup Edge Cases & Recovery
- **Corrupted SD card**: Auto-detect corruption, offer factory samples as fallback
- **Network failure during download**: Resume download, offer retry with exponential backoff
- **Insufficient space**: Calculate space needed, guide user to free space or choose different location
- **Permission denied**: Guide user to fix permissions or choose accessible location
- **Partial previous installation**: Detect existing state, offer to clean up or resume
- **Invalid SD card structure**: Show expected vs actual structure, offer to initialize anyway

### Kit Creation and Management Journey
- **Goal**: Create, edit, and organize sample kits efficiently
- **Current Pain Points**:
  - No local preview on the users computer. Users can only see contents of kits when removing the SD card from the device and mounting on their computer.
  - Accidentally dropping wrong file formats
  - Losing track of which samples are assigned where
  - Difficulty organizing large numbers of kits
- **Key Steps**: Browse samples → Drag/drop into kit → Preview/audition → Save changes
- **Success Criteria**: User can create a kit in <2 minutes vs 10+ minutes manually

#### Typical Kit Creation Workflows
1. **From scratch**: Create new kit → Add samples one by one → Preview → Assign to bank/slot
2. **From existing kit**: Duplicate kit → Replace some samples → Preview changes → Save
3. **Bulk creation**: Drop multiple samples → Auto-assign to voices → Batch preview → Organize

#### Common Mistakes & Solutions
- **Wrong file format**: Clear format requirements, auto-conversion offers
- **Overfilling voices**: Clear slot limits, visual indicators for full voices
- **Forgetting to save**: Auto-save with clear state indicators
- **Losing editable state**: Clear visual indicators, easy toggle controls
- **Accidental overwrites**: Confirmation dialogs, easy undo options

#### Iteration Patterns
- **Rapid prototyping**: Quick sample swapping with immediate preview
- **A/B testing**: Duplicate kit, modify, compare side-by-side
- **Progressive refinement**: Start with rough samples, gradually replace with better ones
- **Batch operations**: Select multiple kits, apply changes to all

### Sync to Hardware Journey
- **Goal**: Get finalized kits onto SD card for use with Rample
- **Current Pain Points**:
  - SD card unexpectedly removed during sync
  - Source samples moved/deleted since kit creation
  - Format conversion failures during sync
  - Long sync times for large numbers of kits
  - Uncertainty about what actually got synced
- **Key Steps**: Select kits → Resolve conflicts → Batch sync → Verify on hardware
- **Success Criteria**: User can sync multiple kits reliably without data loss

#### Sync Scenarios (NOTE: only Full Sync is initially implemented)
1. **Single kit sync**: Select kit → Check for issues → Sync → Verify
2. **Batch sync**: Select multiple kits → Resolve conflicts → Sync all → Progress tracking
3. **Incremental sync**: Sync only changed kits → Skip unchanged → Fast completion
4. **Full sync**: Clear SD card → Sync all kits → Complete rebuild

#### Conflict Resolution
- **Slot conflicts**: Show conflicting kits, allow user to reassign slots
- **Missing samples**: Show missing files, offer to locate or skip
- **Format issues**: Show conversion details, confirm before proceeding
- **Space constraints**: Show space needed vs available, help prioritize kits

#### Batch Operations
- **Select all**: Quick selection of all kits for sync
- **Filter selection**: Sync only tagged, favorited, or recently modified kits
- **Smart selection**: Auto-select kits that have changed since last sync
- **Progress tracking**: Real-time progress with ability to pause/resume

#### Verification & Recovery
- **Sync verification**: Check that files were written correctly
- **Rollback capability**: Restore previous SD card state if sync fails
- **Partial sync recovery**: Resume interrupted sync from last successful kit
- **Hardware verification**: Guide user to test kits on actual Rample hardware

### Common Workflow Patterns

#### First-Time User Flow
1. **Setup**: Install Romper → Run setup wizard → Choose factory samples source → Initialize
2. **Exploration**: Browse existing kits → Preview samples → Understand 4-voice structure
3. **First Kit**: Create new kit → Add samples → Use XOX sequencer → Preview → Sync to test
4. **Iteration**: Modify kit → Preview changes → Sync again → Test on hardware
5. **Refer**: Browse Romper → (On Rample) Change kits → (On Rample) Play kits

#### Power User Flow
1. **Kit Creation**: Rapid prototyping with keyboard shortcuts → Batch preview → Organize
2. **Tag and organize**: Copy kits → Tag kits → Easily find kits

## 2. Goals

### Application Goals
- Allow users to seamlessly navigate hundreds of kits.
- Enable users to find kits and samples within a few seconds.
- Support syncing hundreds of kits to an SD card in (ideally) under a minute.
- Ensure sub-50ms UI interaction delay for responsiveness.
- Support cross-platform usage on macOS, Linux and Windows.

### Kit Goals
- Enable users to add, replace, or remove samples in kit slots before updating the SD card.
- Ensure all changes are previewable and reversible before updating the SD card.
- Provide a safe, non-destructive workflow for kit experimentation and iteration.

### Preview and Audition Goals
- Enable users to preview individual samples and complete kits before syncing.
- Provide visual feedback through waveforms and audio playback.
- Allow users to audition kits in musical context using the XOX sequencer.
- Allow users to program a 4x16 step pattern for each kit to preview how it sounds.
- Provide a visually clear, interactive, and keyboard-navigable step grid.
- Persist test patterns per kit in the Romper DB for later use.

### Setup and Configuration Goals
- Provide a simple, guided setup process for new users.
- Support multiple initialization sources (SD card, factory samples, blank).
- Allow users to configure their preferred local store location.
- Create a local snapshot of SD card initial state upon which Romper DB references are applied to build a working local copy of the target SD card.

## 3. User Stories

### Kit Management User Stories

- **As a Rample owner, I want to drag-and-drop sample files into kit voices/slots so I can quickly build new kits.**
  - *Acceptance Criteria*: Can drag WAV files from OS file explorer into specific voice slots, see visual feedback during drag, get immediate confirmation when dropped, receive clear error for invalid files

- **As a Rample owner, I want to create and edit reusable kits locally so I can experiment and iterate.**
  - *Acceptance Criteria*: Can create new empty kit, duplicate existing kit, modify samples without affecting original, save changes with clear state indicators

- **As a Rample owner, I want to add, replace, or remove samples in a kit and see the changes before saving, so I can experiment without risk.**
  - *Acceptance Criteria*: All changes show in preview mode, can undo/redo any action, clear visual distinction between original and modified state, can abandon changes without saving

- As a Rample owner, I want to drag and drop multiple samples into a kit and have them automatically assigned to available slots, so I can quickly build kits.
- As a Rample owner, I want to undo or redo changes to my kit, so I can easily correct mistakes.
- As a Rample owner, I want to lock kits to prevent accidental overwriting so my work is protected.

### Preview and Audition User Stories

- **As a Rample owner, I want to preview individual samples and entire kits so I can audition sounds before syncing.**
  - *Acceptance Criteria*: Can click any sample to hear it immediately, can play entire kit using sequencer, audio matches what will play on hardware, global volume control works

- **As a Rample owner, I want to program a step sequence for a kit so I can preview how the kit sounds in a musical context.**
  - *Acceptance Criteria*: Can toggle steps on/off with mouse and keyboard, pattern plays back accurately, can start/stop playback, pattern saves automatically with kit

- **As a Rample owner, I want to see waveforms for my samples so I can visually understand their characteristics.**
  - *Acceptance Criteria*: Waveform displays immediately when sample is loaded, shows accurate representation of audio content, updates when sample is replaced

- As a Rample owner, I want to preview how my kit will sound before updating the SD card, so I can be sure how the kit will sound before I move the kit to the SD card and play on hardware.
- As a Rample owner, I want to control the application volume so I can audition samples at comfortable levels.
- As a Rample owner, I want to use both mouse and keyboard to toggle steps and navigate the grid for fast editing.
- As a Rample owner, I want my test pattern to be saved with the kit so I can return to it later.

### Organization and Metadata User Stories
- As a Rample owner, I want to tag and favorite samples and kits so I can organize and find them easily.
- As a Rample owner, I want persistent metadata storage so I can quickly understand all of my kits using a rich UI, instead of depending on the limited UI on the romper or mounting the SD card to use a file browser.
- As a Rample owner, I want persistent metadata storage so my kit plans and tags are always saved.

### SD Card and Sync User Stories
- As a Rample owner, I want to build and manage kits without needing the SD card present so I can plan ahead.
- As a Rample owner, I want to sync kits to a mounted SD card so I can use them on my Rample.
- As a Rample owner, I want to track and resolve missing source files so my kits are always complete.
- As a Rample owner, I want to see warnings if my samples are in the wrong format, so I know what will be changed when updating the SD card.

### Audio Format and Processing User Stories
- As a Rample owner, I want to control whether stereo samples are treated as mono by default so I can manage my preferred workflow.
- As a Rample owner, I want to be warned when samples need format conversion so I understand what changes will be made.
- As a Rample owner, I want stereo samples to be properly handled according to my settings so they work correctly with the Rample hardware.

### Application UI and Navigation User Stories
- As a Rample owner, I want to navigate through kits efficiently using keyboard shortcuts so I can browse quickly.
- As a Rample owner, I want to see useful metadata about each kit in the browser so I can identify kits at a glance.
- As a Rample owner, I want to toggle between light and dark mode so I can use the app comfortably in different lighting conditions.
- As a Rample owner, I want clear visual feedback and progress indicators so I understand what the application is doing.

### Setup and Configuration User Stories
- As a Rample owner, I want to easily set up the application for first use so I can start working with my kits quickly.
- As a Rample owner, I want to choose my local store location so I can organize my files where I prefer.
- As a Rample owner, I want to initialize from different sources (SD card, factory samples, blank) so I can start with the content I prefer as my immutable baseline.
- As a Rample owner, I want my chosen initialization source to become a permanent baseline that preserves my starting point, so I can always reference my original content.

## 4. Functional Requirements

> **Note**: The following capabilities represent the core functionality needed to achieve the user goals outlined above. Detailed implementation specifications are available in the [Technical Specifications](#technical-specifications) section.

### 4.1 Kit Management Capabilities

**Core Kit Operations**
- Create, duplicate, and delete kits locally without SD card present
- Add, replace, and remove samples in kit slots via drag-and-drop from OS file explorer
- Support for 4 voices per kit, each with up to 12 sample slots
- Enable/disable editable mode for safe kit experimentation
- Provide undo/redo functionality for all kit editing actions

**File Handling & Validation**
- Accept only valid WAV files (8 or 16 bit, 44100 Hz, mono or stereo)
- Validate file extensions and audio formats on drop
- Handle multiple file drops with incremental slot assignment until 12-slot limit reached
- User prompts for bulk operations that will exceed voice limits
- Prevent duplicate samples within voices while allowing cross-voice and cross-kit duplicates
- Store source file paths for preview without copying files locally

**Kit Organization & Metadata**
- Support user-defined voice names with automatic inference from sample names
- Classify kits by type (Drum, Loop, Vocal, FX, Synth/Bass) based on voice content
- Enable tagging and favoriting of kits and samples
- Assign kits to specific SD card bank/slot locations (A0-Z99)

### 4.2 Preview and Audition Capabilities

**Audio Preview System**
- Preview individual samples and complete kits before syncing
- Display waveform visualizations for all samples
- Handle stereo-to-mono conversion to match Rample hardware behavior
- Provide global volume control for comfortable audition levels

**XOX Step Sequencer**
- 4x16 step grid interface (4 voices × 16 steps) for kit audition
- Color-coded rows matching voice panel indicators
- Mouse and keyboard navigation (arrows to move, spacebar to toggle)
- Playback at 120 BPM with start/stop controls
- Save/load test patterns per kit in database
- Support concurrent sample playback with voice choking behavior

### 4.3 SD Card Sync and Storage Capabilities

**Sync Operations**
- Copy and convert samples to SD card with user confirmation
- Handle format conversion (16 bit 44100 Hz, mono/stereo as needed)
- Detect and warn about missing source files before sync
- Prevent sync of invalid or incomplete kits
- Update kit state to 'synced' after successful SD card write

**Format & File Management**
- Enforce SD card naming conventions (?X format: A0, B1, Z99, etc.)
- Convert stereo samples to mono using averaging when configured
- Preserve original files while storing converted versions on SD card
- Validate minimum kit requirements (voice 1 sample) for sync eligibility

### 4.4 Setup and Configuration Capabilities

### Setup and Configuration Capabilities

**Initial Setup & Immutable Baseline Creation**
- Setup wizard for first-time configuration
- Support multiple initialization sources (SD card, factory samples archive, blank)
- Local store location selection and validation
- Database initialization and baseline content establishment
- **Immutable Baseline Preservation**: Once initialized, the local store baseline is never modified, preserving the exact state chosen during setup

**Reference-Only Sample Management**
- All user-added samples are referenced by absolute path (`source_path`) without copying to local store
- External sample resolution during preview and sync operations
- Missing file detection and user notification before sync
- Zero-bloat architecture that prevents local store pollution

**Audio Format Preferences**
- Global "default to mono samples" setting (enabled by default) with persistent storage
- Per-sample stereo/mono toggle overrides when global setting is disabled
- Format conversion warnings and user prompts for conflicting stereo sample placement
- Handle stereo sample assignment across voices (left → voice N, right → voice N+1) when enabled
- User prompts when stereo samples conflict with existing samples in next voice
- Auto-convert stereo samples to mono with warning when added to voice 4 (no next voice available)

### 4.5 User Interface and Navigation Capabilities

**Kit Browser Interface**
- Display kit metadata cards with ID, name, type icon, and sample counts
- Color-coded sample count indicators (red=0, light green=1-11, bold green=12)
- Show deduplicated voice name labels for quick kit identification
- Previous/next navigation with appropriate button state management

**Keyboard Navigation & Accessibility**
- A-Z hotkeys for bank navigation with focus management
- Arrow key navigation within kit browser and detail views
- Spacebar sample preview and Enter kit selection
- Light/dark mode toggle with persistent preference
- Visible focus indicators and accessible UI elements

**Messaging & Progress System**
- Centralized message display at top of application
- Support for multiple simultaneous messages (info, warning, error)
- Individual message dismissal and auto-timeout for non-critical messages
- Progress indicators for long-running operations (conversion, sync, download)
- Link to Squarp Rample manual for hardware reference

### 4.6 Performance and Technical Capabilities

**Performance Requirements**
- Handle 0-2600 kits efficiently
- Sub-50ms UI interaction response time
- Optimized rendering with memoized kit metadata
- Immediate persistence of all changes to local database

## 5. Non-Goals (Out of Scope)

### General Application Non-Goals
- No browsing external sample folders (only drag-and-drop)
- No cloud sync or account system
- No need to track sample versions or support collaboration features
- Migration of existing kits/metadata is not supported at this time
- No customization options are provided

### Kit Non-Goals
- Cloud sync and multi-user editing are not supported.
- SD card sync operations are out of scope for this PRD (handled elsewhere).
- The Romper DB is not copied to the SD card.
- Advanced versioning (beyond undo/redo) is not included.
- No support for non-WAV audio formats, ever.

### Preview and Audition Non-Goals
- Exporting patterns to external formats.
- Multiple patterns per kit.
- Accent/velocity per step (TODO: later)
- Advanced sequencing features
 - swing (later)
 - probability (never)
- Adjustable tempo (later).
- Choke groups

## 5.1 Error Handling Strategy

### Philosophy
- **Graceful degradation**: App remains functional when non-critical errors occur
- **Clear user communication**: Error messages explain what happened and what to do next
- **Automatic recovery**: Where possible, automatically retry or fix issues
- **Data protection**: Never corrupt user data or SD card contents

### Error Categories

#### File System Errors
- **Missing files**: Show clear path, offer to locate/replace
- **Permission issues**: Guide user to fix permissions or choose different location
- **Corrupted files**: Warn user, offer to skip or replace
- **Disk space**: (Later) Show space needed, help user free space or choose different location

#### Format Errors
- **Invalid WAV files**: Show format details, offer automatic conversion
- **Wrong sample rates**: Auto-convert with user confirmation
- **Unsupported formats**: Clear message about supported formats only

#### Hardware Errors
- **SD card removed**: Pause operations, wait for reconnection
- **Insufficient space**: Calculate space needed, guide user to free space
- **Read/write failures**: Retry with exponential backoff, offer alternative actions

#### Data Integrity Errors
- **DB corruption**: Automatic backup restore, manual recovery options
- **Sync mismatches**: Show differences, allow user to choose resolution
- **Missing references**: Offer to locate files or remove broken references

## 6. Design Considerations

### Design Philosophy
- **Immediate feedback**: Every action shows immediate visual/audio feedback
- **Forgiving workflow**: Easy undo/redo, non-destructive by default
- **Efficient for power users**: Keyboard shortcuts, batch operations
- **Accessible to newcomers**: Clear visual hierarchy, guided workflows
- **Respectful of user data**: Always confirm destructive actions
- **Hardware-accurate**: Preview experience matches Rample hardware behavior

### General Application Design
- The app consists of a main kit browser and a kit detail page.
- Action buttons are located at the top of the page.
- A status bar at the bottom displays pertinent information.
- Information, errors, and warning messages are displayed in a central location at the top of the screen and are styled appropriately.
- Edge cases (invalid/corrupt files, SD removal, duplication, slot/voice limits, missing samples, etc.) are handled and more are added as needed.
- A-Z hotkeys scroll to the corresponding bank and move keyboard focus to the first kit in that bank.
- Focus indicators are visible and accessible.
- Navigation is disabled at the first/last kit as appropriate.
- There is light and dark mode support.
- The UI is highly responsive (sub-50ms interaction delay).
- The Rample bank/kit/voice/sample structure is as follows:
  - 26 banks, labeled A to Z
  - Each bank has 100 kit folders: 0 to 99
  - Each kit always has 4 voices
  - Each voice supports up to 12 sample slots
  - Only `.wav` files are supported as samples
- Factory kits can be restored from [RampleSamplesV1-2.zip](https://data.squarp.net/RampleSamplesV1-2.zip)
- The progress of any long running action is indicated using the application notification system.

### Kit Design Considerations
- UI clearly indicates editable mode status (on/off) for each kit.
- Drag-and-drop targets provide clear feedback ('Add sample', 'Replace sample').
- Warnings for format conversion are visible but non-blocking.
- The SD card update action is prominent and requires confirmation.
- The setup wizard is accessible from settings and on first launch if not configured.
- Undo/redo controls are easily accessible.

### Preview and Audition Design Considerations
- Individual sample and kit preview capabilities are easily accessible.
- Waveform visualization provides clear visual feedback for all samples.
- Audio playback accurately represents how samples will sound on the Rample hardware.
- The XOX sequencer appears at the bottom of the KitDetails view, sliding up from the status bar area.
- Each sequencer row uses a distinct color, matching the voice panel for visual consistency.
- Step buttons use a modern, backlit look for clear state indication.
- Keyboard navigation is custom (not browser focus-based).
- The sequencer UI is accessible via keyboard but does not require screen reader support.

## 7. Project Context

**Note**: Romper is an open-source hobby project developed by and for the Rample community. This PRD focuses on user value and technical implementation rather than business strategy, competitive analysis, or commercial metrics, as these are not applicable to this project context.

## 7.1 Contribution Guidelines and Community Management

### Project Home
- **Repository**: https://github.com/peteb4ker/romper
- **License**: MIT
- **Community**: Built by and for Rample owners and electronic music producers

### Contributing to Romper
Pull requests are welcome! We encourage contributions from the Rample community to help improve the tool for everyone.

#### Getting Started
- Fork the repository on GitHub
- Read the development documentation in `/docs/development.md`
- Check existing issues and discussions before starting new work
- Follow the coding standards outlined in `.github/copilot-instructions.md`

#### Types of Contributions Welcome
- **Bug fixes**: Help identify and resolve issues affecting users
- **Feature enhancements**: Improvements to existing functionality based on user feedback
- **Performance optimizations**: Especially around kit loading and UI responsiveness
- **Documentation**: Improvements to user guides, API docs, and developer documentation
- **Testing**: Additional test coverage and edge case validation
- **UI/UX improvements**: Accessibility enhancements and user experience refinements

#### Contribution Process
1. **Discuss first**: For significant changes, open an issue to discuss the approach
2. **Follow coding standards**: Use TypeScript, follow existing patterns, maintain test coverage
3. **Test thoroughly**: Run `npm test` and `npm run test:e2e` before submitting
4. **Update documentation**: Include relevant docs updates with your changes
5. **Submit PR**: Provide clear description of changes and motivation

#### Community Guidelines
- **Respectful collaboration**: Maintain a welcoming environment for all skill levels
- **User-focused**: Prioritize changes that improve the experience for Rample owners
- **Quality standards**: Maintain code quality, test coverage, and documentation standards
- **Hardware context**: Remember that all features should align with Rample hardware capabilities

### Feedback and Support
- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions and community interaction
- **Documentation**: Refer to `/docs/` for user guides and technical documentation

## 8. Success Metrics

### Overall Success Metrics
- **Time savings**: Users can create/modify kits in <2 minutes vs 10+ minutes manually
- **Usability**: New users can complete first kit creation within 5 minutes of setup
- **Reliability**: <1% data loss or corruption incidents
- **Workflow efficiency**: Users can audition changes before committing to SD card
- **Local storage**: Minimize duplication of sample WAV files

### Kit Success Metrics
- Users can create, edit, and update kits to SD card without manual file management
- All actions (add, replace, delete, undo/redo) work as described and are persisted
- Users receive clear warnings for format issues and can preview all changes
- The local store and DB remain in sync, with errors surfaced to the user if not

### Preview and Audition Success Metrics
- Users can preview individual samples and complete kits before syncing to SD card
- Waveform visualization provides useful visual feedback for all samples
- Audio playback accurately represents how samples will sound on the Rample hardware
- Users can program and play a 4x16 pattern for any kit, using both mouse and keyboard, and the pattern is saved and loaded per kit

### Setup and Configuration Success Metrics
- New users can complete the setup wizard successfully on first launch
- Users can initialize from any supported source (SD card, factory samples, blank) without errors
- Local store configuration is persistent and reliable across app sessions

## 9. Open Questions

### General Application Open Questions
- None at this time.

### Kit Open Questions
- Should there be a way to export/import kits for sharing between users?
 - No
- What is the expected behavior if the local store or DB becomes corrupted or unsynced?
 - In the future there will be a mechanism to resolve issues.
- Should there be a way to batch update multiple kits to SD card at once?
 - Yes
- Are there additional user prompts or confirmations needed for destructive actions (e.g., deleting a sample, overwriting a slot)?
 - Yes - destructive actions require a prompt.
- Should the SD card update process be cancellable or undoable after starting?
 - No

---

# Technical Specifications

> **Note**: The following sections contain implementation details, database schemas, and technical requirements. These should be referenced by developers but are separated from the product requirements above.

## 10. Romper DB Schema

The Romper DB is a SQLite database with the following schema:

### kits
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `name` TEXT NOT NULL (e.g. A0, B2, Z99) - serves as natural key for kit identification
- `alias` TEXT (optional, human-readable name)
- `artist` TEXT (optional, artist name)
- `editable` BOOLEAN NOT NULL DEFAULT 0 (true for user kits, false for imported/factory kits)
- `step_pattern` TEXT (optional, JSON string storing 4x16 step pattern for XOX sequencer)

### samples
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `kit_name` TEXT NOT NULL (FK to kits.name) - references kit by name, not ID
- `voice_number` INTEGER NOT NULL CHECK(voice_number BETWEEN 1 AND 4) - explicit voice assignment (1-4)
- `slot_number` INTEGER NOT NULL CHECK(slot_number BETWEEN 1 AND 12) - slot within voice (1-12)
- `source_path` TEXT NOT NULL (absolute path to original sample file for external references)
- `filename` TEXT NOT NULL (filename used on SD card)
- `is_stereo` BOOLEAN NOT NULL DEFAULT 0

### voices
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `kit_name` TEXT NOT NULL (FK to kits.name) - references kit by name
- `voice_number` INTEGER NOT NULL CHECK(voice_number BETWEEN 1 AND 4) - voice position (1-4)
- `alias` TEXT (optional, user-defined voice name, e.g., "Kick", "Snare")

### Architecture Notes
- There is no separate plan table. Each kit may have editable true/false.
- There is always 0..1 editable state per kit, tracked by the editable flag.
- All imported/factory kits have editable = false.
- All new/user kits have editable = true by default.
- **Immutable Baseline Local Store**: The local store serves as an immutable baseline that preserves the initial state chosen during setup (SD card contents, factory samples, or empty folder). This baseline is never modified after initialization.
- **Reference-Only Sample Management**: Samples reference their original source files via `source_path` - no copying to local store until SD card sync. This prevents local store bloat and maintains clean separation between baseline content and user additions.
- **Explicit Voice Tracking**: The `voice_number` field provides explicit voice assignment (1-4) rather than inferring voice from sample ordering, ensuring reliable voice identification.
- **Kit Name as Foreign Key**: Uses `kit_name` rather than `kit_id` for foreign key relationships, providing natural human-readable references.
- No sample_files table or local_store_path tracking - samples stay in original locations until sync.

## 11. Technical Implementation Details

### General Application Technical Details
- Built with Electron, React, Vite, and Tailwind CSS.
- Cross-platform: macOS, Linux and Windows support.
- Uses `better-sqlite3` for local storage.
- Uses native filesystem APIs for file operations (no browser sandboxing).
- Distributed via GitHub releases, with macOS and Windows support.
- Destructive sync is only allowed after confirmation and local backup.
- No user data is collected.
- The app is standalone and isolated; the only external interaction is syncing with the SD card.
- Data is persisted locally only; no cloud sync is needed.
- No multi-user or multi-computer sync is required.
- Unit testing uses vitest.
- 80% code coverage is required.
- At least one integration test checks that the application loads successfully.
- Tests for A-Z hotkey navigation.
- Tests for info/error/warning message display.
- Tests for kit locking/prevent overwrite.
- Tests for tagging/favoriting.
- Tests for missing sample detection/warning.
- Precompute and memoize kit sample counts and voice label sets in the kit browser. These values are calculated only once per kit list load/change, not on every render, to maximize performance and minimize UI update latency.

### Database Layer Requirements
- **ORM Integration**: Migrate from raw SQL to Drizzle ORM for improved type safety, modularity, and maintainability.
- **Type-Safe Queries**: All database operations must be compile-time type-checked with full TypeScript integration.
- **Clean API Design**: Replace complex wrapper patterns with direct, simple function signatures that leverage TypeScript's native error handling.
- **Schema-First Approach**: Define database entities using Drizzle's schema definition for clear data modeling and automatic type generation.
- **Connection Management**: Implement efficient database connection lifecycle management with proper resource cleanup.
- **Business Logic Separation**: Separate database access logic from business logic to improve testability and modularity.
- **Migration Support**: Use Drizzle's migration system for schema changes, particularly for adding the missing `source_path` field to samples table.
- **Performance Optimization**: Maintain or improve current query performance while reducing code complexity and improving maintainability.
- **Better-SQLite3 Compatibility**: Ensure seamless integration with existing `better-sqlite3` driver without requiring database engine changes.

### Hardware Constraints
- There are always 4 voices per kit and no more than 12 samples per voice - this is a fundamental technical specification of the Rample hardware.
- Only `.wav` files are supported as samples.
- The Rample bank/kit/voice/sample structure is: 26 banks (A-Z), each with 100 kit folders (0-99).

### Kit Technical Considerations
- The Romper DB is a SQLite database stored in the `.romperdb` folder within the local store.
- Only one local store and associated DB are active at a time, as set in application settings.
- **Immutable Baseline Architecture**: The local store can be initialized from SD card, Squarp.net archive (https://data.squarp.net/RampleSamplesV1-2.zip), or a blank folder. Once initialized, this becomes an immutable baseline that is never modified - it preserves the exact initial state chosen during setup.
- **Local Store Initialization Sources**:
  - **SD Card Source**: Any folder can be chosen. It is valid if it contains at least one subfolder matching ^[A-Z].*?(?:[1-9]?\d)$; otherwise, a warning is shown and the user chooses another folder.
  - **Factory Samples**: Downloads and extracts official Squarp factory samples as the baseline.
  - **Empty Folder**: Creates minimal structure for users starting from scratch.
- **Reference-Only Sample Management**: User-added samples are referenced by `source_path` in the database but never copied to the local store. This prevents bloat and maintains the immutable baseline concept.
- **Sample Resolution During Sync**: When syncing to SD card, samples are located using their `source_path` references and copied/converted as needed. Missing source files are detected and reported before sync.
- All changes are persisted immediately to the DB for reliability.
- Sample format conversion (to 16 bit 44100 Hz, mono/stereo as needed) is handled when updating the SD card.

### Stereo Sample Handling Logic
- **Default to mono samples** global setting is enabled by default and persisted to local settings
- When a stereo sample is added to a kit:
  - If the sample is mono, it is linked to the voice and slot it was added to
  - If the sample is stereo and "default to mono" setting is ON: treat the stereo sample as mono
  - If the sample is stereo and "default to mono" setting is OFF:
    - Left channel is attributed to the voice and slot it was added to
    - Right channel is attributed to the same slot in the next voice (e.g., left: voice 1 slot 5; right: voice 2 slot 5)
    - If the same slot in the next voice already has a sample, prompt user to choose: convert to mono OR replace the existing sample in next voice
    - If stereo sample is added to voice 4 (no next voice available), auto-convert to mono with warning about mono status
- **Channel merging behavior**: When previewing a stereo sample that is to be treated as mono, the two channels are merged on playback using an averaging method
- **Conversion timing**: Sample format conversion only occurs on commit/sync to SD card, not during preview

### Multi-Sample Drop Handling
- Users can add multiple samples in one action, with samples incrementally added to the voice until the 12-slot limit is reached
- If bulk drop will exceed voice limits, prompt user before proceeding with the operation
- Slot limit enforcement prevents adding more than 12 samples per voice
- User receives clear feedback when slot limits are reached during bulk operations

### Voice Name Inference Logic
There is an extensible voice name scanning function that, for voices with no names, will look at the samples in that voice and infer the name of that voice. The specification for that is as follows:
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

### Kit Type Classification Logic
There is a kit type inference function that will look at the names of the voices in a kit and, based on predetermined rules, mark the kit as a Drum Kit, Loop Kit, Vocal Kit, FX Kit, or Synth Kit. The logic for this is as follows:
- If all voices are the same and that voice is 'vox', 'loop', or 'fx', use the corresponding kit type.
- If all voices are 'synth' or 'bass', use 'Synth/Bass Kit'.
- Otherwise, use 'Drum Kit'.

### Kit Browser Card Specifications
In the kit browser, kit item cards show useful kit metadata including:
- The kit ID (e.g., A0)
- The kit name (e.g., House Kit)
- The icon for the kit type
- The number of samples assigned for each of the 4 voices. Zero has a red color, 1-11 has a light green color, and 12 has a bold green color indicating 'full'.
- De-duped labels of the voice names (e.g., "Kick, Snare, Open HH, Closed HH", or "FX" if 4x FX voices)

### Preview and Audition Technical Considerations
- **Reference-Based Preview**: Sample preview uses `source_path` references for playback without copying files to local store.
- **Hardware-Accurate Playback**: Audio playback handles stereo-to-mono conversion to match Rample hardware behavior using channel averaging method.
- **Real-Time Format Handling**: When previewing a stereo sample configured to be treated as mono, the two channels are merged on playback.
- **Conversion Timing**: Sample format conversion (16 bit 44100 Hz, stereo-to-mono averaging) occurs only during commit/sync, not during preview.
- **Voice-Aware Sequencer**: XOX sequencer pattern data is stored in the Romper DB per kit, with sequencer playback using the first sample in each voice based on `voice_number` assignment.
- **External File Dependencies**: Preview system must handle missing source files gracefully, displaying appropriate warnings when files cannot be located.
- Future enhancements may include adjustable tempo, per-step sample selection, and additional SQLite persistence features.

## 12. Setup Wizard Flow

The setup wizard consists of four discrete actions, which are performed in order:

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

## 13. Centralized Message Display (Info, Warning, Error)

- The application displays all information, warning, and error messages in a central location at the top of the screen.
- The message display system supports multiple simultaneous messages, displaying them in a stack or queue (not just the latest message).
- Each message is styled according to its type (info, warning, error).
- Messages are individually dismissible by the user, and info/warning messages auto-dismiss after a timeout.
- The system ensures that no messages are lost if multiple are triggered in quick succession; all are visible until dismissed or expired.
- The message display logic and UI is fully unit tested, including scenarios with multiple messages.

## 14. Accessibility Requirements

- All UI elements must be accessible to users with disabilities, following WCAG 2.1 AA guidelines where possible.
- All interactive elements must be keyboard-navigable and have visible focus indicators.
- All UI elements must have sufficient color contrast in both light and dark mode.
- All icons and images must have appropriate alt text or aria-labels.
- The application must be fully usable in both light and dark mode, with accessibility maintained in both themes.

---
_Last updated: 2025-07-18_
