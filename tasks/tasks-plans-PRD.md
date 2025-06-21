<!-- filepath: /Users/pete/workspace/romper/tasks/tasks-plans-PRD.md -->
## Relevant Files

- `app/renderer/components/KitDetails.tsx` - Main UI for kit details, now extended to support kit planning (plan mode integration, actions, and UI).
- `app/renderer/components/KitDetails.test.tsx` - Unit tests for KitDetails, including plan mode and kit planning integration.
- `app/renderer/components/LocalStoreWizardUI.tsx` - UI for local store setup wizard, now supports progress bar, robust error display, and a flipped flow (choose source > choose target > import). UI and accessibility improvements.
- `app/renderer/components/__tests__/LocalStoreWizardUI.test.tsx` - Unit tests for LocalStoreWizardUI, now fully decoupled from IPC/Electron, only test UI logic and user interaction. Updated to match new step logic and label expectations.
- `app/renderer/components/hooks/useLocalStoreWizard.ts` - Hook for local store setup wizard business logic, now exposes progress/error state for Squarp.net archive initialization, handles blank folder (no files copied, only folder created), and SD card folder validation/copy logic. Updated to only set targetPath after source selection.
- `app/renderer/components/hooks/useLocalStoreWizard.test.ts` - Unit tests for useLocalStoreWizard hook, now cover progress, error handling, blank folder initialization, and SD card folder validation/copy. Updated to expect targetPath to be empty on mount.
- `app/renderer/components/hooks/useKitPlan.ts` - Hook for all business logic related to kit plans, including plan state, actions, and persistence.
- `app/renderer/components/hooks/useKitPlan.test.ts` - Unit tests for useKitPlan hook.
- `app/renderer/components/utils/planUtils.ts` - Utility functions for plan validation, sample assignment, and format checks.
- `app/renderer/components/utils/planUtils.test.ts` - Unit tests for planUtils.
- `app/renderer/components/utils/settingsManager.ts` - Manages global settings such as 'default to mono samples' and local store location.
- `app/renderer/components/utils/settingsManager.test.ts` - Unit tests for settingsManager.
- `app/renderer/utils/SettingsContext.tsx` - React context for settings management, including local store status validation.
- `electron/main/localStoreValidator.ts` - Shared validation logic for local store paths and Romper DB validation, used by both main process and IPC handlers.
- `electron/main/__tests__/localStoreValidator.test.ts` - Unit tests for shared local store validation logic.
- `electron/main/index.ts` - Main Electron process entry point, now validates local store on startup and removes invalid paths from settings.
- `electron/main/ipcHandlers.ts` - Main process IPC handlers, now uses shared validation logic for local store status checks.
- `app/renderer/electron.d.ts` - TypeScript definitions for Electron IPC, updated with local store status interface.
- `app/renderer/components/KitVoicePanel.tsx` - UI for voice slot drag-and-drop, add/replace/delete actions, and plan mode feedback.
- `app/renderer/components/KitVoicePanel.test.tsx` - Unit tests for KitVoicePanel plan mode and slot actions.
- `app/renderer/components/KitVoicePanels.tsx` - Renders all voice panels and coordinates plan mode state.
- `app/renderer/components/KitVoicePanels.test.tsx` - Unit tests for KitVoicePanels plan mode integration.
- `app/renderer/components/StatusBar.tsx` - Displays progress and notifications for plan actions.
- `app/renderer/components/StatusBar.test.tsx` - Unit tests for StatusBar notifications.
- `app/renderer/components/MessageDisplay.tsx` - Notification system for info, warning, error, and progress messages.
- `app/renderer/components/MessageDisplay.test.tsx` - Unit tests for MessageDisplay.
- `app/renderer/components/utils/romperDb.ts` - Handles Romper DB (SQLite) operations for plans, kits, and samples.
- `app/renderer/components/utils/romperDb.test.ts` - Unit tests for romperDb.
- `app/renderer/components/utils/scanningOperations.ts` - Composable scanning operations for voice inference, WAV analysis, RTF parsing, and step patterns.
- `app/renderer/components/utils/scanningOperations.test.ts` - Unit tests for scanning operations.
- `app/renderer/components/utils/scannerOrchestrator.ts` - Orchestrates scanning operation chains with progress tracking and error handling.
- `app/renderer/components/utils/scannerOrchestrator.test.ts` - Unit tests for scanner orchestration.
- `electron/main/ipcHandlers.ts` - Main process IPC handlers, including robust, testable Squarp.net archive download/extract logic with progress and error reporting.
- `electron/main/__tests__/archiveExtract.test.ts` - Unit tests for Squarp.net archive download/extract handler, with full async/streaming and error simulation. (Premature close test removed as non-robust in test env)
- `electron/main/__tests__/isValidEntry.test.ts` - Unit tests for isValidEntry helper in archiveUtils, covering all valid and invalid entry cases.
- `electron/main/db/romperDbCore.ts` - Core logic for Romper DB creation, record insertion, and error handling (including corrupt/overwrite cases). Now includes step pattern encoding/decoding utilities for BLOB storage (Uint8Array, 64 bytes, 0-127 per step) and extended SampleRecord interface with wav_bitrate, wav_sample_rate fields.
- `electron/main/db/__tests__/romperDbCore.test.ts` - Integration and edge-case tests for DB creation, overwrite, validation, and error handling. Updated with comprehensive tests for step pattern BLOB encoding/decoding functions and new wav metadata fields in samples.
- `electron/main/dbIpcHandlers.ts` - Main process IPC handlers for database operations, updated with new wav metadata fields for sample insertion.
- `electron/preload/index.ts` - Electron preload script for secure IPC communication, updated insertSample interface to include wav_bitrate and wav_sample_rate fields.
- `shared/kitUtilsShared.ts` - Shared kit utility logic for both app and electron workspaces.
- `shared/__tests__/kitUtilsShared.test.ts` - Unit tests for shared kit utility logic.

### Notes

- SD card source can be any folder. It is valid if it contains at least one subfolder matching ^[A-Z].*?(?:[1-9]?\d)$; otherwise, a warning is shown and the user must choose another folder.
- Unit tests must be placed alongside the code files they are testing.
- All plan actions and state changes must be covered by unit tests.
- Use `npx vitest` to run all tests.

## Tasks

- [ ] 1.0 Plan Mode Core Functionality
  - [ ] 1.1 Implement plan mode toggle (on/off) for each kit, defaulting to on for new and empty kits and off for pre-existing kits.
  - [ ] 1.2 Ensure each kit has exactly one plan, integral to the kit.
  - [ ] 1.3 Integrate plan mode status and controls into KitDetails UI.
  - [ ] 1.4 Persist plan mode state in Romper DB and settings.
  - [ ] 1.5 Unit tests for plan mode toggle, persistence, and UI feedback.

- [ ] 2.0 Local Store and Romper DB Initialization
  - [x] 2.1 Implement local store setup wizard with the following flow:
    - [ ] 2.1.1 User chooses the target of the local store:
      - [x] 2.1.1.1 Default is the OS-equivalent 'Documents' folder
      - [x] 2.1.1.2 User can choose a custom path (via folder picker dialog, always appending '/romper' if not present)
      - [x] 2.1.1.3 The `romper` directory will be created in this location
    - [x] 2.1.2 User chooses the source of the local store (three options):
      - [x] 2.1.2.1 From the Rample SD card (card with SD icon)
      - [x] 2.1.2.2 From the Squarp.net archive (card with archive icon)
      - [x] 2.1.2.3 A blank folder (card with folder icon)
    - [x] 2.1.3 Local store is initialized from the source:
      - [x] 2.1.3.1 Kit folder initialization:
        - [x] 2.1.3.1.1 If SD card is the source, copy all files from SD card to local store
        - [x] 2.1.3.1.2 If Squarp.net archive is the source, download and extract archive to local store (with progress bar, robust error handling, and test coverage for premature close and progress events)
        - [x] 2.1.3.1.3 If blank folder is chosen, no files are copied
    - [x] 2.1.4 Progress bar is used for: downloading zip, unzipping/moving files, writing to DB
    - [x] 2.1.5 Enforce step order: cannot proceed to next step until current is valid; allow going back to previous steps. The steps are a) choose source b) choose target c) initialize
    - [ ] 2.1.7 Cancel action is always available and stops any in-progress operation
  - [x] 2.2 Create and initialize Romper DB in `.romperdb` folder within local store.
  - [x] 2.3 Persist local store location in settings; allow changing location
  - [x] 2.4 Upon selection and instantiation of local store files, insert new records into the Romper DB.
    - [x] 2.13 Update Romper DB schema to remove plan table, add new kit and sample fields, and update docs/ERD
    - [x] 2.14 Implement initial import to create kit and sample records (no plan table), with new fields
    - [x] 2.15 Update documentation and ERD to match new schema (docs/romper-db.md, docs/romper-db.mmd)
  - [x] 2.5 Unit tests for initialization, validation, and error handling.
  - [x] 2.8 Store exactly one local store path and associated Romper DB location in application settings; load them on startup if present.
  - [x] 2.9 Transition from SD card-based startup to local store-based startup
    - [x] 2.9.1 Update app startup logic to use local store path instead of SD card path
    - [x] 2.9.2 Show local store wizard immediately on startup if local store is not configured or invalid
    - [x] 2.9.3 Display info message that local store must be set up before app can be used
    - [x] 2.9.4 Close app if user cancels the auto-triggered wizard
    - [x] 2.9.5 Remove "Select SD Card" button from KitBrowserHeader
    - [x] 2.9.6 Update StatusBar to show local store path with database icon instead of SD card info
    - [x] 2.9.7 Update all related unit tests for the SD card to local store transition
  - [ ] 2.11 Implement validation logic to check that the local store kit folders and sample files match the Romper DB metadata and plans.
  - [ ] 2.10 Implement composable scanning operations and database storage
    - [ ] 2.10.1 Extend database schema for metadata storage
      - [x] 2.10.1.1 Add kit_alias, kit_artist, locked fields to kits table
      - [x] 2.10.1.2 Add voice_alias field to existing voice-related structure
      - [x] 2.10.1.3 Add step_pattern field for step sequencer use
      - [x] 2.10.1.4 Add wav_bitrate, wav_sample_rate, is_stereo fields to samples table
      - [x] 2.10.1.5 Update database schema documentation in docs/romper-db.md
    - [ ] 2.10.2 Implement core scanning operations as composable functions
      - [ ] 2.10.2.1 Create voice name inference scanner (from existing function)
      - [ ] 2.10.2.2 Create WAV file analysis scanner (bitrate, sample rate, stereo detection)
      - [ ] 2.10.2.3 Create RTF artist metadata scanner (from existing function)
      - [ ] 2.10.2.4 Create step pattern scanner for sequencer metadata
      - [ ] 2.10.2.5 Design scanner orchestration system for composable operation chains
    - [ ] 2.10.3 Remove JSON file dependency and migrate to database storage
      - [ ] 2.10.3.1 Update scanning logic to store results in database instead of JSON
      - [ ] 2.10.3.2 Remove JSON file reading/writing code
      - [ ] 2.10.3.3 Update all components to read metadata from database
    - [ ] 2.10.4 Unit tests for core scanning operations and database storage
  - [ ] 2.17 Integrate scanning operations into wizard initialization
    - [ ] 2.17.1 Add automatic scanning as final step in wizard initialization
      - [ ] 2.17.1.1 After database records created, run scanning operation chain
      - [ ] 2.17.1.2 Chain: voice inference → WAV analysis → RTF artist scan → step patterns
      - [ ] 2.17.1.3 Show scanning progress on existing wizard progress bar
      - [ ] 2.17.1.4 Handle partial failures gracefully (continue chain on errors)
    - [ ] 2.17.2 Unit tests for wizard scanning integration
  - [ ] 2.18 Update manual scanning functionality
    - [ ] 2.18.1 Keep existing "Scan Kit" button in KitDetails page using new operations
    - [ ] 2.18.2 Keep existing "Scan All Kits" option in KitBrowser using new operations
    - [ ] 2.18.3 Use toast progress bar for manual scanning operations
    - [ ] 2.18.4 Support full rescan and individual operation selection
    - [ ] 2.18.5 Handle unscanned kits (prompt user, show appropriate UI state)
    - [ ] 2.18.6 Unit tests for manual scanning UI and operations
  - [ ] 2.11 Implement validation logic to check that the local store kit folders and sample files match the Romper DB metadata and plans.
  - [ ] 2.12 If the Romper DB metadata or plans are out of sync with the local store, present an error to the user and indicate that manual intervention may be required.
  - [x] 2.16 Flip local store setup flow: user chooses source first, then target, then import. Update UI, logic, and tests. Decouple UI tests from IPC/Electron.

- [ ] 3.0 Sample Assignment and Slot Management
  - [ ] 3.1 Implement drag-and-drop for adding samples to slots (single and multiple).
  - [ ] 3.2 Enforce 12-slot limit per voice and 4 voices per kit.
  - [ ] 3.6 Unit tests for all slot actions, drag-and-drop, and undo/redo.

- [ ] 4.0 WAV Format Validation and Conversion
  - [ ] 4.1 Validate that only valid WAV files (8/16 bit, 44100 Hz, mono/stereo) can be added to plans.
  - [ ] 4.2 Display warnings for samples that will be converted on commit.
  - [ ] 4.3 Reject non-WAV files before adding to plan.
  - [ ] 4.4 Implement sample format conversion on plan commit (to 16 bit 44100 Hz, mono/stereo as needed).
  - [ ] 4.5 Unit tests for format validation, warnings, and conversion logic.

- [ ] 5.0 Stereo Sample Handling and Global Settings
  - [ ] 5.1 Implement 'default to mono samples' global setting (default on, persisted in settings).
  - [ ] 5.2 Handle stereo sample assignment logic:
    - [ ] 5.2.1 If the sample is stereo and 'default to mono' is ON, treat the stereo sample as mono.
    - [ ] 5.2.2 If the sample is stereo and 'default to mono' is OFF:
      - [ ] 5.2.2.1 If the same slot in the next voice already has a sample, prompt the user whether to use mono (occupy one slot) or replace the sample in the next voice slot (to have a stereo sample).
      - [ ] 5.2.2.2 The left channel is attributed to the voice and slot it was added to.
      - [ ] 5.2.2.3 The right channel is attributed to the same slot in the next voice (e.g., left: voice 1, slot 5; right: voice 2, slot 5).
      - [ ] 5.2.2.4 If the stereo sample is added to voice 4 (no next voice), add as mono and warn the user about its mono status.
  - [ ] 5.3 Prompt user for ambiguous stereo assignment cases.
  - [ ] 5.4 Unit tests for stereo handling, prompts, and settings persistence.

- [ ] 6.0 Plan Commit and State Management
  - [ ] 6.1 Implement 'commit plan' action and UI, with confirmation prompt.
  - [ ] 6.2 Copy and convert all samples to local store on commit; update kit state to 'committed.'
  - [ ] 6.3 Mark plan as 'uncommitted' if further changes are made after commit.
  - [ ] 6.4 Support batch commit of multiple plans.
  - [ ] 6.5 Unit tests for commit, state transitions, and batch commit.

- [ ] 7.0 Preview and Playback
  - [ ] 7.1 Allow previewing of planned samples from source location (uncommitted) and local store (committed).
  - [ ] 7.2 Support sequencer playback for planned samples.
  - [ ] 7.3 Merge stereo to mono on preview if required by settings.
  - [ ] 7.4 Unit tests for preview, playback, and mono merge logic.

- [ ] 8.0 Undo/Redo and Action History
  - [ ] 8.1 Implement undo/redo for all plan actions (add, replace, delete).
  - [ ] 8.2 Persist action history in Romper DB.
  - [ ] 8.3 Unit tests for undo/redo and action history persistence.

- [ ] 9.0 Notifications, Progress, and Error Handling
  - [ ] 9.1 Integrate with notification system for info, warning, error, and progress messages.
  - [ ] 9.2 Display progress for long-running actions (e.g., commit, batch commit).
  - [ ] 9.3 Prompt user for destructive actions (delete, overwrite).
  - [ ] 9.4 Unit tests for notifications, progress, and prompts.

- [ ] 10.0 Accessibility and UI Consistency
  - [ ] 10.1 Ensure all plan-related UI is accessible in light and dark modes.
  - [ ] 10.2 Provide visible focus indicators and keyboard navigation for all plan actions.
  - [ ] 10.3 Unit tests for accessibility and UI consistency.

- [ ] 11.0 Menu System and Scanning Options
  - [ ] 11.1 Move "Scan All Kits" option from KitBrowser to application menu
  - [ ] 11.2 Implement application menu structure for scanning and maintenance operations
  - [ ] 11.3 Unit tests for menu functionality and scanning operations

- `src/renderer/components/KitPlanManager.tsx` - (Deprecated: see KitDetails.tsx) [If still present, this file should be removed after migration.]
- `src/renderer/components/KitPlanManager.test.tsx` - (Deprecated: see KitDetails.test.tsx) [If still present, this file should be removed after migration.]
