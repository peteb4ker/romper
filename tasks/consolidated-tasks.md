## Relevant Files

### UI Components
- `app/renderer/components/KitDetails.tsx` - Main UI for kit details, extended to support comprehensive kit editing with editable mode toggle, slot management, and action controls.
- `app/renderer/components/__tests__/KitDetails.test.tsx` - Unit tests for KitDetails including editable mode, slot actions, and UI interactions.
- `app/renderer/components/KitVoicePanel.tsx` - UI for voice slot drag-and-drop, add/replace/delete actions, editable mode feedback, and stereo assignment.
- `app/renderer/components/__tests__/KitVoicePanel.test.tsx` - Unit tests for KitVoicePanel editable mode, slot actions, and drag-and-drop.
- `app/renderer/components/KitVoicePanels.tsx` - Renders all voice panels, coordinates editable mode state, and handles multi-voice operations.
- `app/renderer/components/__tests__/KitVoicePanels.test.tsx` - Unit tests for KitVoicePanels editable mode integration and voice coordination.
- `app/renderer/components/StatusBar.tsx` - Displays progress, notifications, and status for editing actions and operations.
- `app/renderer/components/__tests__/StatusBar.test.tsx` - Unit tests for StatusBar edit-related notifications and progress display.
- `app/renderer/components/MessageDisplay.tsx` - Notification system for info, warning, error, and progress messages in editing operations.
- `app/renderer/components/__tests__/MessageDisplay.test.tsx` - Unit tests for MessageDisplay editing integration.
- `app/renderer/components/KitBrowser.tsx` - Main kit browser interface with navigation, filtering, and kit management.
- `app/renderer/components/__tests__/KitBrowser.test.tsx` - Unit tests for kit browser functionality and interaction.
- `app/renderer/components/KitStepSequencer.tsx` - 4-channel, 16-step XOX-style step sequencer for kit preview.
- `app/renderer/components/__tests__/KitStepSequencer.test.tsx` - Unit tests for step sequencer functionality and keyboard navigation.
- `app/renderer/components/SampleWaveform.tsx` - Waveform display component for sample visualization.
- `app/renderer/components/__tests__/SampleWaveform.test.tsx` - Unit tests for waveform display and audio analysis.

### Dialog Components
- `app/renderer/components/dialogs/SyncUpdateDialog.tsx` - UI dialog for SD card sync confirmation, change summary, and progress display.
- `app/renderer/components/dialogs/__tests__/SyncUpdateDialog.test.tsx` - Unit tests for sync dialog UI and user interactions.
- `app/renderer/components/dialogs/StereoAssignmentDialog.tsx` - UI dialog for handling stereo sample assignment conflicts and user choices.
- `app/renderer/components/dialogs/__tests__/StereoAssignmentDialog.test.tsx` - Unit tests for stereo assignment dialog and conflict resolution.
- `app/renderer/components/dialogs/NewKitDialog.tsx` - UI dialog for creating new kits with name validation and conflict resolution.
- `app/renderer/components/dialogs/__tests__/NewKitDialog.test.tsx` - Unit tests for new kit creation dialog.
- `app/renderer/components/LocalStoreWizardUI.tsx` - Local store setup wizard UI component with immutable baseline initialization.
- `app/renderer/components/__tests__/LocalStoreWizardUI.test.tsx` - Unit tests for local store wizard functionality.

### React Hooks
- `app/renderer/components/hooks/useKitEditor.ts` - Hook for all business logic related to kit editing, including editable state, slot management, undo/redo, and persistence.
- `app/renderer/components/hooks/__tests__/useKitEditor.test.ts` - Unit tests for useKitEditor hook covering all editing operations and state management.
- `app/renderer/components/hooks/useSyncUpdate.ts` - Hook for SD card sync operations, file copying, format conversion, and progress tracking.
- `app/renderer/components/hooks/__tests__/useSyncUpdate.test.ts` - Unit tests for SD card sync operations and progress handling.
- `app/renderer/components/hooks/useStereoHandling.ts` - Hook for stereo sample assignment logic, conflict detection, and settings integration.
- `app/renderer/components/hooks/__tests__/useStereoHandling.test.ts` - Unit tests for stereo handling logic and settings integration.
- `app/renderer/components/hooks/useFilePreview.ts` - Hook for sample preview functionality with reference-only playback, format handling, and playback management.
- `app/renderer/components/hooks/__tests__/useFilePreview.test.ts` - Unit tests for file preview and playback functionality.
- `app/renderer/components/hooks/useKitBrowser.ts` - Hook for kit browser business logic, navigation, filtering, and kit management.
- `app/renderer/components/hooks/__tests__/useKitBrowser.test.ts` - Unit tests for kit browser hook functionality.
- `app/renderer/components/hooks/useStepSequencer.ts` - Hook for step sequencer business logic, pattern management, and playback control.
- `app/renderer/components/hooks/__tests__/useStepSequencer.test.ts` - Unit tests for step sequencer hook functionality.

### Utility Functions
- `app/renderer/components/utils/kitEditUtils.ts` - Utility functions for kit editing validation, sample assignment, format checks, and stereo handling.
- `app/renderer/components/utils/__tests__/kitEditUtils.test.ts` - Unit tests for all kit editing utility functions.
- `app/renderer/components/utils/formatValidation.ts` - WAV format validation, conversion rules, and format compatibility checking.
- `app/renderer/components/utils/__tests__/formatValidation.test.ts` - Unit tests for format validation and conversion logic.
- `app/renderer/components/utils/settingsManager.ts` - Manages global settings including 'default to mono samples', confirmation preferences, and editing settings.
- `app/renderer/components/utils/__tests__/settingsManager.test.ts` - Unit tests for settings management and persistence.
- `app/renderer/components/utils/actionHistory.ts` - Action history management for undo/redo operations, including action recording and playback.
- `app/renderer/components/utils/__tests__/actionHistory.test.ts` - Unit tests for action history and undo/redo functionality.
- `app/renderer/components/utils/kitUtils.ts` - Kit management utilities, navigation helpers, and metadata processing.
- `app/renderer/components/utils/__tests__/kitUtils.test.ts` - Unit tests for kit utility functions.
- `app/renderer/components/utils/audioUtils.ts` - Audio processing utilities, format conversion, and waveform analysis with reference-only file handling.
- `app/renderer/components/utils/__tests__/audioUtils.test.ts` - Unit tests for audio processing functionality.

### Context and Settings
- `app/renderer/utils/SettingsContext.tsx` - React context for settings management, including editing-related settings and local store status.
- `app/renderer/utils/__tests__/SettingsContext.test.tsx` - Unit tests for settings context and editing-related state management.

### TypeScript Definitions
- `app/renderer/electron.d.ts` - TypeScript definitions for Electron IPC, extended with editing-related method signatures.

### Database Layer (Main Process) with ORM Implementation
- `electron/main/db/romperDbCore.ts` - Core database operations with Drizzle ORM implementation, connection management, and type-safe query execution.
- `electron/main/db/__tests__/romperDbCore.test.ts` - Unit tests for database operations including editing-related schema and operations.
- `electron/main/db/schema.ts` - Drizzle schema definitions for kits, samples, voices, and action history tables (fresh implementation).
- `electron/main/db/__tests__/schema.test.ts` - Unit tests for schema definitions and type safety.
- `electron/main/db/editActions.ts` - Database operations specific to editing actions, action history, and undo/redo support using Drizzle ORM.
- `electron/main/db/__tests__/editActions.test.ts` - Unit tests for editing-specific database operations.
- `electron/main/db/initialization.ts` - Fresh database initialization with Drizzle schema (no migrations needed).
- `electron/main/db/__tests__/initialization.test.ts` - Unit tests for fresh database initialization and schema creation.

### File Operations (Main Process)
- `electron/main/fileOperations.ts` - Secure file operations for SD card sync, sample copying with reference resolution, and format conversion.
- `electron/main/__tests__/fileOperations.test.ts` - Unit tests for file operations and security validation.
- `electron/main/formatConverter.ts` - Audio format conversion utilities for sample processing during SD card sync.
- `electron/main/__tests__/formatConverter.test.ts` - Unit tests for format conversion and audio processing.

### IPC Layer
- `electron/main/dbIpcHandlers.ts` - Main process IPC handlers for editing operations, extended with editing-specific endpoints.
- `electron/main/__tests__/dbIpcHandlers.test.ts` - Unit tests for IPC handlers and data validation.

### Shared Types and Utilities
- `shared/editTypesShared.ts` - Shared TypeScript types and interfaces for editing operations between main and renderer processes.
- `shared/__tests__/editTypesShared.test.ts` - Unit tests for shared editing types and validation.

### Notes

- **Immutable Baseline Architecture**: Local store serves as an immutable baseline that preserves the exact initial state chosen during setup (SD card contents, factory samples, or empty folder). This baseline is never modified after initialization.
- **Reference-Only Sample Management**: User-added samples are referenced by absolute path (`source_path`) without copying to local store. This prevents local store bloat and maintains clean separation between baseline content and user additions.
- **Editable Mode**: Editable mode is enabled by default for new/user kits (`editable = true`) and disabled for imported/factory kits (`editable = false`). Users can toggle editable mode manually.
- **Database Schema**: No separate plan table - editable state is tracked via the `editable` boolean field in the kits table. Uses `kit_name` as foreign key rather than `kit_id` for natural human-readable references.
- **Voice Tracking**: Explicit `voice_number` field (1-4) provides reliable voice identification rather than inferring from sample ordering.
- **ORM Implementation**: Fresh implementation with Drizzle ORM for improved type safety, modularity, and maintainability (no migration needed - scorched earth approach).
- **Type-Safe Queries**: All database operations are compile-time type-checked with full TypeScript integration.
- **Clean API Design**: Direct, simple function signatures that leverage TypeScript's native error handling.
- **Schema-First Approach**: Fresh database entities using Drizzle's schema definition for clear data modeling and automatic type generation.
- **Format Validation**: Only WAV files accepted. Must be 8/16 bit, 44100 Hz. Conversion happens when syncing to SD card, not during editing.
- **File Security**: All file operations must validate paths to prevent directory traversal attacks. Use proper file locking during operations.
- **Undo/Redo**: Complete action history with support for ADD_SAMPLE, REPLACE_SAMPLE, DELETE_SAMPLE, and TOGGLE_EDITABLE_MODE actions. History persisted in database.
- **UI/UX**: All operations must provide clear feedback, confirmation prompts for destructive actions, and progress indicators for long operations.
- **Sample Storage**: Samples remain in their original filesystem locations referenced by `source_path`. No copying to local store until SD card sync.
- **Local Store Role**: Local store serves as the immutable baseline from initial setup. User samples are NOT copied to local store - they remain in external locations until sync.
- **SD Card Sync**: During sync, samples are copied directly from source locations to SD card with format conversion as needed.
- **Testing Structure**: Unit tests must be placed in `__tests__` subdirectories alongside the code they test. All editing operations, error conditions, and edge cases must be tested.
- **File Organization**: Follow existing project structure with components, hooks, utils, and dialogs properly organized in their respective directories.
- **Accessibility**: All UI must work in light/dark modes with keyboard navigation and screen reader support.
- Use `npx vitest` to run all tests. Use `npx tsc --noEmit` to validate TypeScript before marking tasks complete.

## Tasks

- [x] 1.0 UI/UX Structure and Navigation (Complete)
  - [x] 1.1 Main kit browser and kit detail page implementation
  - [x] 1.2 Action buttons at top of page
  - [x] 1.3 Status bar with progress indicators
  - [x] 1.4 Central message display system
  - [x] 1.5 A-Z bank navigation with hotkeys
  - [x] 1.6 Keyboard navigation for sample slots
  - [x] 1.7 Light/dark mode toggle
  - [x] 1.8 Link to Squarp Rample manual
  - [x] 1.9 Performance optimizations (memoization)
  - [x] 1.10 Voice panel layout and design
  - [x] 1.11 Sample slot organization and display

- [x] 2.0 Preview and Audio Features (Complete)
  - [x] 2.1 Individual sample preview functionality
  - [x] 2.2 XOX step sequencer implementation (4x16 grid, stable)
    - [ ] 2.2.1 Move play control and BPM label to left of grid for better layout
    - [ ] 2.2.2 Update sequencer to work with new reference-only architecture
    - [ ] 2.2.3 Integrate with voice_number field for accurate sample mapping
  - [x] 2.3 Waveform display for samples
  - [x] 2.4 Keyboard navigation for previewing
  - [x] 2.5 Sequencer show/hide functionality with 'S' key
  - [x] 2.6 Navigation mode switching between sample and sequencer

- [x] 3.0 Local Store and Database Initialization (Complete)
  - [x] 3.1 Immutable baseline local store setup wizard
  - [x] 3.2 Local store source selection (SD card, factory samples, blank)
  - [x] 3.3 Database initialization and schema creation
  - [x] 3.4 Transition from SD card to local store as primary data source
  - [x] 3.5 Kit browser integration with database scanning
    - [ ] 3.5.1 Replace current SQL implementation with Drizzle ORM
    - [ ] 3.5.2 Implement fresh ORM schema (no migration needed)
    - [ ] 3.5.3 Update IPC handlers to use ORM-based functions
    - [ ] 3.5.4 Add comprehensive TypeScript error handling

- [x] 4.0 Menu System and Scanning Operations (Complete)
  - [x] 4.1 "Scan All Kits" moved to application menu
  - [x] 4.2 Menu structure for maintenance operations
  - [x] 4.3 Progress indicators for scanning operations
  - [x] 4.4 Error handling for scan operations

- [ ] 5.0 Kit Editing and Slot Management (New Architecture)
  - [ ] 5.1 Implement editable mode system:
    - [ ] 5.1.1 Default ON for user kits, OFF for factory/imported kits
    - [ ] 5.1.2 Manual toggle control with persistence to database
    - [ ] 5.1.3 Visual indicators and UI feedback for mode changes
    - [ ] 5.1.4 Disable editing actions when mode is off
  - [ ] 5.2 Implement reference-only sample management:
    - [ ] 5.2.1 Store external samples via source_path field (no copying to local store)
    - [ ] 5.2.2 Drag-and-drop sample assignment to voice slots
    - [ ] 5.2.3 Add/Replace/Delete sample operations with source_path tracking
    - [ ] 5.2.4 12-slot limit per voice using explicit voice_number field (1-4)
    - [ ] 5.2.5 Validate source file existence during operations
  - [ ] 5.3 Implement modification state tracking:
    - [ ] 5.3.1 Mark kits as 'modified' when changes made after last sync
    - [ ] 5.3.2 Display modification status in UI
    - [ ] 5.3.3 Clear modified flag after successful SD card sync

- [ ] 6.0 Format Validation and Conversion
  - [ ] 6.1 Implement WAV format validation for reference files:
    - [ ] 6.1.1 Check file extension (.wav only)
    - [ ] 6.1.2 Validate bit depth (8 or 16 bit only)
    - [ ] 6.1.3 Validate sample rate (44100 Hz only)
    - [ ] 6.1.4 Validate mono/stereo channel configuration
    - [ ] 6.1.5 Handle validation for external source_path files
  - [ ] 6.2 Implement format warning system:
    - [ ] 6.2.1 Show warnings for non-compliant formats during assignment
    - [ ] 6.2.2 List format issues in kit UI before SD card sync
    - [ ] 6.2.3 Allow proceeding with warnings (conversion during sync)
  - [ ] 6.3 Implement format conversion during SD card sync:
    - [ ] 6.3.1 Convert from source_path to SD card with format conversion
    - [ ] 6.3.2 Handle bit depth, sample rate, and stereo-to-mono conversion
    - [ ] 6.3.3 Preserve original files (no destructive editing)

- [ ] 7.0 Stereo Sample Handling
  - [ ] 7.1 Implement 'default to mono samples' global setting:
    - [ ] 7.1.1 Create setting in application preferences (default: true)
    - [ ] 7.1.2 Apply setting to new sample assignments
    - [ ] 7.1.3 Allow per-sample override
  - [ ] 7.2 Implement stereo assignment logic with voice_number:
    - [ ] 7.2.1 Auto-assign as mono when global setting ON
    - [ ] 7.2.2 Dual-slot assignment: left→voice N, right→voice N+1 when OFF
    - [ ] 7.2.3 Handle conflicts when target voice has existing samples
    - [ ] 7.2.4 Handle edge case: stereo to voice 4 (no voice 5 available)
  - [ ] 7.3 Implement stereo conflict resolution:
    - [ ] 7.3.1 Show dialog with options: force mono, replace existing, cancel
    - [ ] 7.3.2 Apply choice and update kit with proper voice_number tracking
  - [ ] 7.4 Implement stereo preview with reference-only playback:
    - [ ] 7.4.1 Preview stereo as mono when setting ON
    - [ ] 7.4.2 Preview left/right channels separately when OFF

- [ ] 8.0 SD Card Sync Operations
  - [ ] 8.1 Implement SD card sync workflow:
    - [ ] 8.1.1 Create sync confirmation dialog with change summary
    - [ ] 8.1.2 Display files to be copied/converted from source_path
    - [ ] 8.1.3 Show estimated time and disk space requirements
    - [ ] 8.1.4 Validate all source_path files exist before sync
  - [ ] 8.2 Implement sync file operations:
    - [ ] 8.2.1 Copy referenced samples from source_path to SD card
    - [ ] 8.2.2 Convert samples to required format during copy
    - [ ] 8.2.3 Handle stereo-to-mono based on settings
    - [ ] 8.2.4 Update database to reflect successful sync
  - [ ] 8.3 Implement sync state management:
    - [ ] 8.3.1 Mark kit as 'synced' after successful operation
    - [ ] 8.3.2 Clear 'modified changes' flag
    - [ ] 8.3.3 Handle sync rollback on failure
  - [ ] 8.4 Implement batch sync for multiple kits
  - [ ] 8.5 Implement detailed progress and error handling

- [ ] 9.0 Undo/Redo System
  - [ ] 9.1 Implement action history with ORM:
    - [ ] 9.1.1 Create edit_actions table with Drizzle schema
    - [ ] 9.1.2 Define action types: ADD_SAMPLE, REPLACE_SAMPLE, DELETE_SAMPLE
    - [ ] 9.1.3 Store action metadata as JSON with source_path references
  - [ ] 9.2 Implement action recording with reference tracking:
    - [ ] 9.2.1 Record all modifications with source_path metadata
    - [ ] 9.2.2 Generate sequence numbers for action ordering
    - [ ] 9.2.3 Handle batch actions (multiple samples)
  - [ ] 9.3 Implement undo functionality:
    - [ ] 9.3.1 Reverse most recent action including source_path restoration
    - [ ] 9.3.2 Update kit state and UI to reflect undo
    - [ ] 9.3.3 Handle complex actions (stereo pairs, voice_number adjustments)
  - [ ] 9.4 Implement redo functionality and history management:
    - [ ] 9.4.1 Re-apply undone actions with source_path handling
    - [ ] 9.4.2 Maintain redo stack and clear on new actions
    - [ ] 9.4.3 Limit history depth and auto-cleanup old records
    - [ ] 9.4.4 Clear history on SD card sync (fresh start)

- [ ] 10.0 Enhanced User Interface
  - [ ] 10.1 Implement editable mode UI indicators:
    - [ ] 10.1.1 Visual indicator of editable mode status
    - [ ] 10.1.2 Kit modification status display
    - [ ] 10.1.3 Undo/redo availability indicators
  - [ ] 10.2 Implement progress indicators for operations:
    - [ ] 10.2.1 Progress bars for sync, batch operations, reference resolution
    - [ ] 10.2.2 Detailed progress text with file information
    - [ ] 10.2.3 Cancellation support for long operations
  - [ ] 10.3 Implement comprehensive confirmation prompts:
    - [ ] 10.3.1 Destructive actions (replace, delete samples)
    - [ ] 10.3.2 SD card sync with change summary
    - [ ] 10.3.3 Batch operations affecting multiple kits
  - [ ] 10.4 Implement error handling with recovery suggestions
  - [ ] 10.5 Enhance keyboard shortcuts and accessibility

- [ ] 11.0 Kit Browser Enhancements
  - [ ] 11.1 Implement editable status indicators in browser:
    - [ ] 11.1.1 Show editable mode status for each kit
    - [ ] 11.1.2 Indicate kits with unsaved changes
    - [ ] 11.1.3 Visual distinction between factory and user kits
  - [ ] 11.2 Implement filtering and sorting:
    - [ ] 11.2.1 Filter by editable mode status
    - [ ] 11.2.2 Filter by modification status
    - [ ] 11.2.3 Sort by modification date
  - [ ] 11.3 Implement bulk operations:
    - [ ] 11.3.1 Bulk enable/disable editable mode
    - [ ] 11.3.2 Batch SD card sync for selected kits
    - [ ] 11.3.3 Context menu with editing actions

- [ ] 12.0 Settings and Configuration
  - [ ] 12.1 Implement global editing settings:
    - [ ] 12.1.1 'default to mono samples' setting
    - [ ] 12.1.2 'confirm destructive actions' setting
    - [ ] 12.1.3 'auto-sync on close' setting
    - [ ] 12.1.4 'max undo history' setting
  - [ ] 12.2 Implement settings persistence and validation
  - [ ] 12.3 Create settings UI in preferences panel

- [ ] 13.0 Database Layer ORM Migration (Replace Current Implementation)
  - [ ] 13.1 Install and configure Drizzle ORM:
    - [ ] 13.1.1 Install Drizzle ORM with better-sqlite3 driver
    - [ ] 13.1.2 Define schema-first table definitions matching current architecture
    - [ ] 13.1.3 Create type-safe query interfaces
    - [ ] 13.1.4 Implement connection management
  - [ ] 13.2 Replace existing database operations:
    - [ ] 13.2.1 Replace raw SQL in romperDbCore.ts with Drizzle equivalents
    - [ ] 13.2.2 Update IPC handlers to use ORM functions
    - [ ] 13.2.3 Add comprehensive TypeScript error handling
  - [ ] 13.3 Enhance database schema:
    - [ ] 13.3.1 Add source_path field to samples table
    - [ ] 13.3.2 Ensure voice_number field validation (1-4)
    - [ ] 13.3.3 Use kit_name as foreign key for natural references
  - [ ] 13.4 Fresh database initialization (no migration system needed):
    - [ ] 13.4.1 Create initialization with complete Drizzle schema
    - [ ] 13.4.2 Remove old initialization code
    - [ ] 13.4.3 Update setup wizard for ORM-based database

- [ ] 14.0 Integration Testing and Performance
  - [ ] 14.1 Comprehensive integration tests:
    - [ ] 14.1.1 Complete kit creation workflow with reference-only architecture
    - [ ] 14.1.2 Kit modification workflow with editable mode
    - [ ] 14.1.3 Undo/redo across multiple actions with ORM
    - [ ] 14.1.4 Stereo handling with voice_number tracking
  - [ ] 14.2 Error recovery testing:
    - [ ] 14.2.1 Database corruption recovery with ORM
    - [ ] 14.2.2 Missing source_path file handling
    - [ ] 14.2.3 Failed SD card operation recovery
  - [ ] 14.3 Performance testing:
    - [ ] 14.3.1 Large kit collections (2600+ kits) with Drizzle
    - [ ] 14.3.2 Database query performance with edit history
    - [ ] 14.3.3 UI responsiveness with reference file handling
  - [ ] 14.4 Accessibility testing for all new features

---
_Last updated: 2025-07-17_
