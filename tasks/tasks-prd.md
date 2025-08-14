---
_Last updated: 2025-07-26_
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
- `electron/main/db/romperDbCoreORM.ts` - Drizzle ORM implementation with simplified withDrizzle pattern (COMPLETED)
- `electron/main/db/__tests__/romperDbCoreORM.integration.test.ts` - Comprehensive ORM integration tests (17 tests) (COMPLETED)
- `electron/main/db/__tests__/romperDbCoreORM.test.ts` - ORM unit tests (18 tests) (COMPLETED)
- `electron/main/dbIpcHandlers.ts` - IPC handlers updated to use ORM functions seamlessly (COMPLETED)
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
- Use `npx vitest` to run unit tests. Use `node electron/run-vitest-in-electron.cjs` to run integration tests (required for better-sqlite3 compatibility). Use `npx tsc --noEmit` to validate TypeScript before marking tasks complete.

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
    - [x] 2.2.1 Move play control and BPM label to left of grid for better layout
    - [x] 2.2.2 Update sequencer to work with new reference-only architecture
    - [x] 2.2.3 Integrate with voice_number field for accurate sample mapping
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
    - [x] 3.5.1 Replace current SQL implementation with Drizzle ORM
    - [x] 3.5.2 Implement fresh ORM schema (no migration needed)
    - [x] 3.5.3 Update IPC handlers to use ORM-based functions
    - [x] 3.5.4 Add comprehensive TypeScript error handling

- [x] 4.0 Menu System and Scanning Operations (Complete)
  - [x] 4.1 "Scan All Kits" moved to application menu
  - [x] 4.2 Menu structure for maintenance operations
  - [x] 4.3 Progress indicators for scanning operations
  - [x] 4.4 Error handling for scan operations

- [x] 4.5 Bank-Based Scanning Architecture (New)
  - [x] 4.5.1 Add banks table to database schema (A-Z with artist metadata)
  - [x] 4.5.2 Initialize 26 banks during database creation
  - [x] 4.5.3 Implement bank scanning separate from kit scanning
    - [x] 4.5.3.1 Scan local store root for RTF files matching "A - Artist Name.rtf" pattern
    - [x] 4.5.3.2 Update banks table with artist metadata from RTF filenames
    - [x] 4.5.3.3 Add IPC handler for bank scanning operations
  - [x] 4.5.4 Update kit scanning to exclude RTF operations
    - [x] 4.5.4.1 Remove RTF scanning from individual kit scan operations
    - [x] 4.5.4.2 Update kit metadata to reference bank.artist instead of kit.artist
    - [x] 4.5.4.3 Keep kit.artist field for backwards compatibility during transition
  - [x] 4.5.5 Update UI to use bank-based artist display
    - [x] 4.5.5.1 Kit browser shows artist from bank relationship
    - [x] 4.5.5.2 Kit details page shows artist from bank (not needed - KitDetails won't show artist)
    - [x] 4.5.5.3 Remove old RTF scanning UI references

- [x] 5.0 Kit Editing and Slot Management (New Architecture)
  - [x] 5.1 Implement editable mode system:
    - [x] 5.1.1 Default ON for user kits, OFF for factory/imported kits
    - [x] 5.1.2 Manual toggle control with persistence to database
    - [x] 5.1.3 Visual indicators and UI feedback for mode changes
    - [x] 5.1.4 Disable editing actions when mode is off
  - [x] 5.2 Implement reference-only sample management:
    - [x] 5.2.1 Store external samples via source_path field (no copying to local store)
    - [x] 5.2.2 Drag-and-drop sample assignment to voice slots
    - [x] 5.2.3 Add/Replace/Delete sample operations with source_path tracking
    - [x] 5.2.4 12-slot limit per voice using explicit voice_number field (1-4)
    - [x] 5.2.5 Validate source file existence during operations
  - [x] 5.3 Implement modification state tracking:
    - [x] 5.3.1 Mark kits as 'modified' when changes made after last sync
    - [x] 5.3.2 Display modification status in UI

- [x] 6.0 Format Validation and Conversion
  - [x] 6.1 Implement WAV format validation for reference files:
    - [x] 6.1.1 Check file extension (.wav only)
    - [x] 6.1.2 Validate bit depth (8 or 16 bit only)
    - [x] 6.1.3 Validate sample rate (44100 Hz only)
    - [x] 6.1.4 Validate mono/stereo channel configuration
    - [x] 6.1.5 Handle validation for external source_path files
  - [x] 6.2 Implement format warning system:
    - [x] 6.2.1 Show warnings for non-compliant formats during assignment
    - [x] 6.2.2 List format issues in kit UI before SD card sync
    - [x] 6.2.3 Allow proceeding with warnings (conversion during sync)

- [x] 7.0 Stereo Sample Handling
  - [x] 7.1 Implement 'default to mono samples' global setting:
    - [x] 7.1.1 Create setting in application preferences (default: true)
    - [x] 7.1.2 Apply setting to new sample assignments
    - [x] 7.1.3 Allow per-sample override
  - [x] 7.2 Implement stereo assignment logic with voice_number:
    - [x] 7.2.1 Auto-assign as mono when global setting ON
    - [x] 7.2.2 Stereo assignment: sample stored in voice N, voice N+1 consumed (UI shows in both)
    - [x] 7.2.3 Handle conflicts when target voice has existing samples
    - [x] 7.2.4 Handle edge case: stereo to voice 4 (no voice 5 available)
  - [x] 7.3 Implement stereo conflict resolution:
    - [x] 7.3.1 Show toast notifications for conflicts (dialog implementation deferred)
    - [x] 7.3.2 Apply choice and update kit with proper voice_number tracking
  - [x] 7.4 Implement stereo sample tracking and UI display:
    - [x] 7.4.1 Track mono/stereo assignment in database with is_stereo field
    - [x] 7.4.2 Display stereo samples in both voice slots in UI
    - [ ] 7.4.3 Preview implementation deferred - requires metadata refactor

- [x] 8.0 SD Card Sync Operations (Complete)
  - [x] 8.1 Implement SD card sync workflow:
    - [x] 8.1.1 Create sync confirmation dialog with change summary
    - [x] 8.1.2 Display files to be copied/converted from source_path
    - [x] 8.1.3 Show estimated time and disk space requirements
    - [x] 8.1.4 Validate all source_path files exist before sync
  - [x] 8.2 Implement sync file operations:
    - [x] 8.2.1 Copy referenced samples from source_path to SD card
    - [x] 8.2.2 Convert samples to required format during copy (moved from 6.3):
      - [x] 8.2.2.1 Convert from source_path to SD card with format conversion
      - [x] 8.2.2.2 Handle bit depth, sample rate, and stereo-to-mono conversion
      - [x] 8.2.2.3 Preserve original files (no destructive editing)
  - [x] 8.3 Implement sync state management:
    - [x] 8.3.1 Mark kit as 'synced' after successful operation
    - [x] 8.3.2 Clear 'modified changes' flag (formerly 5.3.3)
    - [x] 8.3.3 Handle sync rollback on failure
  - [x] 8.4 Implement detailed progress and error handling

- [x] 9.0 Undo/Redo System (Memory-Based Implementation Complete)
  - [x] 9.1 Implement memory-based undo/redo system:
    - [x] 9.1.1 Create useUndoRedo hook with in-memory action stacks
    - [x] 9.1.2 Define action types: ADD_SAMPLE, REPLACE_SAMPLE, DELETE_SAMPLE, MOVE_SAMPLE, COMPACT_SLOTS
    - [x] 9.1.3 Implement typed action schemas with complete state tracking
  - [x] 9.2 Implement action recording and playback:
    - [x] 9.2.1 Record all sample operations with full metadata
    - [x] 9.2.2 Integrate with sample management hooks for automatic recording
    - [x] 9.2.3 Handle complex operations affecting multiple samples
  - [x] 9.3 Implement undo/redo operations:
    - [x] 9.3.1 Complete reversal logic for all action types
    - [x] 9.3.2 Event-driven UI refresh system for state updates
    - [x] 9.3.3 Application menu integration with custom handlers
  - [x] 9.4 Implement keyboard shortcuts and UX:
    - [x] 9.4.1 Cmd+Z/Ctrl+Z for undo, Cmd+Shift+Z/Ctrl+Y for redo
    - [x] 9.4.2 Visual feedback with action descriptions
    - [x] 9.4.3 Proper state management and error handling

- [x] 22.0 Sample Contiguity and Drag-Drop Move System (Complete)
  - [x] 22.1 Implement automatic contiguity maintenance:
    - [x] 22.1.1 Auto-reindex slots after sample deletion (hard requirement)
    - [x] 22.1.2 Shift samples up to fill gaps automatically
    - [x] 22.1.3 Maintain contiguous numbering from slot 1 upwards
  - [x] 22.2 Implement drag-drop move operations:
    - [x] 22.2.1 Visual drop zones for insert-between vs overwrite-on operations
    - [x] 22.2.2 Cross-voice sample movement within same kit
    - [x] 22.2.3 Drag feedback with ghost elements and drop indicators
  - [x] 22.3 Implement stereo conflict handling for moves:
    - [x] 22.3.1 Detect stereo sample conflicts in destination voice
    - [x] 22.3.2 Throw clear error when destination+1 slot occupied by stereo
    - [x] 22.3.3 Prevent invalid moves that would break stereo pairs
  - [x] 22.4 Implement complex undo support for moves:
    - [x] 22.4.1 Full state restoration for multi-sample move operations
    - [x] 22.4.2 MOVE_SAMPLE action type with complete before/after state
    - [x] 22.4.3 REINDEX_SAMPLES action type for deletion-triggered reindexing
    - [x] 22.4.4 Restore all affected samples to previous positions on undo
  - [x] 22.5 Database operations for contiguity:
    - [x] 22.5.1 Batch slot updates for reindexing operations
    - [x] 22.5.2 Transaction-based multi-sample moves
    - [x] 22.5.3 Efficient slot reordering with proper constraints
  - [x] 22.6 UI implementation:
    - [x] 22.6.1 Drag-drop event handling with visual feedback
    - [x] 22.6.2 Drop zone indicators for insert vs overwrite
    - [x] 22.6.3 Animation for smooth slot transitions (100ms)
    - [x] 22.6.4 Error states for invalid move attempts

- [x] 12.0 Settings and Configuration (Complete)
  - [x] 12.1 Implement global editing settings:
    - [x] 12.1.1 'default to mono samples' setting
    - [x] 12.1.2 'confirm destructive actions' setting
    - [x] 12.1.3 'dark mode / light mode / system' setting
    - [x] 12.1.4 'local store path' setting
    - [x] 12.1.5 'read only info' setting: local store, SD card path
  - [x] 12.2 Implement settings persistence and validation
  - [x] 12.3 Create settings UI in preferences panel

- [x] 13.0 Database Layer ORM Migration (Replace Current Implementation) (Complete)
  - [x] 13.1 Install and configure Drizzle ORM:
    - [x] 13.1.1 Install Drizzle ORM with better-sqlite3 driver
    - [x] 13.1.2 Define schema-first table definitions matching current architecture
    - [x] 13.1.3 Create type-safe query interfaces
    - [x] 13.1.4 Implement connection management
  - [x] 13.2 Replace existing database operations:
    - [x] 13.2.1 Replace raw SQL in romperDbCore.ts with Drizzle equivalents
    - [x] 13.2.2 Update IPC handlers to use ORM functions
    - [x] 13.2.3 Add comprehensive TypeScript error handling
  - [x] 13.3 Enhance database schema:
    - [x] 13.3.1 Add source_path field to samples table
    - [x] 13.3.2 Ensure voice_number field validation (1-4)
    - [x] 13.3.3 Use kit_name as foreign key for natural references
  - [x] 13.4 Fresh database initialization (no migration system needed):
    - [x] 13.4.1 Create initialization with complete Drizzle schema
    - [x] 13.4.2 Remove old initialization code
    - [x] 13.4.3 Update setup wizard for ORM-based database

## 14.0 Fast-Track Release: Final Tasks (V1.0.0 Release Tomorrow)

**Current Status: ✅ READY FOR RELEASE**
- Build: ✅ Successful (all platforms compile)
- Unit Tests: ✅ Passing (175 files, 2187 tests, 80.7% coverage)
- Integration Tests: ✅ Passing (8 files, 115 tests)
- Core Features: ✅ Complete (kit editing, undo/redo, sync, UI/UX)
- Navigation: ✅ Working 100% (verified)

### Final Release Tasks

- [ ] 14.1 **Bulletproof SD Card Sync**: Test and harden sync workflow
- [ ] 14.2 **UI Cleanup Tasks**: Polish any remaining UI issues
- [ ] 14.3 **Release Tag Creation**: Create v1.0.0 tag to trigger automated build
- [ ] 14.4 **Build Verification**: Monitor cross-platform release builds

## 24.0 RELEASE CRITICAL: Bulletproof SD Card Sync

- [ ] 24.1 Debug and fix SD card sync functionality:
  - [ ] 24.1.1 Test sync workflow end-to-end to identify failure points
  - [ ] 24.1.2 Debug syncService.ts methods and error handling
  - [ ] 24.1.3 Test IPC communication for sync operations
  - [ ] 24.1.4 Verify file operations and conversion during sync
  - [ ] 24.1.5 Fix any identified issues preventing successful sync
- [ ] 24.2 Comprehensive testing for SD card sync:
  - [ ] 24.2.1 Unit tests: Test syncService individual methods (validation, copying, conversion)
  - [ ] 24.2.2 Integration tests: Test IPC handlers for sync operations and progress tracking
  - [ ] 24.2.3 E2E tests: Complete sync workflow from UI selection to SD card verification

## 25.0 RELEASE CRITICAL: 1.0.0 Release Preparation

- [ ] 25.1 Pre-Release Testing & QA:
  - [ ] 25.1.1 End-to-End Testing: Complete user journey testing (setup → kit creation → sync)
  - [ ] 25.1.2 Regression Testing: Ensure all existing functionality still works
  - [ ] 25.1.3 Performance Testing: Test with realistic data sets (100+ kits)
  - [ ] 25.1.4 Cross-Platform Testing: Verify functionality on Windows, macOS, Linux
  - [ ] 25.1.5 Error Handling: Test edge cases, corrupted files, network issues
- [ ] 25.2 Release Preparation:
  - [ ] 25.2.1 Documentation: Update README, user guides, changelog
  - [ ] 25.2.2 Version Bumping: Update package.json, electron-builder config
  - [ ] 25.2.3 Build Testing: Test production builds on all platforms
  - [ ] 25.2.4 Distribution: Prepare release artifacts, code signing
  - [ ] 25.2.5 Release Notes: Document features, bug fixes, known issues

## 15.0 Administrative: Change Local Store Directory

- [x] 15.1 Add a "Change Local Store Directory" item to the Tools menu
  - [x] 15.1.1 Add menu item under Tools for changing the local store directory
  - [x] 15.1.2 Wire up menu item to open a dialog/modal
- [x] 15.2 Menu selection > Show current local store directory and option to change
  - [x] 15.2.1 Display the current local store directory in monospace read-only box at top
  - [x] 15.2.2 Provide a "Choose Directory" button with loading state and validation
- [x] 15.3 Menu selection > Directory selection and validation
  - [x] 15.3.1 Allow user to select a new directory using the system file picker
  - [x] 15.3.2 Validate that the selected directory contains a `.romperdb` folder
  - [x] 15.3.3 If valid, save the new local store directory to settings and refresh app
  - [x] 15.3.4 If invalid or same directory, show inline warning/error and disable update button
- [x] 15.4 Menu selection > Post-update handling
  - [x] 15.4.1 After a successful update, automatically refresh the app with the new directory (no restart required)
  - [x] 15.4.2 Show success message confirming the directory change and app refresh

## 16.0 Settings File and Local Store Recovery Fixes

- [x] 16.1 Fix settings file naming collision
  - [x] 16.1.1 Change settings filename from `settings.json` to `romper-settings.json` to avoid conflicts with other Electron apps (Already implemented)
  - [x] 16.1.2 Update all settings read/write operations to use new filename (Already implemented)
  - [x] 16.1.3 Add migration logic to rename existing `settings.json` to `romper-settings.json` if present (Not needed - hard cutover already done)
  - [x] 16.1.4 Update settings path logging to show new filename (Already implemented)

- [x] 16.2 Implement "Choose Existing Local Store" functionality (Complete)
  - [x] 16.2.1 Add "Choose Existing Local Store" button to bottom-right corner of local store setup wizard
  - [x] 16.2.2 Create dialog/modal for browsing and selecting existing `.romperdb` directory
  - [x] 16.2.3 Validate selected directory contains valid romper database structure
  - [x] 16.2.4 Save selected path to romper-settings.json and refresh app state
  - [x] 16.2.5 Add "Back to Setup" button to return to normal wizard flow if needed
  - [x] 16.2.6 Only show this option when no valid local store is configured (not in menu-driven change flow)

- [ ] 16.3 Enhanced error recovery for lost settings (MEDIUM PRIORITY - Post 1.0.0)
  - [ ] 16.3.1 Detect when settings file exists but is empty or corrupt
  - [ ] 16.3.2 Provide clear user guidance when settings need to be reconfigured
  - [ ] 16.3.3 Preserve any valid settings during recovery operations
  - [ ] 16.3.4 Add validation of recovered settings before accepting them

## 17.0 UX Improvements: Kit List Layout and Information Hierarchy (COMPLETE)

- [x] 17.1 Implement Kit Type Visual Identification System:
  - [x] 17.1.1 Add colored left borders to kit cards in KitBrowser.tsx
    - [x] Red border: Invalid kits with missing files
    - [x] Amber border (#F59E0B): Modified user kits (work-in-progress with unsaved changes)
    - [x] Green border (#10B981): Editable user kits (saved user-created content)
    - [x] Gray border (#6B7280): Factory kits (read-only baseline content)
  - [x] 17.1.2 Update kit card styling in Tailwind classes for visual hierarchy
  - [x] 17.1.3 Add database queries to distinguish kit types for border logic
  - [x] 17.1.4 Create utility function to determine kit type from editable status and modification state

- [x] 17.2 Implement Enhanced Status Badge System:
  - [x] 17.2.1 Replace single "Modified" indicator with comprehensive badge system
  - [x] 17.2.2 Create badge components for different states:
    - [x] "Unsaved" badge for work-in-progress changes requiring save action
    - [x] "Editable" badge for user-created kits available for modification
  - [x] 17.2.3 Design responsive badge layout that adapts to screen size

- [x] 17.3 Implement Responsive Grid Layout System:
  - [x] 17.3.1 Replace VariableSizeList with CSS Grid for multi-column display
  - [x] 17.3.2 Implement dynamic column calculation based on window width:
    - [x] Small windows: 2 columns
    - [x] Medium windows: 3 columns
    - [x] Large windows: 4 columns
    - [x] Extra large: 5-6 columns
  - [x] 17.3.3 Add ResizeObserver for responsive layout updates
  - [x] 17.3.4 Update keyboard navigation for grid-based movement (arrow keys)

- [x] 17.4 Redesign Kit Card Layout and Information Density:
  - [x] 17.4.1 Set optimal card dimensions (300px width × 90px height)
  - [x] 17.4.2 Implement vertical information hierarchy:
    - [x] Top row: smaller icon, kit name, status badges
    - [x] Bottom row: unified voice indicators with name + sample count
  - [x] 17.4.3 Reduce icon size from text-5xl to text-2xl
  - [x] 17.4.4 Implement smart truncation with full names on hover

- [x] 17.5 Grid Layout Integration and Performance:
  - [x] 17.5.1 Update bank navigation (A-Z hotkeys) to work with grid layout
  - [x] 17.5.2 Adapt focus management for multi-column grid navigation
  - [x] 17.5.3 Ensure all existing features work in grid: selection, preview, etc.

- [x] 17.6 Implement Progressive Information Disclosure:
  - [x] 17.6.1 Define three-layer information hierarchy:
    - [x] Always visible: Kit name, type border, primary status badge
    - [x] On hover/focus: Status badges, duplicate button
  - [x] 17.6.2 Tinted backgrounds matching left border colors

## 18.0 UX Improvements: Journey-Based Navigation System (COMPLETE)

- [x] 18.1 Implement Interface Mode System:
  - [x] 18.1.1 Create mode context and state management (Browse/Edit/Sync modes)
  - [x] 18.1.2 Design mode switching UI components and indicators
  - [x] 18.1.3 Implement contextual toolbar that changes based on active mode

- [x] 18.2 Implement Browse Mode Interface:
  - [x] 18.2.1 Emphasize preview controls and kit metadata display
  - [x] 18.2.2 Hide editing tools to reduce cognitive load
  - [x] 18.2.3 Scan All Kits, Validate Local Store, and Setup buttons in browse mode

- [x] 18.3 Implement Edit Mode Interface:
  - [x] 18.3.1 Surface drag-and-drop targets and sample management tools
  - [x] 18.3.2 Show editable state toggle in kit details
  - [x] 18.3.3 Provide kit creation actions (New Kit, Next Kit)

- [x] 18.4 Implement Sync Mode Interface:
  - [x] 18.4.1 Display sync to SD card button only in sync mode
  - [x] 18.4.2 Separate from other workflows to prevent accidental sync operations

- [x] 18.5 Restructure Top-Level Navigation:
  - [x] 18.5.1 Reorganize menu buttons based on user journey separation
  - [x] 18.5.2 Group related actions (separate "Sync to SD Card" from "Add Kit")
  - [x] 18.5.3 Add contextual button groupings that change with mode
  - [x] 18.5.4 Implement clear visual separators between different journey actions

**Note:** Task 18.0 was implemented and then reverted in favor of simpler always-visible button approach. The interface mode system was successfully built but determined to add unnecessary complexity to the user experience.

## 19.0 UX Improvements: Smart Sample Location System (COMPLETE)

- [x] 19.1 Implement Contextual Location Labels:
  - [x] 19.1.1 Create smart labeling system to replace full file paths:
    - [x] "Splice Pack" with cloud icon for Splice sample libraries
    - [x] "Local Store" with drive icon for immutable baseline samples
    - [x] "Ableton Library" with music icon for DAW sample collections
    - [x] "Custom" with folder icon for user-organized sample directories
  - [x] 19.1.2 Develop path analysis utility to categorize sample sources
  - [x] 19.1.3 Design icon system for different location types
  - [x] 19.1.4 Implement location detection logic for common sample library patterns

- [x] 19.2 Implement Progressive Path Disclosure:
  - [x] 19.2.1 Show contextual labels by default in voice panels
  - [x] 19.2.2 Reveal complete path information on hover for technical users
  - [x] 19.2.3 Add "Show in Finder/Explorer" option on hover
  - [x] 19.2.4 Create tooltips with location descriptions

- [x] 19.3 Improve Reference-First Architecture Communication:
  - [x] 19.3.1 Add visual indicators (icons) showing sample locations
  - [x] 19.3.2 Create informational tooltips with location descriptions
  - [x] 19.3.3 Show location awareness with subtle contextual labels
  - [x] 19.3.4 Preserve full sample data for location display

## 20.0 UX Improvements: Favorites and Quick Access System

- [x] 20.1 Implement Favorites System: (Complete)
  - [x] 20.1.1 Add favorites field to kits database table
  - [x] 20.1.2 Create star-based marking UI for kit cards
  - [x] 20.1.3 Implement keyboard shortcut for rapid favorite toggling
  - [x] 20.1.4 Add "Favorites" filter with count badge in kit browser

- [ ] 20.2 Implement Priority Access System: (Partially Complete - LOW PRIORITY)
  - [x] 20.2.1 Create priority markers for high-priority kits in user workflow
  - [x] 20.2.2 Implement filter buttons with live counts (Modified: 3, Favorites: 12)
  - [ ] 20.2.3 Add "Quick Access" panel for live performance scenarios (~6 kit workflow) (LOW PRIORITY - Post 1.0.0)
  - [ ] 20.2.4 Create location-based filtering by sample source for organized browsing (LOW PRIORITY - Post 1.0.0)

- [ ] 20.3 Implement Efficient Kit Navigation (MEDIUM PRIORITY - Post 1.0.0):
  - [ ] 20.3.1 Optimize A-Z bank navigation for large collections
  - [ ] 20.3.2 Add recent kits tracking and quick access
  - [ ] 20.3.3 Implement search/filter functionality for kit discovery
  - [ ] 20.3.4 Create navigation patterns that support preview → copy/amend → sync workflow

- [ ] 20.4 Implement Kit Organization Features (LOW PRIORITY - Post 1.0.0):
  - [ ] 20.4.1 Add tagging system for kit categorization
  - [ ] 20.4.2 Implement sorting options (by modification date, favorites, type)
  - [ ] 20.4.3 Create collection views for different use cases (live performance, studio work)
  - [ ] 20.4.4 Add batch operations for managing multiple kits

## 21.0 UX Improvements: Testing and Integration (LOW PRIORITY - Post 1.0.0)

- [ ] 21.1 Create UX Component Tests (LOW PRIORITY):
  - [ ] 21.1.1 Test kit type visual identification system
  - [ ] 21.1.2 Test enhanced status badge system responsiveness
  - [ ] 21.1.3 Test progressive information disclosure functionality
  - [ ] 21.1.4 Test mode switching and contextual interface changes

- [ ] 21.2 Create UX Integration Tests (LOW PRIORITY):
  - [ ] 21.2.1 Test complete browse → edit → sync workflow separation
  - [ ] 21.2.2 Test favorites and quick access system performance
  - [ ] 21.2.3 Test smart location labeling with various sample library patterns
  - [ ] 21.2.4 Test information density improvements with large kit collections

- [ ] 21.3 User Experience Validation (LOW PRIORITY):
  - [ ] 21.3.1 Validate quick kit state assessment capability
  - [ ] 21.3.2 Test workflow efficiency improvements for new users
  - [ ] 21.3.3 Validate location awareness without path overwhelm
  - [ ] 21.3.4 Test scalability with dozens to hundreds of kits

- [ ] 21.4 Accessibility and Performance (MEDIUM PRIORITY):
  - [ ] 21.4.1 Ensure all UX improvements work in light/dark modes
  - [ ] 21.4.2 Test keyboard navigation for new UI elements
  - [ ] 21.4.3 Validate performance with progressive disclosure system
  - [ ] 21.4.4 Test screen reader compatibility for enhanced status system


---

_Last updated: 2025-07-30_
