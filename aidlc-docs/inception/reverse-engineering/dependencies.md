# Dependencies

## Internal Dependencies

### Layer Dependencies
```
Renderer (app/renderer/) --> Preload (electron/preload/) --> Main (electron/main/)
                                                              |
All Layers -----------------------------------------> Shared (shared/)
```

- Renderer imports from shared/ for types and utilities
- Renderer communicates with main via preload IPC bridge (window.electronAPI)
- Main process imports from shared/ for schema and utilities
- Preload imports from shared/ for types
- No circular dependencies (verified by Madge)

### Hook Composition Dependencies
- useKit composes: useKitDataManager, useKitNavigation, useKitSearch, useKitFilters, useKitSync, useKitPlayback, etc.
- useSampleManagement composes: useSampleManagementOperations, useSampleManagementMoveOps
- useKitVoicePanel composes: useVoicePanelUI, useVoicePanelSlots, useVoicePanelDragHandlers

### Service Dependencies
- syncService depends on: syncPlannerService, syncValidationService, syncFileOperations, syncSampleProcessing, syncMonoAnnotation
- sampleService depends on: database CRUD operations, audioUtils
- scanService depends on: database operations, sampleService

## External Dependencies (Key)

### Production
| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| electron | 36.8.1 | Desktop framework | MIT |
| react | 19.1.0 | UI framework | MIT |
| react-dom | 19.1.0 | React DOM renderer | MIT |
| react-router-dom | 7.12.0 | Client-side routing | MIT |
| drizzle-orm | 0.44.3 | Type-safe ORM | Apache-2.0 |
| better-sqlite3 | 11.10.0 | SQLite driver | MIT |
| tailwindcss | 4.1.8 | Utility-first CSS | MIT |
| wavesurfer.js | 7.9.5 | Audio waveform display | BSD-3 |
| react-window | 1.8.11 | Virtual list rendering | MIT |
| react-dropzone | 14.3.8 | File drag-and-drop | MIT |
| @phosphor-icons/react | 2.1.10 | Icon library | MIT |
| archiver | 7.0.1 | Archive creation | MIT |
| unzipper | 0.12.3 | Archive extraction | MIT |
| node-wav | 0.0.2 | WAV file parsing | MIT |
| play-sound | 1.1.6 | Audio playback | MIT |

### Development
| Package | Version | Purpose |
|---------|---------|---------|
| typescript | 5.8.3 | Type checking |
| vite | 6.4.2 | Build tool |
| vitest | 3.2.3 | Unit testing |
| @playwright/test | 1.56.1 | E2E testing |
| @testing-library/react | 16.3.0 | Component testing |
| eslint | 9.0.0 | Code linting |
| husky | 9.1.7 | Git hooks |
| drizzle-kit | 0.31.4 | Migration management |
| @electron-forge/* | 7.11.1 | Packaging/distribution |
| concurrently | 9.1.2 | Parallel tasks |
| nyc | 17.1.0 | Coverage aggregation |
| madge | 8.0.0 | Circular dependency detection |
| dependency-cruiser | 17.3.10 | Architecture validation |
| sharp | 0.34.5 | Image processing |

### Security Notes
- 38 npm audit vulnerabilities (6 low, 5 moderate, 27 high)
- Most are in dev/build dependencies (electron-forge, testing tools)
- Context isolation and input validation mitigate runtime risks
