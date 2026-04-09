# Code Structure

## Build System
- **Type**: npm + Vite + Electron Forge
- **Configuration**: 3 separate Vite configs (main, preload, renderer), forge.config.cjs
- **Build Command**: `npm run build` runs main/preload/renderer concurrently

## Source Layout

### Renderer (app/renderer/) - 166 source files
```
app/renderer/
+-- views/                    # Top-level views (KitsView, AboutView)
+-- components/
|   +-- hooks/
|   |   +-- kit-management/   # 25 hooks for kit operations
|   |   +-- sample-management/# 8 hooks for sample operations
|   |   +-- voice-panels/     # 8 hooks for voice panel UI
|   |   +-- wizard/           # 4 hooks for setup wizard
|   |   +-- shared/           # 26+ cross-cutting hooks
|   +-- dialogs/              # Modal dialogs
|   +-- preferences/          # Settings tabs
|   +-- wizard/               # Setup wizard steps
|   +-- led-icon/             # LED grid visualization
|   +-- shared/               # Reusable components
|   +-- utils/                # UI utilities
|   |   +-- scanners/         # Sample scanning orchestration (7 files)
+-- utils/                    # Core utilities
+-- styles/                   # CSS/Tailwind
+-- assets/                   # Static assets
+-- fonts/                    # Typography
```

### Electron Main (electron/main/) - 55 source files
```
electron/main/
+-- db/
|   +-- operations/           # CRUD operations (kit, sample, voice, favorites, sync)
|   +-- romperDbCoreORM.ts    # Core ORM setup
|   +-- dbUtilities.ts        # DB connection and migration utilities
+-- services/
|   +-- sampleService.ts      # Sample add/replace/delete/move operations
|   +-- syncService.ts        # SD card synchronization
|   +-- syncPlannerService.ts # Sync planning and validation
|   +-- syncValidationService.ts
|   +-- syncFileOperations.ts
|   +-- syncSampleProcessing.ts
|   +-- syncMonoAnnotation.ts
|   +-- scanService.ts        # Kit/sample scanning
|   +-- localStoreService.ts  # Local store validation
|   +-- archiveService.ts     # Factory sample download
|   +-- kitService.ts         # Kit-level operations
|   +-- settingsService.ts    # Settings persistence
+-- dbIpcHandlers.ts          # Database IPC routing
+-- sampleIpcHandlers.ts      # Sample IPC routing
+-- syncIpcHandlers.ts        # Sync IPC routing
+-- favoritesIpcHandlers.ts   # Favorites IPC routing
+-- ipcHandlers.ts            # General IPC handlers
+-- index.ts                  # Entry point
+-- mainProcessSetup.ts       # Window/menu setup
+-- applicationMenu.ts        # Native menu definition
```

### Shared (shared/) - 7 source files
```
shared/
+-- db/
|   +-- schema.ts             # Drizzle ORM schema definitions
|   +-- types.ts              # Shared type exports
|   +-- index.ts              # Schema barrel export
+-- errorUtils.ts             # Centralized error handling
+-- kitUtilsShared.ts         # Kit name utilities
+-- undoTypes.ts              # Undo/redo type definitions
+-- slotUtils.ts              # Slot number utilities
```

### Preload (electron/preload/) - 1 source file
```
electron/preload/
+-- index.ts                  # 544+ LOC IPC bridge (100+ exposed methods)
```

## Design Patterns

### DbResult Pattern
All database operations return `{ success: boolean; data?: T; error?: string }` for consistent error handling.

### createDbHandler Wrapper
IPC handlers wrapped to auto-extract dbDir, validate local store, handle errors consistently.

### Hook Composition
Complex features built by composing multiple focused hooks (e.g., useSampleManagement composes useSampleManagementOperations + useSampleManagementMoveOps).

### Factory Test Data
Centralized test factories in `/tests/mocks/` and `/tests/factories/` for consistent test setup.

## Critical Dependencies
- **Electron 36.8.1**: Desktop framework
- **React 19.1.0**: UI framework
- **Drizzle ORM 0.44.3 + better-sqlite3 11.10.0**: Type-safe synchronous database
- **Vite 6.4.2**: Build toolchain
- **TypeScript 5.8.3**: Type safety (strict mode)
- **Vitest 3.2.3**: Testing framework
- **Playwright 1.56.1**: E2E testing
- **Tailwind CSS 4.1.8**: Utility-first styling
- **wavesurfer.js 7.9.5**: Audio waveform visualization
