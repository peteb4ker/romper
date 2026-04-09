# Component Inventory

## Application Packages

### Renderer (app/renderer/) - 166 source files
- **Views**: KitsView (main orchestrator), AboutView
- **Kit Components**: KitBrowserContainer, KitBrowser, KitBrowserHeader, KitBankNav, KitGrid, KitGridItem, KitGridCard, KitList, KitItem, KitEditorContainer, KitEditor, KitHeader, KitForm, KitVoicePanels, KitVoicePanel, KitStepSequencer, StepSequencerGrid, StepSequencerControls, StepSequencerDrawer
- **Dialog Components**: PreferencesDialog, AboutDialog, DeleteKitDialog, SyncUpdateDialog, ChangeLocalStoreDirectoryDialog, InvalidLocalStoreDialog, CriticalErrorDialog, ValidationResultsDialog
- **Wizard Components**: LocalStoreWizardModal, LocalStoreWizardUI, WizardStepNav, WizardSourceStep, WizardTargetStep, WizardSummaryStep, WizardProgressBar, WizardErrorMessage
- **Shared Components**: ActionPopover, KitIconRenderer, SearchInput, BankHeader, StatusBar, AddKitCard, ThemeToggle, GainKnob, Spinner, MessageDisplay, LedPixelGrid, LedIconGrid, SampleWaveform
- **Preferences Tabs**: AdvancedTab, SampleManagementTab, AppearanceTab

### Hooks (71+ custom hooks across 5 domains)
- **Kit Management**: 25 hooks (useKit, useKitDataManager, useKitSearch, useKitNavigation, useKitPlayback, useKitSync, useKitFilters, etc.)
- **Sample Management**: 8 hooks (useSampleManagement, useSampleActions, useSampleManagementMoveOps, useSampleProcessing, etc.)
- **Voice Panels**: 8 hooks (useVoicePanelUI, useVoicePanelSlots, useVoicePanelRendering, useVoicePanelDragHandlers, etc.)
- **Wizard**: 4 hooks (useLocalStoreWizard, useLocalStoreWizardState, useLocalStoreWizardFileOps, useLocalStoreWizardScanning)
- **Shared**: 26+ hooks (useUndoRedo, useDragAndDrop, useKeyboardNavigation, useBpm, useStepPattern, useTriggerConditions, useFileValidation, useDialogState, etc.)

### Utilities (app/renderer/utils/ + components/utils/)
- Scanner orchestration (7 files): orchestrator.ts, wavAnalysisScanner.ts, voiceInferenceScanner.ts, rtfArtistScanner.ts
- Kit operations, bank operations, database scanning, romperDb utilities
- Settings manager, error handling, search utils, sample grouping, WAV metadata formatter

## Backend Packages

### Electron Main (electron/main/) - 55 source files
- **Database**: romperDbCoreORM.ts, dbUtilities.ts, 9 CRUD operation files
- **Services**: sampleService, syncService (+ 5 sync sub-services), scanService, localStoreService, archiveService, kitService, settingsService
- **IPC Handlers**: dbIpcHandlers, sampleIpcHandlers, syncIpcHandlers, favoritesIpcHandlers, ipcHandlers
- **Setup**: index.ts, mainProcessSetup.ts, applicationMenu.ts, audioUtils.ts, archiveUtils.ts

### Preload (electron/preload/) - 1 source file
- index.ts: 544+ LOC IPC bridge (100+ exposed methods)

### Shared (shared/) - 7 source files
- Database schema (schema.ts, types.ts, index.ts)
- Utilities (errorUtils.ts, kitUtilsShared.ts, undoTypes.ts, slotUtils.ts)

## Test Packages

### Unit Tests - 244 test files
- Co-located with source via __tests__/ directories
- Coverage thresholds: 85% lines/branches, 80% functions

### Integration Tests - 51 test files
- Cross-process validation of IPC handlers and services
- Run in Electron environment via custom runner

### E2E Tests - 21 test files
- Playwright-based full workflow testing
- Custom fixture system with temporary directories

### Test Infrastructure
- Centralized mocks in /tests/mocks/ (electronAPI, audio, DOM, database)
- Test factories in /tests/factories/ (kit, sample)
- Test utilities in /tests/utils/ (renderWithProviders, e2e-fixture-extractor)
- Test providers in /tests/providers/ (TestElectronProvider, TestSettingsProvider)

## Total Count
- **Total Source Files**: 232
- **Renderer**: 166 (71%)
- **Electron Main**: 55 (24%)
- **Shared**: 7 (3%)
- **Preload**: 1 (<1%)
- **Test Files**: 316 (244 unit + 51 integration + 21 e2e)
