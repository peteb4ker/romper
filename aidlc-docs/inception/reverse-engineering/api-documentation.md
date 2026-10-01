# API Documentation

> Reverse-engineered from `main` @ `87bea51` (app version 1.3.1) on 2026-09-29.

Romper has no REST or network API. Its API is the **IPC bridge** between
the sandboxed React renderer and the Electron main process.

## How the bridge works

- **Contract**: `shared/electronApi.ts` defines the `ElectronAPI` interface.
  The preload object is checked against it with `satisfies ElectronAPI`
  (`electron/preload/index.ts:639`). The renderer sees it through
  `app/renderer/electron.d.ts`.
- **Parity guard**: `tests/unit/ipcChannelParity.test.ts` checks that every
  preload `invoke` channel has a main-process `handle`, and the other way
  round. It covers request/response channels only.
- **Gap**: the contract binds preload and renderer only. Main-process
  handlers do not import it, so their signatures and return values can
  drift from the contract. Several have (see "Known contract problems").
- **Three bridge objects** exposed with `contextBridge`:
  - `electronAPI` - 65 methods. 62 are one `ipcRenderer.invoke` channel
    each; the four settings methods share two channels.
  - `electronFileAPI.getDroppedFilePath(file)` - calls
    `webUtils.getPathForFile` locally, no IPC.
  - `romperEnv` - three environment values (`ROMPER_SDCARD_PATH`,
    `ROMPER_LOCAL_PATH`, `ROMPER_SQUARP_ARCHIVE_URL`).
- **No other mechanisms**: nothing uses `ipcMain.on`, `sendSync` or
  `handleOnce`. The renderer never receives `ipcRenderer` itself.

### Handler files

| Abbrev. | File | Channels |
|---|---|---|
| IH | `electron/main/ipcHandlers.ts` | 23 |
| DH | `electron/main/dbIpcHandlers.ts` | 26 |
| SH | `electron/main/db/sampleIpcHandlers.ts` | 7 |
| YH | `electron/main/db/syncIpcHandlers.ts` | 3 |
| FH | `electron/main/db/favoritesIpcHandlers.ts` | 3 |

**`createDbHandler`** (`electron/main/db/ipcHandlerUtils.ts:10-21`) wraps
most DB handlers (marked "cDB" below). It resolves the database folder from
`ROMPER_LOCAL_PATH` or the saved `localStorePath`, and returns
`{ success: false, error }` if no store is configured. It does not catch
exceptions, so a throw inside a handler rejects the renderer's promise.

## Internal APIs (IPC channels)

"Callers" is the approximate number of call sites in non-test renderer
code. Zero means the method is exposed but unused.

### Settings and app

| Channel | Bridge method | Handler | Arguments | Returns | Callers |
|---|---|---|---|---|---|
| `read-settings` | `readSettings`, `getSetting` | IH:18 | - / key | `SettingsData` / value | 2 / 0 |
| `write-settings` | `writeSettings`, `setSetting` | IH:22 | key, value | void | 1 / 4 |
| `get-local-store-status` | `getLocalStoreStatus` | IH:27 | - | `LocalStoreValidationDetailedResult` | 1 |
| `close-app` | `closeApp` | IH:40 | - | void | 3 |
| `get-user-home-dir` | `getUserHomeDir` | IH:152 | - | string | 1 |
| `open-external` | `openExternal` | IH:68 (https only) | url | `{success, error?}` | 2 |
| `show-item-in-folder` | `showItemInFolder` | IH:63 | path | unknown | 1 |

### Local store, setup wizard and file system

| Channel | Bridge method | Handler | Arguments | Returns | Callers |
|---|---|---|---|---|---|
| `select-local-store-path` | `selectLocalStorePath` | IH:156 (folder dialog) | - | path or null | 4 |
| `select-existing-local-store` | `selectExistingLocalStore` | IH:167 | - | `{success, path, error}` | 2 |
| `select-sd-card` | `selectSdCard` | IH:44 (folder dialog opened at the home folder) | - | path or null | 2 |
| `validate-local-store` | `validateLocalStore` | DH:209 (throws if no path) | path? | `LocalStoreValidationDetailedResult` | 3 |
| `validate-local-store-basic` | `validateLocalStoreBasic` | DH:226 (throws if no path) | path? | same | 1 |
| `list-files-in-root` | `listFilesInRoot` | IH:129 | **any path** | string[] (throws on error) | 5 |
| `read-file` | `readFile` | IH:149 (refuses symlinks and files over 256 MiB) | **any path** | `DbResult<ArrayBuffer>` | 1 |
| `ensure-dir` | `ensureDir` | IH:204 | **any path** | `{success, error?}` | 2 |
| `copy-dir` | `copyDir` | IH:208 (synchronous recursive copy, skips symlinks) | src, dest | `{success, error?}` | 1 |
| `check-disk-space` | `checkDiskSpace` | IH:212 | path, bytes | `{availableBytes, requiredBytes, sufficient, error?}` | 1 |
| `check-path-writable` | `checkPathWritable` | IH:219 (writes and deletes a probe file) | path | `{writable, error?}` | 1 |
| `cleanup-partial-init` | `cleanupPartialInit` | IH:223 (removes only `<path>/.romperdb`) | path | `{removed, error?}` | 1 |
| `download-and-extract-archive` | `downloadAndExtractArchive` | IH:180 | url (https: or file:), destDir | `DbResult` | 1 |
| `create-romper-db` | `createRomperDb` | DH:42 | **dbDir from the renderer** | `RomperDbResult` | 1 |
| `insert-kit` | `insertKit` | DH:46 | dbDir, raw `NewKit` row | `DbResult` | 1 |
| `insert-sample` | `insertSample` | DH:50 | dbDir, raw `NewSample` row | `DbResult<{sampleId}>` | 1 |

### Kits and favourites

| Channel | Bridge method | Handler | Arguments | Returns | Callers |
|---|---|---|---|---|---|
| `get-all-kits` | `getKits` | DH:82 cDB | - | `DbResult<KitWithRelations[]>` | 2 |
| `get-kit` | `getKit` | DH:57 cDB | kitName | `DbResult<KitWithRelations>` (data can be null) | 2 |
| `get-kits-metadata` | `getKitsMetadata` | DH:89 cDB | - | `DbResult<Kit[]>` | 0 |
| `create-kit` | `createKit` | IH:105 | kitSlot | `DbResult` | 1 |
| `copy-kit` | `copyKit` | IH:116 | source, dest | `DbResult` | 1 |
| `delete-kit` | `deleteKit` | IH:95 | kitName | `DbResult` | 1 |
| `get-kit-delete-summary` | `getKitDeleteSummary` | IH:85 | kitName | `DbResult<{kitName, locked, sampleCount, voiceCount}>` | 1 |
| `update-kit-metadata` | `updateKit` | DH:64 cDB | kitName, partial kit | `DbResult` | 3 |
| `update-kit-bpm` | `updateKitBpm` | DH:173 cDB | kitName, bpm | `DbResult` | 1 |
| `update-step-pattern` | `updateStepPattern` | DH:183 cDB | kitName, `number[][]` | `DbResult` | 1 |
| `update-trigger-conditions` | `updateTriggerConditions` | DH:193 cDB | kitName, `(string\|null)[][]` | `DbResult` | 1 |
| `rescan-kit` | `rescanKit` | DH:254 | kitName | `DbResult<{scannedSamples, updatedVoices}>` | 3 |
| `rescan-kits-missing-metadata` | `rescanKitsMissingMetadata` | DH:258 | - | `DbResult<{...}>` | 0 |
| `toggle-kit-favorite` | `toggleKitFavorite` | FH:17 cDB | kitName | `DbResult<{isFavorite}>` | 2 |
| `get-favorite-kits` | `getFavoriteKits` | FH:22 cDB | - | `DbResult<KitWithRelations[]>` | 0 |
| `get-favorite-kits-count` | `getFavoriteKitsCount` | FH:27 cDB | - | `DbResult<number>` | 2 |

`create-kit`, `copy-kit`, `delete-kit` and `get-kit-delete-summary` check
the kit name against `^\p{Lu}\d{1,2}$` and throw (rejecting the promise)
if it does not match. `delete-kit` refuses a kit whose `locked` flag is
set, but nothing in the app sets that flag.

### Voices, samples and audio

| Channel | Bridge method | Handler | Arguments | Returns | Callers |
|---|---|---|---|---|---|
| `update-voice-alias` | `updateVoiceAlias` | DH:96 cDB | kit, voice, alias | `DbResult` | 3 |
| `update-voice-volume` | `updateVoiceVolume` | DH:133 cDB | kit, voice, volume | `DbResult` | 1 |
| `update-voice-sample-mode` | `updateVoiceSampleMode` | DH:143 cDB | kit, voice, mode | `DbResult` | 1 |
| `update-voice-stereo-mode` | `updateVoiceStereoMode` | DH:158 cDB | kit, voice, boolean | `DbResult` | 2 |
| `add-sample-to-slot` | `addSampleToSlot` | SH:12 | kit, voice, slot, filePath | `DbResult<{sampleId}>` | 8 |
| `replace-sample-in-slot` | `replaceSampleInSlot` | SH:17 | kit, voice, slot, filePath | `DbResult<{sampleId}>` | 3 |
| `delete-sample-from-slot` | `deleteSampleFromSlot` | SH:22 | kit, voice, slot | `DbResult<{affectedSamples, deletedSamples}>` | 4 |
| `delete-sample-from-slot-without-reindexing` | `deleteSampleFromSlotWithoutReindexing` | SH:27 | kit, voice, slot | `DbResult<{deletedSamples}>` | 3 |
| `move-sample-in-kit` | `moveSampleInKit` | SH:44 (mode fixed to "insert") | kit, fromVoice, fromSlot, toVoice, toSlot | `DbResult<{affectedSamples, movedSample, replacedSample?}>` | 2 |
| `move-sample-between-kits` | `moveSampleBetweenKits` | SH:76 | `{fromKit, fromVoice, fromSlot, toKit, toVoice, toSlot, mode}` | `DbResult<...>` | 3 |
| `update-sample-gain` | `updateSampleGain` | DH:111 cDB | kit, voice, slot, gainDb | `DbResult` | 1 |
| `get-all-samples-for-kit` | `getAllSamplesForKit` | DH:247 cDB | kitName | `DbResult<Sample[]>` | 8 |
| `get-all-samples` | `getAllSamples` | DH:243 (**raw dbDir**) | dbDir | `DbResult<Sample[]>` | 0 |
| `get-sample-audio-buffer` | `getSampleAudioBuffer` | IH:133 | kit, voice, slot | `DbResult<ArrayBuffer\|null>` | 1 |
| `validate-sample-sources` | `validateSampleSources` | SH:107 | kitName | `DbResult<{invalidSamples, totalSamples, validSamples}>` | 0 |
| `get-audio-metadata` | `getAudioMetadata` | DH:314 | any filePath | `DbResult<AudioMetadata>` | 1 |
| `validate-sample-format` | `validateSampleFormat` | DH:318 | any filePath | `DbResult<{isValid, issues[], metadata?}>` | 1 |

Voice and slot numbers are range-checked for sample operations
(`sampleValidator.ts:208-226`), but the check accepts NaN and fractions.
Volume, gain, BPM and sample mode have no range or enum check in main.

### Banks and sync

| Channel | Bridge method | Handler | Arguments | Returns | Callers |
|---|---|---|---|---|---|
| `get-all-banks` | `getAllBanks` | DH:263 cDB | - | `DbResult<Bank[]>` | 0 |
| `update-bank` | `updateBank` | DH:270 cDB, then writes or removes the bank RTF file | letter, `{artist?, rtf_filename?}` | `DbResult<void>` | 1 |
| `scan-banks` | `scanBanks` | DH:309 | - | `DbResult<{scannedAt, scannedFiles, updatedBanks}>` | 2 |
| `generateSyncChangeSummary` | `generateSyncChangeSummary` | YH:12 | (contract declares sdCardPath; preload drops it; main ignores it) | `DbResult<{banks, fileCount, kitCount}>` | 1 |
| `startKitSync` | `startKitSync` | YH:19 | `{sdCardPath, wipeSdCard?}` | `DbResult<{syncedFiles}>` | 1 |
| `cancelKitSync` | `cancelKitSync` | YH:32 | - | `{success, error?}` | 1 (never reachable from the UI) |

The three sync channels use camelCase names. All other channels are
kebab-case.

### Main-to-renderer push channels

| Channel | Sent from | Preload listener | Payload | Consumer |
|---|---|---|---|---|
| `sync-progress` | `syncProgressManager.ts:157` to `getAllWindows()[0]` | `onSyncProgress` (no unsubscribe returned) | sync progress object | `useSyncUpdate.ts:122` |
| `archive-progress` | IH:188 (`event.sender.send`) | registered inside `downloadAndExtractArchive` | `{file?, percent, phase}` | setup wizard |
| `archive-error` | IH:193, 199 | same | `{message}` | setup wizard |
| `menu-about` | `applicationMenu.ts` | `MenuEventForwarder`, re-sent as a DOM `CustomEvent` | - | `main.tsx`, `useMenuEvents` |
| `menu-preferences` | `applicationMenu.ts` | same | - | `useMenuEvents` |
| `menu-scan-all-kits` | `applicationMenu.ts` | same | - | `useMenuEvents` |
| `menu-change-local-store-directory` | `applicationMenu.ts` | same | - | `useMenuEvents` |
| `menu-undo`, `menu-redo` | **never sent** (the Edit menu uses native roles) | same | - | `useMenuEvents` (dead) |

## Data Models

Defined in `shared/db/schema.ts` (Drizzle, SQLite). Primary keys are
natural where the hardware has a name. Foreign keys are declared but
**not enforced**: `PRAGMA foreign_keys` is off on purpose
(`dbUtilities.ts:93-95`), so there are no cascades.

### Bank
- **Fields**: `letter` (PK, A to Z), `artist`, `rtf_filename`, `scanned_at`.
- **Relationships**: has many kits.
- **Validation**: seeded A to Z by migration 0001. Artist names are not
  sanitised before they are used as file names.

### Kit
- **Fields**: `name` (PK, for example `A0`), `bank_letter` (FK), `alias`,
  `bpm` (default 120), `editable`, `is_favorite`, `locked`,
  `modified_since_sync`, `step_pattern` (JSON `number[][]`, 4 x 16
  velocities), `trigger_conditions` (JSON, 4 x 16 of `null` or `"A:B"`).
- **Relationships**: belongs to a bank; has many voices and samples.
- **Validation**: kit-name pattern is checked only in `kitService`. The
  setup wizard accepts other folder names. BPM is clamped to 30 to 180 in
  the renderer only.
- **Note**: real databases still have an old `kits.artist` column, which
  `schema.ts` no longer declares but the latest Drizzle snapshot still has.

### Voice
- **Fields**: `id` (PK), `kit_name` (FK), `voice_number` (1 to 4),
  `voice_alias`, `sample_mode` (`first`, `random`, `round-robin`),
  `stereo_mode`, `voice_volume` (0 to 100, default 100).
- **Relationships**: belongs to a kit.
- **Validation**: none in main. There is no unique index on
  (kit_name, voice_number).

### Sample
- **Fields**: `id` (PK), `kit_name` (FK), `voice_number`, `slot_number`
  (0 to 11), `filename`, `source_path` (absolute), `gain_db`
  (-24 to +12), `wav_bit_depth`, `wav_bitrate`, `wav_channels`,
  `wav_sample_rate`.
- **Relationships**: belongs to a kit; joins to its voice logically on
  (kit_name, voice_number).
- **Validation**: unique on (kit, voice, slot) and on
  (kit, voice, source_path). Adding a sample requires a `.wav` extension
  and a RIFF/WAVE header. There is no stereo flag: stereo is the voice's
  `stereo_mode` (RE-69 dropped `is_stereo`).

### KitWithRelations
A kit row plus its bank, voices and samples, built by batch queries and
joined in memory (`kitRelationalHelpers.ts`). `get-all-kits` returns every
kit with all samples.

### DbResult
```typescript
interface DbResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```
A single interface, not a discriminated union (`schema.ts:100-104`). Some
handlers throw instead of returning `success: false`: the kit lifecycle
channels on a bad name, both `validate-local-store` channels without a
path, `list-files-in-root`, and any exception inside a cDB handler.

## Known contract problems

These are listed in detail in code-quality-assessment.md.

- `SyncChangeSummary` in the contract does not match what main returns.
  The renderer works around it with an `as unknown as` cast.
- `SyncProgress` is defined four times with different fields and status
  values (`"complete"` from main, `"completed"` in the contract).
- `update-kit-metadata` advertises `artist`, `description` and `tags`,
  which are not columns. The handler spreads whatever object the renderer
  sends into the update, so the renderer could change `name`, `locked` or
  `bank_letter`.
- Seven bridge methods have no renderer caller: `getAllBanks`,
  `getAllSamples`, `getFavoriteKits`, `getKitsMetadata`, `getSetting`,
  `rescanKitsMissingMetadata`, `validateSampleSources`.
- The test mock `tests/mocks/electron/electronAPI.ts` is not checked
  against the contract. It is missing 10 methods and still has a removed
  one (`getAudioBuffer`).
