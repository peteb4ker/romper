# Component Inventory

> **Dated snapshot, not maintained.** This file describes `main` at commit
> `87bea51` (2026-09-29) and hasn't been kept up to date since. For current
> behaviour read the code on `main`; for what's still open, see
> [GitHub issues](https://github.com/peteb4ker/romper/issues).

> Reverse-engineered from `main` @ `87bea51` (app version 1.3.1) on 2026-09-29.
> LOC excludes tests. "Dead" means only tests import it, or nothing does.

## Application Packages

| Package | Files | LOC | Purpose |
|---|---|---|---|
| `app/renderer/` | 179 TS/TSX + 1 CSS | 23,447 | React UI: kit browser, kit editor, step sequencer, setup wizard, dialogs |
| `electron/main/` | 55 TS | 10,005 | Main process: window, menu, IPC handlers, services, SQLite access, sync, archive, audio conversion |
| `electron/preload/` | 1 TS | 661 | The `contextBridge` bridge (65 methods, menu event forwarding, settings helper) |

### Renderer: shell and views

| Component | LOC | Responsibility |
|---|---|---|
| `main.tsx` | 76 | Root: `SettingsProvider`, `HashRouter`, toast provider, status bar, About dialog |
| `views/KitsView.tsx` | 265 | Orchestrator. Composes 11 hooks and switches between the kit browser and the kit editor based on `selectedKit` |
| `views/AboutView.tsx` | 104 | About page on route `/about`. **Unreachable**: nothing navigates there |
| `utils/SettingsContext.tsx` | 369 | Settings reducer, theme, local-store status |
| `MessageDisplay.tsx`, `MessageDisplayContext.tsx` | 87, 7 | Toast stack and its context |
| `StatusBar.tsx` | 99 | Footer: store path, manual links, theme toggle |
| `EnvironmentBanner.tsx` | 34 | Banner shown when env-var overrides are active |
| `KitViewDialogs.tsx` | 49 | Hosts Preferences and Change Local Store dialogs |

### Renderer: kit browser

| Component | LOC | Responsibility |
|---|---|---|
| `KitBrowserContainer.tsx` | 133 | Memoised pass-through to `KitBrowser` |
| `KitBrowser.tsx` | 293 | Header, bank navigation, grid, sync dialog |
| `KitBrowserHeader.tsx` | 218 | LED icon, search, favourites and modified filters, "Write to SD", settings, bulk-scan status |
| `SearchInput.tsx` | 124 | Debounced search box |
| `KitBankNav.tsx` | 153 | A to Z bank sidebar |
| `KitGrid.tsx` | 525 | Virtualised grid (react-window `VariableSizeList`) of bank headers, kit cards and add cards; 2 to 6 columns |
| `KitGridCard.tsx` | 105 | Per-kit wrapper: focus, favourite state, search expansion |
| `KitGridItem.tsx` | 330 | Kit card with badges and favourite / duplicate / delete actions |
| `KitVoiceStrip.tsx` | 119 | Four voice sample counts, or search matches |
| `BankHeader.tsx` | 209 | Bank letter and editable artist name. Only the `grid` variant is used |
| `AddKitCard.tsx` | 35 | New-kit card |
| `shared/KitItemActionPopovers.tsx`, `ActionPopover.tsx`, `KitIconRenderer.tsx`, `searchHighlight.tsx` | 136, 52, 91, 26 | Popovers, kit icon, search highlighting |

### Renderer: kit editor and voice panels

| Component | LOC | Responsibility |
|---|---|---|
| `KitEditorContainer.tsx` | 99 | Memoised pass-through |
| `KitEditor.tsx` | 162 | Layout; logic comes from `useKitEditorLogic` |
| `KitHeader.tsx` | 323 | Back / previous / next, alias edit, favourite, editable toggle, scan, LED icon |
| `KitForm.tsx` | 126 | Kit metadata form (tag editing disabled) |
| `KitVoicePanels.tsx` | 485 | Four-voice row, stereo link and unlink, sample metadata fetch |
| `KitVoicePanel.tsx` | 272 | One voice: a `listbox` of 12 slots |
| `SampleWaveform.tsx` | 392 | Per-slot audio load, decode (its own `AudioContext`), play / stop, canvas waveform, playhead, VU levels |
| `GainKnob.tsx` | 227 | SVG gain knob, -24 to +12 dB |

### Renderer: step sequencer

| Component | LOC | Responsibility |
|---|---|---|
| `KitStepSequencer.tsx` | 231 | BPM, mutes (session only), voice volumes, sample modes, stereo links |
| `StepSequencerGrid.tsx` | 445 | 4 x 16 step buttons; right-click trigger-condition popover; per-voice controls |
| `StepSequencerControls.tsx` | 115 | Transport, BPM, cycle counter |
| `StepSequencerDrawer.tsx` | 64 | Collapsible drawer |

### Renderer: setup wizard

| Component | LOC | Responsibility |
|---|---|---|
| `LocalStoreWizardModal.tsx` | 54 | Modal host (rendered by `KitsView`) |
| `LocalStoreWizardUI.tsx` | 365 | Three steps, "choose existing", post-setup guidance |
| `wizard/WizardStepNav`, `WizardSourceStep`, `WizardTargetStep`, `WizardSummaryStep`, `WizardProgressBar`, `WizardErrorMessage`, `WizardPostInitGuidance` | 103, 88, 82, 40, 56, 18, 70 | Wizard steps and helpers |
| `utils/FilePickerButton.tsx`, `utils/Spinner.tsx` | 68, 34 | Helpers |

### Renderer: dialogs and preferences

| Component | LOC | Status |
|---|---|---|
| `dialogs/SyncUpdateDialog.tsx` | 473 | In use (slide-in sync panel) |
| `dialogs/InvalidLocalStoreDialog.tsx` | 300 | In use. Its "Re-run wizard" button never renders because the prop is not passed |
| `dialogs/ChangeLocalStoreDirectoryDialog.tsx` | 287 | In use |
| `dialogs/PreferencesDialog.tsx` + `preferences/AdvancedTab`, `AppearanceTab`, `SampleManagementTab` | 177 + 86, 120, 50 | In use |
| `dialogs/AboutDialog.tsx` + `dialogs/led-grid/*` | 158 + 441 | In use (animated LED About dialog) |
| `dialogs/CriticalErrorDialog.tsx` | 51 | In use |
| `dialogs/ValidationResultsDialog.tsx` | 220 | **Unreachable** (its open flag is never set) |
| `DeleteKitDialog.tsx`, `KitDialogs.tsx`, `ThemeToggle.tsx` | 77, 59, 42 | **Dead** (tests only) |

### Renderer: LED icon and icons

| Component | LOC | Responsibility |
|---|---|---|
| `led-icon/LedIconGrid.tsx` + `useLedVisualization`, `ledRenderers`, `vuMeterState`, `audioLevels`, constants | 110 + 620 | Animated LED logo in both headers; doubles as a VU meter during playback |
| `icons/DrumKit.tsx`, `icons/StereoIcon.tsx` | 81, 36 | Icons |

### Renderer: hooks (77 exported)

Business logic lives mostly in hooks under `app/renderer/components/hooks/`.
**Bold** marks core business logic.

| Folder | Hooks | Notable hooks (LOC) |
|---|---|---|
| `kit-management/` | 30 | **useKitStepSequencerLogic** (377), **useKitDataManager** (334), **useKitEditorLogic** (252), useKitBankNavigation (218), useKitScan (199), useKitScanning (189), **useKitNavigation** (182), useKitFilters (169), useKitSync (153), **useKitPlayback** (103). Dead: useKit, useKitStepSequencer, useKitVoicePanel |
| `sample-management/` | 8 | useStereoHandling (416), **useSampleManagementUndoActions** (288), **useSampleManagementOperations** (214), **useSampleManagementMoveOps** (201), useSlotRendering (184), useSampleProcessing (145) |
| `voice-panels/` | 8 | useVoicePanelSlotRendering (389), useVoicePanelRendering (182), useVoicePanelUI (122). These hooks return JSX render functions, five layers deep |
| `wizard/` | 5 | **useLocalStoreWizard** (245), **useLocalStoreWizardFileOps** (235), useLocalStoreWizardState (195), useLocalStoreWizardScanning (170), useWizardProgress (55) |
| `shared/` | 22 | **useUndoActionHandlers** (343), useValidationResults (228, unreachable), useExternalDragHandlers (212), useInternalDragHandlers (210), **useSyncUpdate** (183), **useUndoRedo** (148), useGlobalKeyboardShortcuts (142), **useTriggerConditions**, **useBpm**, **useStepPattern**. Dead: useMessageApi |
| elsewhere | 3 | `hooks/useKitGridKeyboard.ts` (197), `led-icon/useLedVisualization` (188), `dialogs/led-grid/useLedAnimation` (127) |

### Renderer: utilities
- `components/utils/scanners/` - scan orchestration (WAV analysis, voice
  inference, RTF artist scanning).
- `components/utils/` - kit and bank operations, `romperDb.ts` (wizard DB
  helpers). `scanningOperations.ts` duplicates `scannerOperations.ts` and
  is dead.
- `utils/` - `SettingsContext`, logger (`createLogger`), search, sample
  grouping, WAV metadata formatter, error handling, `hmrStateManager`.
- `config.ts` - a Proxy over `window.romperEnv` with the factory-archive
  URL default.

### Main process modules

| Area | Modules |
|---|---|
| Bootstrap | `index.ts`, `mainProcessSetup.ts`, `applicationMenu.ts`, `menuIcons.ts`, `autoUpdater.ts`, `utils/logger.ts`, `types/settings.ts` |
| IPC handlers | `ipcHandlers.ts`, `dbIpcHandlers.ts`, `db/sampleIpcHandlers.ts`, `db/syncIpcHandlers.ts`, `db/favoritesIpcHandlers.ts`, `db/ipcHandlerUtils.ts` |
| Database | `db/romperDbCoreORM.ts` (re-exports), `db/utils/dbUtilities.ts`, `db/utils/dbMigrations.ts`, `db/operations/*` (kit, sample, voice, favourites, sync flag, movement, relations, CRUD) |
| Services | `settingsService`, `localStoreService`, `archiveService`, `kitService`, `sampleService` + `crud/`, `metadata/`, `slot/`, `validation/`, `sampleBatchOperations`, `sampleValidation`, `scanService`, `syncService` + `syncSampleProcessing`, `syncFileOperations`, `syncValidationService`, `syncMonoAnnotation`, `syncProgressManager`, `rtfFileService` |
| Audio and files | `audioUtils.ts` (Rample format rules, WAV header parser), `formatConverter.ts` (decode, mono, gain, resample, 16-bit encode), `archiveUtils.ts` (download, safe unzip), `localStoreValidator.ts`, `utils/fileSystemUtils.ts` |
| Dead (about 942 LOC) | `services/stereoSyncProcessor.ts`, `services/rampleNamingService.ts`, `db/fileOperations.ts`, `db/stepPatternUtils.ts`, `services/slot/sampleSlotService.ts`, `utils/errorCategorizationUtils.ts`, `utils/stereoProcessingUtils.ts` |

## Infrastructure Packages

There is no infrastructure-as-code. The equivalent is the build and release
tooling:

| Package | Type | Purpose |
|---|---|---|
| `.github/workflows/` | GitHub Actions | 8 workflows: build, lint, typecheck, test (+ Codecov and SonarCloud on `main`), e2e, pages, release, and an unused reusable `setup-node.yml` |
| `forge.config.cjs` | Electron Forge | Makers, fuses, DMG background, ignore list |
| `electron/resources/` | Signing | `entitlements.plist`, `rcodesign.toml` (per-helper entitlement scopes), app icons, DMG background |
| `scripts/` | Node scripts | Dev server, worktrees, release notes, icon and DMG generators, architecture reports, e2e fixtures. Several are stale or dead (see code-quality-assessment.md) |

## Shared Packages

| Module | LOC | Type | Purpose | Used by |
|---|---|---|---|---|
| `shared/electronApi.ts` | 314 | Contract | `ElectronAPI` bridge interface and related types | preload, renderer |
| `shared/db/schema.ts` | 176 | Models | Drizzle tables, relations, inferred types, `DbResult` | main, renderer |
| `shared/db/types.ts` | 1 | Models | Re-exports | preload |
| `shared/audioTypes.ts` | 43 | Models | Audio metadata and format-validation types | contract, main |
| `shared/errorUtils.ts` | 109 | Utilities | Error classes and helpers | main, renderer |
| `shared/kitUtilsShared.ts` | 209 | Utilities | Kit-slot parsing and sorting, `isValidKit`, voice inference | renderer, `scanService` |
| `shared/slotUtils.ts` | 65 | Utilities | `MAX_SLOTS = 12`, slot number conversion | renderer only |
| `shared/undoTypes.ts` | 195 | Models | Undo action types | renderer only |
| `shared/db/index.ts`, `shared/db/tsconfig.json` | 2 | - | **Unused** | none |

## Test Packages

| Package | Type | Count | Purpose |
|---|---|---|---|
| `**/__tests__/*.test.ts(x)` | Unit | 238 files, 3,453 tests | Co-located unit tests (jsdom) |
| `**/*.integration.test.ts` | Integration | 27 files, 534 tests | Main-process and DB tests run inside Electron-as-Node |
| `tests/e2e/`, `app/.../localStoreWizard.e2e.test.ts` | E2E | 8 files, 24 tests | Playwright against the built app: setup wizard, navigation, onboarding errors, fixtures, sync |
| `tests/unit/` | Unit | - | Cross-cutting checks such as `ipcChannelParity.test.ts` |
| `tests/mocks/`, `tests/factories/`, `tests/providers/`, `tests/utils/`, `tests/fixtures/` | Test infrastructure | - | Shared mocks (the `electronAPI` mock is not checked against the contract), data factories, providers, e2e fixture tarball |

E2E does not cover sample assignment, drag and drop, playback, favourites,
preferences, format conversion, the menu or auto-update.

## Total Count

- **Source files**: 244 TypeScript files (renderer 179, main 55, shared 9, preload 1)
- **Source LOC**: about 35,200 (renderer 23,447 including CSS, main 10,005, shared 1,114, preload 661)
- **Test files**: 273 (238 unit, 27 integration, 8 e2e)
- **Test LOC**: about 77,000 in co-located tests (renderer 49,830, main 25,599, shared 1,510), plus `tests/`
- **React components**: 64 files, plus 7 inner components
- **Custom hooks**: 77
- **IPC channels**: 62 request/response, 7 active push channels
- **Dead or unreachable code**: about 942 LOC in main, about 1,100 LOC in
  the renderer
