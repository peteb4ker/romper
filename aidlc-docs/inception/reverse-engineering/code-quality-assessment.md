# Code Quality Assessment

> Audit of `main` @ `87bea51` (app version 1.3.1), 2026-09-29. Five
> read-only reviews covered the main process and data layer, the IPC
> contract and security boundary, the renderer, the build / test / CI /
> release tooling, and the end-to-end business flows. Findings were
> confirmed by reading the code unless marked "suspected". The Critical
> finding (RE-01) and two of the High findings (RE-02, RE-11) were
> re-checked by hand.

## Top priorities

1. **RE-01** - Guard the "clear SD card" wipe. Today it deletes everything
   in whatever folder is picked, and the picker opens at the home folder.
2. **RE-02, RE-03** - Close the path from a stray local HTML file to
   arbitrary file writes: fix the `file://` navigation check and scope the
   file-system IPC channels to the local store.
3. **RE-04** - Stop "Scan All" and "Scan Kit" from silently discarding the
   user's kit edits.
4. **RE-05 to RE-09** - Make sync safe and honest: per-kit replacement,
   deletion of stale files, one card layout for import and export, no
   blocking of the main process, robust WAV parsing, and surfacing of
   errors instead of reporting success.
5. **RE-11, RE-12** - Reconnect the toast system and add an error boundary,
   so failures reach the user instead of vanishing or blanking the window.
6. **RE-15 to RE-18** - Upgrade Electron, fix auto-update, and make the
   release pipeline run tests and fail when signing credentials are
   missing (v1.3.1 for Windows shipped unsigned).

## Test Coverage

- **Overall**: Good by the numbers. Merged unit and integration coverage
  is 89.67% statements, 80.94% branches, 87.89% functions and 90.44%
  lines. The margin over the enforced thresholds is thin, and the most
  important user flows (editing, playback, sync edge cases) have little
  end-to-end coverage.
- **Unit Tests**: 238 files, 3,453 tests, all passing (57.7 s).

  | Metric | Measured | Threshold | Headroom |
  |---|---|---|---|
  | Statements | 84.67% | 84 | 0.67 |
  | Branches | 78.26% | 77 | 1.26 |
  | Functions | 82.28% | 82 | **0.28** |
  | Lines | 85.40% | 85 | **0.40** |

  Thresholds are enforced only by `test:unit`, which CI runs on pushes to
  `main`. Pull requests run the fast suite without coverage, so a drop
  below threshold is only found after merge.
- **Integration Tests**: 27 files, 534 tests, all passing (5.6 s), run
  inside Electron-as-Node. About 17% coverage on their own (no threshold).
- **E2E Tests**: 8 Playwright files, 24 tests, no skips. They cover the
  setup wizard, navigation, onboarding errors, fixtures and sync. They do
  not cover sample assignment, drag and drop, playback, favourites,
  preferences, format conversion, the menu or auto-update. E2E is not a
  required check.
- **Test health**:
  - No `.only`, `.skip` or `.todo` anywhere.
  - **Test code is never type-checked.** Adding the tests to a tsconfig
    produces 3,048 TypeScript errors in 195 test files.
  - `errorHandling.test.ts` tests a global mock, not the real module, which
    sits at 0% coverage.
  - `npm run coverage:total` prints "Unknown% (0/0)" because it reads the
    wrong folder.
  - Vitest 4 silently ignores `coverage.all`, `minWorkers` and
    `test.reporter` in the configs.
- **Lowest-covered production files** (merged, lines): `utils/errorHandling.ts`
  0%, `shared/errorUtils.ts` 15%, `wizard/WizardTargetStep.tsx` 25%,
  `main.tsx` 33%, `LocalStoreWizardUI.tsx` 38%,
  `db/sampleIpcHandlers.ts` 42%, `dbIpcHandlers.ts` 56%, `GainKnob.tsx`
  59%, `useKitViewMenuHandlers.ts` 65%, `services/syncService.ts` 67%.

## Code Quality Indicators

- **Linting**: Configured and clean. ESLint 9 flat config with
  typescript-eslint (including type-checked rules such as
  `no-floating-promises`), sonarjs (cognitive complexity 25), react-hooks,
  perfectionist and prettier. 0 findings. `no-explicit-any` is an error and
  production code has no `any`. Gaps: `scripts/**`, `*.mjs` and `*.cjs` are
  not linted; there is no `no-console` rule.
- **Code Style**: Consistent (Prettier, sorted imports). 16 NOSONAR
  markers; three of them hide true positives (dead props, RE-56).
- **Type safety**: `strict: true`. The bridge contract is enforced between
  preload and renderer, but not on the main-process handlers, and
  `SyncProgress` / `SyncChangeSummary` have drifted (RE-57).
- **Pre-commit**: husky blocks commits on `main` and runs typecheck, lint,
  the fast unit and integration suites, and a full build. The banner claims
  it runs SonarQube; it does not. `lint-staged` is configured but unused.
- **Documentation**: Fair to poor. The developer docs and the user manual
  describe several features that do not exist or work differently (see
  "Documentation drift").
- **Logging**: The main process uses a gated logger (77 calls) plus 48
  direct `console.warn/error`. The logger is on in packaged builds because
  `NODE_ENV` is undefined there. The renderer has 64 raw `console.*` calls
  in 23 files.
- **Size**: 9 main-process files and about 16 files overall exceed 300
  LOC. Largest: `KitGrid.tsx` 525, `KitVoicePanels.tsx` 485,
  `SyncUpdateDialog.tsx` 473, `StepSequencerGrid.tsx` 445,
  `useStereoHandling.ts` 416, `formatConverter.ts` 403,
  `scanService.ts` 391.

## Findings Register

Severity: **Critical** risks data loss or compromise in normal use.
**High** is a serious bug, security gap or delivery risk. **Medium** is a
real defect with a workaround or a limited blast radius. **Low** is hygiene.

### Critical

| ID | Area | Finding | Evidence | Fix |
|---|---|---|---|---|
| RE-01 | Sync | "Clear SD card before writing" deletes every file and folder at the chosen path. Nothing checks that the path is a card, that it is not the local store, the home folder or a parent of either, or that it looks like a Rample layout. The folder picker opens at the home folder, and the wipe runs before any file is copied. | `syncService.ts:183-185, 287-315`; `ipcHandlers.ts:44-60`; only guard is a checkbox (`SyncUpdateDialog.tsx:376-396`) | Refuse paths that are not a removable-volume root or that contain or sit inside the local store. Delete only Romper-managed entries (`[A-Z]\d+` folders and `? - *.rtf`). Ask for explicit confirmation naming the path. |

### High

| ID | Area | Finding | Evidence | Fix |
|---|---|---|---|---|
| RE-02 | Security | The `will-navigate` guard compares `URL.origin`, which is `"null"` for every `file://` URL. In packaged builds (`loadFile`), navigation to any local file passes as same-origin and that page gets the full `electronAPI`. There is no document-level drop guard and no sender check on IPC. (Exploit path suspected; the logic is confirmed.) | `electron/main/index.ts:151-168`, `:116` | For `file:` URLs compare the full path with the app's `index.html`, or move to a custom `app://` protocol. Block other navigations. Add a document-level `dragover`/`drop` guard. Check `event.senderFrame.url` in a shared handler wrapper. |
| RE-03 | Security | The renderer can read any file (up to 256 MiB), list any folder, create and copy folders, extract a downloaded archive into any folder, write a probe file anywhere, and create or insert into a database in any folder. Combined with RE-02, this turns a renderer compromise into persistent code execution (for example extracting into `~/Library/LaunchAgents`). | `ipcHandlers.ts:129-151, 180-226`; `dbIpcHandlers.ts:42-55, 243-245`; `archiveService.ts:19-71, 207-226` | Replace generic file tools with intent-level channels (for example `initializeLocalStore({source})`). Keep dialog-granted roots in main and confine paths to them. Fix the archive URL in main. Remove raw `dbDir` parameters. |
| RE-04 | Scan | "Scan Kit" on a non-editable kit, and "File > Scan All" on every kit, delete all of the kit's sample rows and rebuild them from `<store>/<kit>/*.wav`. In-app additions, gain, slot order and deletions are lost. No confirmation, no lock or editable check, no transaction, no 12-slot cap. | `scanService.ts:35-115, 306-353`; `useKitScan.ts:47-57` | Merge instead of rebuild: add new files, flag missing ones, keep user data. One transaction. Respect `editable`/`locked`. Cap at 12. Confirm before Scan All. |
| RE-05 | Sync | Sync only adds or overwrites. Removed, moved or renamed samples and deleted kits stay on the card. Two samples in one voice with the same file name (allowed, because uniqueness is on `source_path`) overwrite each other on the card. Slot order is not encoded in file names. | `syncSampleProcessing.ts:56-67`; `schema.ts:86-90` | Stage each kit and replace it as a whole; delete unplanned files inside managed kit folders; encode the slot in the file name; detect name collisions. |
| RE-06 | Sync | Sync writes `<card>/<kit>/<voice>/<file>`, but SD import and rescan read only WAVs at the kit root and take the voice from the first character of the file name. A card written by Romper cannot be re-imported (kits come back empty). The manual documents a third layout (`/KITS/...`). | `syncSampleProcessing.ts:63-66` vs `scanService.ts:69-75`, `kitUtilsShared.ts:4-19` | Define the card layout in one module used by sync, scan and import; read both layouts. Confirm what the Rample firmware expects. |
| RE-07 | Sync | Sync blocks the main process for the whole run: every file is copied or converted with synchronous calls, so no IPC (including Cancel) runs until it finishes. The Cancel button is also disabled while writing, and `cancelSync` has no caller. | `syncFileOperations.ts:97-156`; `formatConverter.ts:38-150`; `SyncUpdateDialog.tsx:410-414`; `useSyncUpdate.ts:164-172` | Use async file I/O and run conversion in a worker or utility process; yield between files; wire Cancel. |
| RE-08 | Sync | The WAV header parser requires the `fmt ` chunk at byte 12 with size 16. WAVE_FORMAT_EXTENSIBLE (size 40) and size-18 files raise "Only PCM format is supported", which the fallback does not catch, so the whole sync aborts (after a wipe, the card is left half-written). Files with a `JUNK` or `bext` chunk first are copied unconverted (no gain, no mono, possibly 24-bit or 48 kHz). Adding a sample only checks the RIFF/WAVE header, so these files are accepted. (How common this is: suspected.) | `audioUtils.ts:79-89`; `syncFileOperations.ts:62-80, 239-262`; `sampleValidator.ts:53-106` | Write a proper RIFF chunk walker that handles extensible and float formats; continue after per-file errors and report them; never copy a non-compliant file silently. |
| RE-09 | Sync | Validation errors (such as missing source files) and warnings are built and then dropped. Sync reports success with samples missing. | `syncService.ts:156-176, 205-207`; `syncSampleProcessing.ts:86-95` | Return and show them; block the sync (and especially the wipe) unless the user confirms. |
| RE-10 | Setup | If setup fails, the cleanup deletes `<target>/.romperdb` without checking that this run created it. Pointing the wizard at a folder that already has a store causes a primary-key clash on the first kit insert, setup fails, and the existing database is deleted. | `ipcHandlers.ts:223-226`; `fileSystemUtils.ts:166-192`; `useLocalStoreWizard.ts:141-145`; `kitCrudOperations.ts:39` | Refuse to set up in a folder that already has `.romperdb`; only delete a database created in this run; rename instead of delete. |
| RE-11 | Renderer | Toast messages never appear. `useMessageDisplay()` creates local state. `AppContent` creates one instance and renders it; `KitsView` creates a second instance, and every success and error message from `KitsView` and its children goes into that one, which is never rendered. | `views/KitsView.tsx:37`; `main.tsx:22, 37`; `useMessageDisplay.ts:31-32` | Have `KitsView` read the context (`useMessageApi`) instead of calling the hook. Add an e2e test that checks a toast appears. |
| RE-12 | Renderer | There is no React error boundary. Any exception during render unmounts the whole tree and leaves a blank window with no way to recover. | `main.tsx` (0 matches for boundary APIs in the renderer) | Add boundaries around the routes and around the editor and grid, with a reload / back fallback that logs the error. |
| RE-13 | Playback | The voice choke can fail after any kit refresh. Step, condition, mode, volume and alias edits reload all kits, which resets the "playing" map while samples are still playing, so the next trigger on that voice does not stop them. The trigger counters reset too, so a later stop can be ignored. (Audible effect suspected; the code path is confirmed.) | `useKitPlayback.ts:18-41`; `useKitNavigation.ts:54-62`; `SampleWaveform.tsx:248, 337` | Reset only when the kit changes; track "playing per voice" in a ref or a small audio engine instead of React state round-trips. |
| RE-14 | Playback | Each play connects a new analyser (and a splitter for stereo) to the slot's gain node, and nothing disconnects them. A slot triggered 8 times a second by the sequencer gathers hundreds of nodes a minute. Each slot also creates its own `AudioContext` (up to 48 per kit). (Performance impact suspected.) | `SampleWaveform.tsx:145, 253-288` | One shared `AudioContext`; create the analyser once per slot or voice and disconnect it on stop. |
| RE-15 | Platform | Electron 39.8.10 is out of support (its last patch was 2026-05-05; supported majors are 42 to 44). `npm audit` lists four High advisories against it, fixed only in 41.10.6+, 42.3.4+ or 43+. | `package.json`; `npm audit` | Upgrade to Electron 43 or 44 and run the e2e suite on all three platforms. |
| RE-16 | Platform | macOS auto-update does not work in packaged builds. The main process is built as a browser-style library, so the bundled `update-electron-app` gets an empty `node:assert` and a `require` shim that throws under ESM. The error is swallowed, and the unit test mocks the package. Confirmed by loading the built chunk in a real Electron ESM main process. | `vite.main.config.ts`; `electron/main/autoUpdater.ts:66-71` | Mark `update-electron-app` external (or build main for the Node platform); add a packaged smoke test that checks the "[AutoUpdate] Initialised" log. |
| RE-17 | Release | The release workflow runs no unit, integration or e2e tests and does not check that the tag is on `main` or that CI passed. The SonarCloud gate fails open: when the API returns nothing, the comparison errors and the gate passes. The gate's `STATUS` value is fetched but never used. | `.github/workflows/release.yml:31-48` | Make the build depend on the test workflows; check the tag is an ancestor of `main` and matches `package.json`; fail when the gate status is not `OK`. |
| RE-18 | Release | Signing is silently optional. Windows v1.3.1 shipped **unsigned** (the Azure step was skipped because `AZURE_CLIENT_ID` is empty). If `APPLE_CERTIFICATE` is missing, every macOS signing step is skipped and the release still publishes as "latest". v1.3.0 was lost to an expired Apple agreement with no pre-flight check. Even when enabled, Azure signs only `Setup.exe`, not the inner app executable (suspected). | `release.yml:131-256`; run 33775830910 log | Fail tag builds when signing secrets are missing; add a notary / credential pre-flight step; sign Windows binaries during packaging (Forge `windowsSign`); move to `Azure/artifact-signing-action@v2`. |
| RE-19 | Release | Release secrets are more exposed than needed: the base64 p12 is a job-level environment variable during `npm ci` (the lifecycle scripts of about 1,500 packages) on all three runners; checkout keeps the token while the workflow has `contents: write`; `id-token: write` is unused; third-party actions that receive secrets are pinned by tag, not by SHA. (Exploitation suspected; the configuration is confirmed.) | `release.yml:17, 86-88` | Scope secrets to the steps that use them; `persist-credentials: false`; least-privilege `permissions` per job; pin third-party actions by SHA; consider `npm ci --ignore-scripts` plus an explicit rebuild. |
| RE-20 | Docs | User-facing docs promise behaviour that does not exist. README, the manual and the website promise an automatic backup and rollback before sync; there is no backup code. `PRIVACY.md`, `SECURITY.md` and the getting-started page say the app makes no network requests and runs offline; it downloads the factory archive and polls for updates. | `README.md:56`; `docs/manual/syncing.md:39, 53-55`; `PRIVACY.md:12, 16`; `SECURITY.md:16` | Correct the docs now; decide separately whether to build a pre-sync backup. |
| RE-59 | Renderer | Escape on the sequencer's step-options popover also leaves the kit. The popover does not take focus, so the global back-navigation handler sees the step button as the target and navigates back while the popover closes. Verified in the running app. | `StepSequencerGrid.tsx` (`ConditionPopover`); `useGlobalKeyboardShortcuts.ts:40-56` | Focus the popover when it opens; let components that own Escape handle it first. See `docs/developer/sequencer-ux-review.md`. |
| RE-60 | Undo | Undo in the kit editor ignores the sequencer. Step, condition and slice edits are not on the undo stack, so Cmd/Ctrl+Z after editing the pattern undoes the last *sample* edit instead. The global undo listener runs in the capture phase on `document` and stops propagation, so the slicer's own Cmd/Ctrl+Z (undo roll, promised by its tooltip) never runs in an editable kit. Cmd/Ctrl+Z in a text field is also taken from the field. Verified in the running app. | `useGlobalKeyboardShortcuts.ts:96-118`; `useSlicerEditor.ts` (`handleGridKeyDown`); `useStepPattern.ts` | Record sequencer edits as undo actions; run the global listener in the bubble phase and skip handled events and text fields. See `docs/developer/sequencer-ux-review.md`. |

### Medium

| ID | Area | Finding | Evidence | Fix |
|---|---|---|---|---|
| RE-21 | Settings | Only `localStorePath` and `sdCardPath` are loaded at startup. Theme and "confirm destructive actions" reset on every launch and are erased from the file on the next write. A store on a drive that is not mounted at launch has its saved path erased permanently. Writes are not atomic. | `mainProcessSetup.ts:36-39, 138-158`; `settingsService.ts:81-89` | Load and merge all known keys; write through a temp file and rename; mark an unavailable store instead of erasing it. |
| RE-22 | IPC | `update-kit-metadata` spreads the renderer's object straight into the update. The renderer could rename the primary key (orphaning voices and samples, since foreign keys are off), clear `locked`, or change `bank_letter`. The advertised `artist`, `description` and `tags` are not columns. | `dbIpcHandlers.ts:64-80`; `kitCrudOperations.ts:283-305` | Allow only `alias` and `editable`; fix the contract. |
| RE-23 | Banks | Clearing a bank name deletes the RTF file but keeps the name in the database, so it returns on reload and is written to the card at the next sync. An artist containing `/` throws after the database update (unhandled rejection); `../` writes outside the store; the bank letter goes unescaped into a regular expression. RTF errors on the card are only logged. | `dbIpcHandlers.ts:270-307`; `rtfFileService.ts:16-53`; `crudOperations.ts:68-76` | Allow null to clear the artist; validate the letter (`^[A-Z]$`); sanitise the file name; escape the regex; write the file before committing. |
| RE-24 | Archive | The downloaded archive (about 313 MiB) is never deleted after a successful setup. There is no HTTP status check, redirect handling or timeout, and no checksum. Write and mkdir errors during extraction are only logged, so extraction can report success with files missing. | `archiveService.ts:46-53`; `archiveUtils.ts:60-76, 278-307` | Delete in `finally`; require status 200 and follow redirects; add a timeout; pin a SHA-256; fail extraction on write errors. |
| RE-25 | Validation | No range or enum checks in main for volume (0 to 100), gain (-24 to +12), BPM (30 to 180) or sample mode. Voice and slot checks accept NaN and fractions. The `voices` table has no unique (kit, voice) index. | `voiceCrudOperations.ts:32-108`; `sampleCrudOperations.ts:142-168`; `sampleValidator.ts:208-226` | Per-channel runtime validation in a shared handler wrapper; add the unique index. |
| RE-26 | Samples | Replace deletes the old sample, then adds the new one, with no transaction. The new file is validated only after the delete, so a bad file loses the slot and its gain. | `sampleService.ts:152-178` | Validate first, then run both steps in one transaction. |
| RE-27 | Samples | Moving a sample to another kit is not atomic and rebuilds the row from `source_path` only, dropping gain, WAV metadata and the stereo flag. An occupied destination slot causes a unique-constraint error. | `sampleBatchOperations.ts:137-226`; `sampleCrudService.ts:54-61` | One transaction that copies the full row. |
| RE-28 | DB | Multi-step writes run without a transaction: kit plus its four voices; delete plus reindex (the reindex opens a second connection while the first is open); write plus the modified flag; scan insert plus metadata. Only three operations use transactions. | `kitCrudOperations.ts:36-51`; `sampleCrudOperations.ts:62-85`; `sampleManagementOps.ts:146-187` | Pass a transaction handle through; move multi-statement writes into `withDbTransaction`. |
| RE-29 | Sync | Mono conversion is effectively dead. It runs only when `samples.is_stereo` is true, but that is `false` for every added or imported sample and is guessed from the file name on rescan (`/stereo\|st\|_s\./i`, which matches "stick" and "Stab"). A real stereo WAV on a mono voice is written unconverted. The voice lookup also splits paths on `/`, so it fails on Windows. | `sampleCrudService.ts:56`; `scanService.ts:317`; `syncMonoAnnotation.ts:23, 71` | Read the channel count from the WAV header when planning the sync; pass the voice number directly. |
| RE-30 | Config | `ROMPER_LOCAL_PATH` is honoured by kit and DB handlers but ignored by sample, scan, sync and audio-buffer code. With the variable set, reads and writes can hit different databases. The resolution logic is copied about 8 times. | `ipcHandlerUtils.ts:110-114`; `fileSystemUtils.ts:22-27`; `scanService.ts:258-264`; `syncService.ts:47, 143` | One `getEffectiveLocalStore()` in main, used everywhere. |
| RE-31 | Setup | A failed SD-card setup cannot be retried: the directory copy uses a non-recursive `mkdirSync`, which fails because the earlier cleanup left the copied kit folders behind. | `archiveService.ts:94-96` | Use recursive mkdir or `fs.cp`; clean up copied folders on failure. |
| RE-32 | Kits | Kit names are checked inconsistently. Import accepts names such as `Drum01`; `insert-kit` checks nothing; `kitService` rejects anything outside `^\p{Lu}\d{1,2}$`, so such kits cannot be deleted or duplicated. `\p{Lu}` also accepts non-ASCII capitals. | `kitService.ts:149-154`; `useLocalStoreWizardFileOps.ts:233` | One shared `^[A-Z]\d{1,2}$` check, applied at insert and import. |
| RE-33 | DB | Migration upkeep: 0008 is missing and there are two 0009 migrations, handled by a custom repair that runs `ALTER` statements outside a transaction. The latest snapshot still has `kits.artist`, which the schema removed, so the next `drizzle-kit generate` will produce a drop or table rebuild. Folders relative to the working directory are accepted as migration sources in production. No backup is taken before migrating. | `dbMigrations.ts:126-156, 193-272`; `migrations/meta/0011_snapshot.json` | Regenerate the snapshot; accept only the bundled path; copy the database before migrating. |
| RE-34 | Setup | Voice naming in the first-run wizard does nothing: its alias writes are rejected because the store path is saved only afterwards. Only a warning is logged. E2E hides this by setting `ROMPER_LOCAL_PATH`. | `useLocalStoreWizardScanning.ts:138-143`; `ipcHandlerUtils.ts:110-117`; `useLocalStoreWizard.ts:128-132` | Save the path (or pass the DB folder) before scanning. |
| RE-35 | Sync | "Modified since sync" is set only by sample add, delete and move. Gain, stereo mode, voice alias and bank edits do not set it, so the "Modified" filter misses changes that do alter the card. | `dbIpcHandlers.ts:96-207`; `kitSyncOperations.ts` | Mark the kit modified in every update that affects the card. |
| RE-36 | Performance | Almost every edit reloads the whole library (`getKits()` with all samples); sample operations cost three or more IPC calls. The DB layer opens a new connection per operation, sync queries each kit separately, and validation calls `existsSync` per sample. Slow for large libraries (the factory set has about 2,600 kits). | `useKitEditorLogic.ts:105-116`; `useKitDataManager.ts:171-188`; `syncSampleProcessing.ts:22-42` | Patch one kit from the update result; reuse `getKits` data; share a connection per request. |
| RE-37 | Renderer | Favourites have two sources of truth. The browser keeps a shadow map that overrides the database value; the editor toggles through `useKitDataManager`. After toggling in both places, the browser shows a stale star and filters wrongly. | `useKitFilters.ts:22-46, 66-99` | One toggle path; remove the shadow map. |
| RE-38 | Renderer | Keyboard shortcuts clash. "F" jumps to bank F and toggles the favourite on the focused kit. Handlers ignore modifier keys, so Cmd/Ctrl combinations and menu accelerators can also trigger bank jumps, sequencer toggles or kit navigation. | `useKitKeyboardNav.ts:28-44`; `useKitBankNavigation.ts:143-163`; `useKitEditorKeyboardNav.ts:56-81` | Ignore events with modifiers; give "F" one meaning; ignore keys while a modal is open. |
| RE-39 | Renderer | Kit-grid keyboard navigation is broken: index 0 is treated as "nothing focused", so arrow keys and Enter do nothing from the first kit (the default). Up and down use a flat index while rows are grouped by bank, so they land on the wrong kit. | `hooks/useKitGridKeyboard.ts:109, 123, 34-49` | Compare with `null`; navigate using the grid's row model. |
| RE-40 | Renderer | More silent failures: stereo link errors are ignored; rejected drops (duplicate, bad format, full voice) go only to the console; undo errors never reach the UI; the sync-failure toast reads a stale value. | `KitVoicePanels.tsx:151-206`; `useSampleProcessing.ts:58-112`; `useKitSync.ts:100` | Route them through the message API once RE-11 is fixed. |
| RE-41 | Renderer | Toggling "editable" and editing the kit alias rethrow IPC errors into click and blur handlers with no catch, giving unhandled rejections. | `useKitEditorLogic.ts:66-80`; `KitHeader.tsx:288` | Catch and report. |
| RE-42 | Setup | Truncation guidance ("some samples were skipped") is never shown after SD or factory imports, because the UI reads the warnings from before `initialize()` ran. | `LocalStoreWizardUI.tsx:107-119`; `useLocalStoreWizard.ts:119-135` | Return the warnings from `initialize()`. |
| RE-43 | Scan | "Scan All" from the menu scans only the kits that pass the current filters, and with the editor open it scans banks only. | `useKitViewMenuHandlers.ts:73-80`; `KitBrowser.tsx:186-194` | Drive the bulk scan from `KitsView` with the unfiltered list. |
| RE-44 | Settings | The "Confirm destructive actions" preference is shown but never read; sample delete and replace run immediately. | `SettingsContext.tsx:14, 256-279`; `useVoicePanelButtons.tsx:62-84` | Enforce it, or remove it. |
| RE-45 | Playback | Playback triggers and sample metadata are keyed by file name, so two samples with the same name in one voice play together (bypassing the choke), and same-named files in different voices share gain and metadata in the UI. | `useVoicePanelSlotRendering.tsx:94-97`; `useKitPlayback.ts:46`; `KitVoicePanels.tsx:238-253` | Key by voice and slot, or by sample id. |
| RE-46 | Performance | While a sample plays, the waveform redraws its full envelope and calls `getComputedStyle` on every animation frame. The LED logo runs a 60 fps loop even when idle. | `SampleWaveform.tsx:174-216`; `led-icon/useLedVisualization.ts:158-161` | Cache the envelope and draw only the playhead; pause the LED loop when idle. |
| RE-47 | Performance | Memoisation is defeated: inline props break `React.memo` on the containers and grid, the grid's `itemData` is rebuilt every render, and the menu and editor key listeners re-subscribe on every render. | `KitGrid.tsx:246, 471-493`; `useMenuEvents.ts:79`; `useKitEditorLogic.ts:195-200` | Memoise handlers and `itemData`; stable listeners. |
| RE-48 | Accessibility | A `grid` contains `option` children; the gain knob (`role="slider"`) has no keyboard support; 5 inputs have no label; trigger conditions can only be set by right-click; 6 modals have no dialog role, focus trap or Escape handling. | `KitGrid.tsx:502`; `GainKnob.tsx:163-178`; `StepSequencerGrid.tsx:83-88`; `CriticalErrorDialog`, `SyncUpdateDialog`, `InvalidLocalStoreDialog` and others | Fix roles and labels; keyboard support; a shared dialog component with a focus trap. |
| RE-49 | Dependencies | Build tools (`drizzle-kit`, `@tailwindcss/vite`, `@vitejs/plugin-react`, `@typescript-eslint/eslint-plugin`) and unused packages sit in `dependencies`. With no asar, the app ships about 180 MB of packages against about 14 MB needed. All 7 production-path audit advisories come through these packages. | `package.json:143-159` | Move or remove them; consider asar with `better-sqlite3` unpacked. |
| RE-50 | CI | Coverage thresholds are not checked on pull requests, and the margin is 0.28 points on functions and 0.40 on lines. | `.github/workflows/test.yml:48` | Run the coverage suite (or a coverage-diff check) on PRs. |
| RE-51 | Tests | Test code is excluded from type-checking; 3,048 errors in 195 test files. | `tsconfig.json` | Add a test tsconfig and a CI job, and burn the errors down. |
| RE-52 | CI | E2E is not a required check; PRs run it on Ubuntu only, with no retries. The docs say it is required. | branch protection; `e2e.yml` | Make `e2e-tests-check` required; add one retry in CI. |
| RE-53 | CI | SonarCloud never gates PRs (it runs on `main` only and is `continue-on-error`). The SonarCloud action is archived, the Azure signing action was renamed, other actions are 1 to 3 majors behind, and there is no `dependabot.yml`. | `test.yml:133, 213` | Run Sonar on PRs as a required check; switch to `sonarqube-scan-action`; add `dependabot.yml` for npm and GitHub Actions. |
| RE-54 | Dependencies | 30 packages are at least a major version behind. Forge 8 would clear 19 High advisories in the Forge chain. `moduleResolution: "node"` and `baseUrl` block TypeScript 7. | `npm outdated`; `tsconfig.json` | Upgrade in order: Electron, Forge 8, Vitest 5 / ESLint 10, then TypeScript 7 with `moduleResolution: bundler`. |
| RE-55 | Release | macOS builds are arm64 only; Linux and Windows are x64 only. Intel Macs are not supported, and this is not documented. | `release.yml:128, 201` | Add an x64 or universal macOS build, or document arm64-only. |
| RE-56 | Dead code | About 942 LOC of unused main-process files (`stereoSyncProcessor`, `rampleNamingService`, `db/fileOperations`, `stepPatternUtils`, `sampleSlotService`, two utils) and about 1,100 LOC in the renderer (9 test-only modules, the unreachable `AboutView` route and `ValidationResultsDialog`). 7 bridge methods have no caller; `menu-undo`/`menu-redo` are never sent. Dead props `onShowLocalStoreWizard`, `searchResultCount` and `onSampleKeyNav` are suppressed with NOSONAR as "API compatibility", which hides true positives for internal components. | see component-inventory.md | Delete the code and its tests; remove the dead props and those three NOSONARs. |
| RE-57 | Contract | The bridge contract does not bind main. `SyncChangeSummary` does not match what main returns (the renderer casts it); `SyncProgress` is defined four times with different fields and status values; several return types differ from the contract (null versus undefined, `unknown`, an `"overwrite"` mode main rejects). The test mock is not checked against the contract. | `shared/electronApi.ts:264-311`; `syncService.ts:25-29`; `syncProgressManager.ts:5-21`; `useSyncUpdate.ts:84` | Move main-side types into `shared`; type `ipcMain.handle` through a channel map; add `satisfies ElectronAPI` to the mock. |
| RE-58 | Tooling | The pre-commit tests fail with Vitest worker-start timeouts ("Timeout waiting for worker to respond") and 15 s test timeouts when the machine is busy (load average 21 to 46 on 2026-09-30, with several sessions testing at once). They pass on rerun. | `vitest.config.fast.ts` (`maxWorkers: 10`, `minWorkers: 4`) | Size workers from `os.availableParallelism()` or load, or use `--pool=forks` with fewer workers in `test:husky`. |

### Low

- **IPC hygiene**: some handlers throw instead of returning a `DbResult`
  (kit lifecycle channels on a bad name, both validate channels without a
  path, `list-files-in-root`, any exception in a cDB handler).
  `get-sample-audio-buffer` reads `source_path` with a plain
  `readFileSync`, bypassing the `read-file` guards, and `insert-sample` lets
  the renderer set any `source_path`. Channel names are duplicated string
  literals with mixed naming, and push channels have no parity test.
- **Settings and logging**: `write-settings` accepts any key and value;
  `settingsService` logs the whole settings object; the main logger is on
  in packaged builds.
- **Electron hardening**: no session permission handler (Electron approves
  requests by default); `frame-ancestors` in a `<meta>` CSP has no effect;
  the navigation guard forwards `http://` to the browser while
  `open-external` is https-only; test-only environment hooks
  (`ROMPER_TEST_MODE` and friends) work in packaged builds.
- **Main process**: database handles and file descriptors leak on error
  paths; the menu is built twice; the window icon path is never produced by
  the build; no single-instance lock (two instances can share a database
  and a card); no IPC handlers are registered if settings loading throws;
  the build targets `node18` while Electron ships Node 22; the sync
  summary's `hasConversions` is always false.
- **Renderer**: 64 raw `console.*` calls; undefined Tailwind classes
  (`text-accent-error`, and a Unicode minus in a shadow class); the
  `sync-progress` listener is never removed and some timers are never
  cleared; the sequencer uses `setInterval` without look-ahead and creates
  its worker inside `useMemo`; duplicated logic (two kit loaders, four copies
  of the slot sort, three space-to-play handlers, four local-store change
  flows); the grid scroll position is lost when returning from the editor;
  `isDarkMode` goes stale in "system" mode; the gain knob sends an IPC call
  on every mouse move.
- **Tooling**: `coverage:total` reads the wrong folder; the Sonar lcov path
  is declared twice; dead Vitest options; a global mock makes
  `errorHandling.test.ts` vacuous; the Forge ignore list ships `.claude/`,
  `aidlc-docs/`, `.aidlc-rule-details/` and TypeScript sources inside the
  app; phantom dependencies (including `chalk` in the release job); 10
  unused devDependencies; ESLint skips `scripts/`; stale scripts
  (`inspect-sample-gaps.js`, `monitor-app-state.js`,
  `release/validate.js`, suspected-broken `docs:check`/`docs:fix`);
  release-job leftovers (a full `npm ci` just for notes, dead msi and
  AppImage globs, unversioned `Romper.dmg`); no `engines` or `.nvmrc`;
  branch protection requires 0 approvals while the docs say reviews are
  required; `run-vitest-in-electron.cjs` exits 0 when the child is killed
  by a signal (suspected); the macOS entitlements are broader than Electron
  needs and their comments are wrong.

## Technical Debt

- **The IPC boundary is too generic and too trusting.** Generic file and
  database tools with renderer-chosen paths, no sender checks, almost no
  input validation, and a contract that main does not implement against
  (RE-02, RE-03, RE-22, RE-25, RE-57).
- **Sync was built as "copy everything"** and has not grown the change
  detection, deletion, staging, layout agreement or error reporting that a
  safe card writer needs (RE-01, RE-05 to RE-09, RE-29, RE-35).
- **Scan is a destructive rebuild** rather than a reconciliation (RE-04,
  RE-43).
- **Database access opens a connection per call**, most multi-step writes
  have no transaction, and the effective local store is resolved in about
  eight places (RE-28, RE-30, RE-36).
- **Renderer data flow**: full-library reloads after small edits, a
  separate favourites store, the disconnected toast store, and state-driven
  audio that breaks the choke rule (RE-11, RE-13, RE-36, RE-37).
- **Voice-panel rendering** is five layers of hooks that return JSX render
  functions, which is hard to follow and to memoise.
- **Release engineering** trusts optional secrets and a fail-open gate, and
  runs on an out-of-support Electron (RE-15 to RE-19).
- **Dead code and dead props** kept alive by tests and NOSONAR (RE-56).

## Patterns and Anti-patterns

- **Good Patterns**:
  - Sandboxed renderer, context isolation, a narrow preload that never
    exposes `ipcRenderer`, a hardened production CSP and Electron fuses.
  - Natural keys that mirror the hardware (`A0`, bank letters), with an
    explicit `voice_number` on every row.
  - A typed bridge contract with a channel-parity test.
  - Safe archive extraction (Zip-Slip and decompression-bomb limits).
  - The `DbResult` envelope and handler wrappers (where used).
  - Hook-based logic with focused hooks and composers.
  - Strict TypeScript with no `any`; clean ESLint with type-checked rules;
    a strong pre-commit hook; about 4,000 tests with high line coverage and
    property-based tests.
  - Signed, notarised and stapled macOS builds with per-helper
    entitlements, and a pinned `rcodesign` checksum.
- **Anti-patterns**:
  - Generic file-system IPC with renderer-supplied paths
    (`ipcHandlers.ts`, `dbIpcHandlers.ts`).
  - Destructive operations with weak guards (`wipeSdCard`, `rescanKit`,
    `cleanup-partial-init`).
  - Silent failure: swallowed errors, console-only rejections,
    validation results that are built and dropped
    (`syncService.ts:156-176`, `autoUpdater.ts:66-71`).
  - Synchronous heavy I/O in the main process (`syncFileOperations.ts`,
    `archiveService.copyDirectory`).
  - Delete-then-add without a transaction (`sampleService.replaceSampleInSlot`,
    `executeCrossKitMove`).
  - Duplicated types across the process boundary (`SyncProgress` four times).
  - Fire-and-forget IPC from UI events (gain knob).
  - Deriving facts from file names instead of file contents (`is_stereo`,
    voice number from the first character).
  - One `AudioContext` per UI element.
  - NOSONAR used to hide real dead code.

## Documentation Drift

Many developer and user docs no longer match the code. The most serious:

| Doc | Claim | Reality |
|---|---|---|
| `README.md`, `docs/manual/syncing.md`, website | Automatic backup and rollback before sync | No backup code exists (RE-20) |
| `PRIVACY.md`, `SECURITY.md`, getting-started | No network use, fully offline | Factory download and auto-update (RE-20) |
| `docs/manual/syncing.md:42, 49-50` | Labels written to `.rample_labels.json`; files under `/KITS/...` | No labels file; files go to `<card>/<kit>/<voice>/` (RE-06) |
| `docs/manual/syncing.md:20, 26-32` | Validation blocks the sync and shows a results dialog | Only existence and format are checked, and errors are dropped (RE-09) |
| `docs/manual/kit-editor.md:82-84`; `docs/developer/architecture.md:116-117` | Global "treat stereo as mono" setting with per-sample override | Removed; stereo is per voice |
| `docs/manual/kit-browser.md:114`; `keyboard-shortcuts.md` | Scan "analyses filenames and extracts metadata" | Scan rebuilds sample rows and discards edits (RE-04) |
| `docs/developer/architecture.md:72, 98` | Undo history persisted in the database | `edit_actions` was dropped in migration 0005; undo is in memory |
| `docs/developer/architecture.md:126-146` | Atomic sync with temp files, locking, rollback | Direct sequential writes (RE-05, RE-07) |
| `docs/developer/architecture.md:181-182` | Path validation blocks unauthorised access | Channels accept any path (RE-03) |
| `docs/developer/romper-db.md:41`, `romper-db.mmd`, `romper-db-erd.png` | `kits.voice_volume`; `Kit.id`, `Sample.kit_id`, no Bank or Voice | Wrong columns and a 2025-era diagram |
| `docs/developer/development-workflow.md:23-29, 402` | Pre-commit runs SonarCloud; e2e and Sonar are required checks | Neither is true |
| `README.md:99, 184`; getting-started | Linux AppImage; Node 18+ | No AppImage; Node 20.19+ / 22.12+ needed |
| `docs/developer/code-signing.md:95-97, 144-145` | `APPLE_ID` secrets | Obsolete; `ASC_API_KEY_JSON` is what notarisation uses |

About 40 more drift items of medium or low severity were found in
`docs/developer/*.md` and `docs/manual/*.md` (renamed UI labels, missing
buttons, stale file names and line counts). These docs need a dedicated
update pass.

## Changes since the 2026-04-08 assessment

- Tests grew from 3,383 unit and 204 integration tests to 3,453 and 534;
  e2e was consolidated from 21 files to 8. Coverage thresholds were
  re-baselined for Vitest 4's v8 remapping (from 85/85/80/85 to
  84/77/82/85).
- `syncService.ts` shrank from about 870 to 338 LOC, and `sampleMovement.ts`
  now has tests. The main process has no `console.log` left.
- The `.agent/` folder referenced in the previous assessment no longer
  exists.
- The merged-coverage report still prints 0/0; the cause is a wrong folder
  in `coverage:total`, not the coverage itself.
- New since then: sandboxing, navigation hardening, fuses, archive limits,
  macOS signing with rcodesign, the auto-updater (currently broken) and the
  DevTools opt-in.
