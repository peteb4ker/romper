## Relevant Files

- `src/renderer/components/KitDetails.tsx` - Main UI for kit details, now extended to support kit planning (plan mode integration, actions, and UI).
- `src/renderer/components/KitDetails.test.tsx` - Unit tests for KitDetails, including plan mode and kit planning integration.
- `src/renderer/components/hooks/useKitPlan.ts` - Hook for all business logic related to kit plans, including plan state, actions, and persistence.
- `src/renderer/components/hooks/useKitPlan.test.ts` - Unit tests for useKitPlan hook.
- `src/renderer/components/utils/planUtils.ts` - Utility functions for plan validation, sample assignment, and format checks.
- `src/renderer/components/utils/planUtils.test.ts` - Unit tests for planUtils.
- `src/renderer/components/utils/settingsManager.ts` - Manages global settings such as 'default to mono samples' and local store location.
- `src/renderer/components/utils/settingsManager.test.ts` - Unit tests for settingsManager.
- `src/renderer/components/KitVoicePanel.tsx` - UI for voice slot drag-and-drop, add/replace/delete actions, and plan mode feedback.
- `src/renderer/components/KitVoicePanel.test.tsx` - Unit tests for KitVoicePanel plan mode and slot actions.
- `src/renderer/components/KitVoicePanels.tsx` - Renders all voice panels and coordinates plan mode state.
- `src/renderer/components/KitVoicePanels.test.tsx` - Unit tests for KitVoicePanels plan mode integration.
- `src/renderer/components/StatusBar.tsx` - Displays progress and notifications for plan actions.
- `src/renderer/components/StatusBar.test.tsx` - Unit tests for StatusBar notifications.
- `src/renderer/components/MessageDisplay.tsx` - Notification system for info, warning, error, and progress messages.
- `src/renderer/components/MessageDisplay.test.tsx` - Unit tests for MessageDisplay.
- `src/renderer/components/utils/kitUtils.ts` - Kit and sample validation helpers.
- `src/renderer/components/utils/kitUtils.test.ts` - Unit tests for kitUtils.
- `src/renderer/components/utils/romperDb.ts` - Handles Romper DB (SQLite) operations for plans, kits, and samples.
- `src/renderer/components/utils/romperDb.test.ts` - Unit tests for romperDb.

### Notes

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
  - [ ] 2.1 Implement local store setup wizard with the following flow:
    - [ ] 2.1.1 User chooses the target of the local store:
      - [ ] 2.1.1.1 Default is the OS-equivalent 'Documents' folder
      - [ ] 2.1.1.2 User can choose a custom path
      - [ ] 2.1.1.3 The `romper` directory will be created in this location
    - [ ] 2.1.2 User chooses the source of the local store (three options):
      - [ ] 2.1.2.1 From the Rample SD card
        - [ ] 2.1.2.1.1 User must navigate to the mounted SD card. If not mounted, prompt user to mount it before proceeding.
      - [ ] 2.1.2.2 From the Squarp.net archive (https://data.squarp.net/RampleSamplesV1-2.zip)
      - [ ] 2.1.2.3 A blank folder
    - [ ] 2.1.3 Local store is initialized from the source:
      - [ ] 2.1.3.1 Kit folder initialization:
        - [ ] 2.1.3.1.1 If SD card is the source, copy all files from SD card to local store
        - [ ] 2.1.3.1.2 If Squarp.net archive is the source, download and extract archive to local store
        - [ ] 2.1.3.1.3 If blank folder is chosen, no files are copied
  - [ ] 2.2 Create and initialize Romper DB in `.romperdb` folder within local store.
  - [ ] 2.3 Persist local store location in settings; allow changing location.
  - [ ] 2.4 Validate local store and DB sync; display errors if out of sync.
  - [ ] 2.5 Unit tests for initialization, validation, and error handling.
  - [ ] 2.7 If the local store or Romper DB does not exist, automatically create them as needed.
  - [ ] 2.8 Store exactly one local store path and associated Romper DB location in application settings; load them on startup if present.
  - [ ] 2.9 Allow the user to create a new local store at a new location via a settings menu action, and change to that local store
  - [ ] 2.11 Implement validation logic to check that the local store kit folders and sample files match the Romper DB metadata and plans.
  - [ ] 2.12 If the Romper DB metadata or plans are out of sync with the local store, present an error to the user and indicate that manual intervention may be required.

- [ ] 3.0 Sample Assignment and Slot Management
  - [ ] 3.1 Implement drag-and-drop for adding samples to slots (single and multiple).
  - [ ] 3.2 Enforce 12-slot limit per voice and 4 voices per kit.
  - [ ] 3.3 Display 'Add sample' or 'Replace sample' UI feedback for slots.
  - [ ] 3.4 Support deleting and undoing deletion of samples in slots.
  - [ ] 3.5 Persist all plan actions (add, replace, delete) immediately to Romper DB.
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

- `src/renderer/components/KitPlanManager.tsx` - (Deprecated: see KitDetails.tsx) [If still present, this file should be removed after migration.]
- `src/renderer/components/KitPlanManager.test.tsx` - (Deprecated: see KitDetails.test.tsx) [If still present, this file should be removed after migration.]
