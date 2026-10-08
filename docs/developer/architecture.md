<!--
layout: default
title: Romper Architecture
-->

# Romper Architecture

Which place owns each concept (bank, kit, voice, sample, setting, the
card, undo, the IPC contract), every copy of it and where they disagree is
in [domain-model.md](domain-model.md).

## Layout

| Path | What lives there |
| --- | --- |
| `app/renderer/` | React UI: `views/`, `components/`, hooks in `components/hooks/<domain>/`, `styles/` |
| `electron/main/` | Main process: IPC handlers, database (`db/`), services (`services/`), format conversion |
| `electron/preload/` | The `contextBridge` bridge between renderer and main |
| `shared/` | Types, the Drizzle schema (`shared/db/schema.ts`), the IPC contract (`shared/electronApi.ts`), error helpers |
| `tests/` | `integration/`, `e2e/`, shared `mocks/`, `factories/`, `fixtures/` |

Imports use the `@romper/app/*`, `@romper/electron/*` and `@romper/shared/*`
aliases. Dependency direction: `electron/main` imports only from `shared`,
and `shared` imports from nothing else in the repo.

## Process split and IPC

- **Main** owns the database, the file system, format conversion, and SD
  card sync.
- **Renderer** owns the UI and audio playback (Web Audio).
- **Preload** exposes three globals via `contextBridge`:
  `electronAPI` (the IPC surface), `electronFileAPI` (file-drop helpers), and
  `romperEnv` (environment flags). Renderer code reaches them through
  `globalThis.electronAPI`.

`shared/electronApi.ts` is the single contract for `electronAPI`. The preload
implements it with `satisfies ElectronAPI`, and the renderer's global
declaration imports the same type, so drift is a compile error.
`tests/unit/ipcChannelParity.test.ts` checks that every channel the preload
invokes has a matching `ipcMain.handle` in main. Handlers are registered in
`electron/main/ipcHandlers.ts`, `dbIpcHandlers.ts`, and `electron/main/db/*IpcHandlers.ts`.

Database operations return `DbResult<T>` (`{ success, data?, error? }`);
`shared/errorUtils.ts` has `createErrorResult`, `getErrorMessage` and
`logError` for building them.

### The renderer is untrusted

Main treats every IPC argument as hostile (RE-02, RE-03). Code for this lives
in `electron/main/security/`.

- **Sender check** (`ipcSender.ts`). Before any handler is registered,
  `index.ts` wraps `ipcMain.handle` so every handler first checks
  `event.senderFrame`: it must be the top-level frame showing the app's own
  page (the Vite origin in dev, the bundled `index.html` file URL otherwise;
  the same `isAllowedAppNavigation` test the navigation guard uses).
  Anything else throws before the handler runs. New handlers get this for
  free; don't register them before `registerAllIpcHandlers`.
- **Path authorization** (`pathAccess.ts`). A channel that takes a filesystem
  path checks it with `checkPathAccess(p, { write })` (or
  `pathAccess.assertAllowed`) before touching the disk. The path is resolved
  (`..` removed, symlinks resolved through the nearest existing ancestor,
  dangling links refused) and must sit inside a root:
  - read and write: the local store (`ROMPER_LOCAL_PATH`, then settings), the
    SD card (`ROMPER_SDCARD_PATH`, then settings), `~/Documents/romper` (the
    wizard default), and any folder the user picked in one of main's folder
    dialogs this session;
  - read only: files the user dropped this session (the preload reports the
    path `webUtils.getPathForFile` returns, over `register-dropped-file`).
  - `write-settings` checks `localStorePath` and `sdCardPath`, so the
    renderer can't grant itself a root.

  The check is asynchronous (`fs.promises`) and runs under the card
  watchdog (`withCardWatchdog`), so a path on a card whose driver stopped
  responding is refused with the card-not-responding message instead of
  blocking the main process (#714). Await it.
- **Typed wizard targets** (`localStoreAccessPrompt.ts`). A target folder the
  user typed rather than picked needs their OK in a native prompt shown by
  main (`requestLocalStoreAccess`). The filesystem root and the home folder
  (and anything above it) are refused. E2E tests answer the prompt with
  `tests/utils/e2e-dialogs.ts`.
- **Sample sources** (`sampleSourceAccess.ts`). Samples are referenced from
  wherever the user dragged them, so reading one file
  (`validateSampleFormat`, the path given to
  `addSampleToSlot`/`replaceSampleInSlot`) is also allowed when the store's
  database already references it, or referenced it before an edit this
  session (so undo can put a sample back).
- The factory-samples archive URL is fixed in main
  (`getFactorySamplesArchiveUrl`, overridable only by the
  `ROMPER_SQUARP_ARCHIVE_URL` launch environment). Wizard database channels
  (`createRomperDb`, `setupImportKit`) still name the new store's `.romperdb`
  folder because it isn't configured yet; main requires it to be a
  `.romperdb` folder inside a writable root, and imports kits only into a
  store this setup created, from folders named like kits (A0-Z99). Other
  database channels derive the path from the configured store.
- Setup imports each kit in main (`LocalStoreSetupService.importSetupKit`,
  RE-34) with the same merge a rescan uses (`mergeKitScan`): up to 12
  samples per voice in card order, WAV metadata, and voice names inferred
  from file names, in one transaction per kit. The renderer only drives the
  steps and shows progress and the "samples left out" notice.
- Setup can be cancelled (RE-66). `cancel-setup` aborts main's setup signal,
  which stops the archive download or extraction in progress, and the wizard
  stops before its next step or kit. Main records the top-level entries
  setup writes into the target (`trackCreatedEntries`, around extraction and
  each SD-card kit copy); cleanup after a cancelled or failed setup, or on
  quit, removes only those and moves the database aside, so the same folder
  can be set up again. Entries that were there before are never touched.

## Data

- SQLite at `<local store>/.romperdb/romper.sqlite`, accessed through Drizzle
  on the **synchronous** better-sqlite3 driver. Queries end in `.all()`,
  `.get()`, `.run()` or `.values()`; there is no `await` on the database.
- Tables: `banks`, `kits`, `voices` (4 per kit), `samples` (up to 12 per
  voice). Kits are keyed by their human-readable name (`A0`, `B12`), which
  other tables use as the foreign key. Slots are 0-based in the database.
  Details: [romper-db.md](romper-db.md).
- Migrations live in `electron/main/db/migrations/` (drizzle-kit). An
  upgrade runs in one transaction after saving a copy of the database
  (RE-33); see [romper-db.md](romper-db.md#migrations-and-upgrades).
- **One connection per store** (RE-81). The first operation on a store opens
  it in WAL mode, applies pending migrations and keeps the connection
  (`db/utils/dbConnections.ts` holds them). It's closed when the local store
  setting changes, before setup cleanup moves a failed store aside, before
  a database file is deleted, and on `will-quit`, which also checkpoints the
  write-ahead log into the file. Windows can't delete or rename an open
  database, so anything that does must call `closeDbConnection` first.
  Integration tests don't need to: the shared teardown closes every
  connection when each test ends, before the test's own cleanup deletes
  its temp store (see [Testing](#testing)).
  `busy_timeout` stays: there's no single-instance lock, so another Romper
  or a tool can hold the write lock.
- **A unit of work per change** (RE-28). `withDb(dbDir, fn)` runs reads and
  single statements; `withDbTransaction(dbDir, fn)` runs `fn` as one
  transaction (`BEGIN IMMEDIATE`) and is reentrant: called inside another,
  it becomes a savepoint. Multi-step writes are `fooTx(db, …)` cores that
  take the handle (`RomperDb`) and throw on failure, so an operation
  composes them in one `withDbTransaction`: a kit with its voices, a delete
  with its reindex, every sample edit with the kit's modified flag, a setup
  import with its scan merge. Replace is one in-place update of the row
  (slot and gain stay; the new file's header is stored), and a move
  between kits moves the row itself, so gain and WAV metadata go with it
  (RE-26, RE-27). Undo keeps the full rows of the voices an edit touches
  (`VoiceSnapshot` in `shared/undoTypes.ts`) and puts them back with one
  `restoreVoicesTx` call (RE-86). An add stores the WAV header its
  validation read (RE-89).
- better-sqlite3 ships N-API prebuilds (`prebuilds/<platform>-<arch>.node`)
  that load in both Node and Electron, so nothing is rebuilt at install
  (Forge's `rebuildConfig` rebuilds no modules). Its npm package carries
  every platform's prebuild; Forge's `packageAfterPrune` hook
  (`scripts/prune-sqlite-prebuilds.cjs`) keeps only the target's, which is
  the one `lib/binding.js` loads (#694). Integration tests run
  inside Electron as Node (`ELECTRON_RUN_AS_NODE`, via
  `electron/run-vitest-in-electron.cjs`), so they use the Node that ships
  with Electron.

Pass database shapes (e.g. `KitWithRelations`) down the component tree as
they are, and derive display data where it's consumed (e.g.
`extractVoiceNames` in `KitGridItem`), rather than reshaping them up front.

## Local store and samples

Setup creates a local store from an SD card, the Squarp factory samples, or
an empty folder. Romper never changes the sample files in that baseline; apart
from its database in `.romperdb/`, the only files it writes there are the
bank name `.rtf` files.

Samples the user adds are **referenced, not copied**: the database stores the
file's absolute `source_path`. Preview plays from that path; conversion and
copying happen only at sync time. Sync validation checks that each
referenced file exists and is a WAV Romper can read; samples that fail are
listed in the write summary, and nothing is written until the user agrees
to skip them (RE-09).

## Kits

- Kit flags: `editable` (on for kits the user creates or duplicates, off
  for kits imported at setup), `locked` (scan and kit delete respect it,
  but nothing in the UI sets it), `is_favorite`, and
  `modified_since_sync`.
- Each kit stores its step-sequencer pattern (`step_pattern`), A:B trigger
  conditions (`trigger_conditions`), both JSON, and `bpm`.
- The sequencer slicer adds per-step slice data (`slice_steps`, JSON, in
  ticks of 384 per sample so the kit-wide `slicer_division` can change
  without losing data) and per-voice `slice_*` settings. See
  [step-sequencer-slicer.md](step-sequencer-slicer.md).
- Undo/redo is renderer state (`hooks/shared/useUndoRedoState.ts`); it is not
  persisted.
- **Scanning merges, it never rebuilds** (`mergeKitScan` in
  `db/operations/kitScanOperations.ts`, one transaction per kit). Existing
  sample rows keep their slot, voice, gain and `source_path`; a row whose
  file is gone is reported as missing, not deleted. Unreferenced
  voice-prefixed WAVs in `<store>/<kit>/` are added to **non-editable** kits
  only, in the lowest free slot, never past 12 per voice. Editable kits own
  their sample list, so new folder files are reported but not added (adding
  them would undo in-app deletions). Locked kits are not touched. Voice
  names are inferred only for voices without one. "Scan All" asks for
  confirmation first.
- User-facing messages go through `MessageDisplayContext`: components call
  `useMessageApi()`. `useMessageDisplay()` creates the message state and is
  called once, in `main.tsx`; a second call makes a separate store that
  nothing renders (RE-11).

## Playback

- **Voices are monophonic (voice choke).** Triggering a sample stops any other
  sample playing on the same voice. `claimVoice` in `voiceChoke.ts` enforces
  it at the audio layer for every sound; `handlePlay` in `useKitPlayback.ts`
  also chokes the samples it started, through React state keyed by slot that
  kit reloads don't reset (RE-13, #497). This is Romper's design; the Rample manual doesn't describe a choke, so
  whether the module does the same is unverified on hardware.
- Kit samples are loaded over IPC by kit / voice / slot
  (`getSampleAudioBuffer`) and played through an `AudioBufferSourceNode` into
  a `GainNode`. All slots share one `AudioContext`
  (`utils/sharedAudioContext.ts`, RE-14) and never close it; each slot
  disconnects its own gain and meter nodes when its sample changes or it
  unmounts. The renderer can't read a sample file by path: buffers come
  from main by kit / voice / slot. Channels that take a sample's path
  (`validateSampleFormat`, add and replace) are scoped by main; see "The
  renderer is untrusted".
- Playback follows the voice's stereo setting, as the write does (#569). A
  voice that isn't in a stereo pair once the write's automatic links are
  made (`planKitStereo(...).links`) plays a sample with more than one
  channel mixed down to mono: the channel average, as `formatConverter.ts`
  writes it (`bufferForVoice` in `monoMixdown.ts`, once per load or link
  change). The meters show what plays, and are rebuilt when that changes.
- Each voice picks a sample by `sample_mode`: `first`, `random`, or
  `round-robin`. A voice in slice mode then plays only a region of that
  sample (`PlayOptions.region`, offset + duration with ~2 ms anti-click
  fades).
- Sequencer timing: the step worker times each step from the start (no
  `setInterval` drift) and sends its ideal time. Every trigger is scheduled
  `SCHEDULE_AHEAD_MS` (80 ms) after that (`PlayOptions.startAt`), mapped to
  the shared `AudioContext`'s clock with `getOutputTimestamp()`, so voices land exactly on
  the grid regardless of React latency. Chokes and retriggers stop the old
  sound at the new one's start (`stopAt`), so scheduling never opens a gap.
  Clicked previews play immediately.

## Stereo

Stereo is a **voice** setting (`voices.stereo_mode`), not a sample property.
That's Romper's design, chosen to stop phantom samples; the Rample manual
says only "A stereo sample will fill 2 mono voices." and "All layers must be
of the same type (mono OR stereo) in a voice." A stereo voice pairs with
the next voice. Never infer stereo from a file's
channel count, and never copy samples to the adjacent voice because a file
is stereo; doing so created phantom samples that couldn't be deleted.
Samples carry no stereo flag (RE-69 dropped `samples.is_stereo`). Unlinking
only clears `stereo_mode`, and main refuses samples on the right-hand voice
of a linked pair (`validateVoiceNotLinkedPartner`). When a sync is planned, `syncMonoAnnotation.ts` marks files with
more than one channel (read from the file's header) on voices that aren't
linked for downmixing (channel average, in `formatConverter.ts`), so the
summary shows the conversion too (RE-29); that never changes the voice's
setting.

Pete's "Final stereo rules v2" on #537 (in the Stereo section of
[domain-model.md](domain-model.md#stereo)) decide the rest, all through
`shared/stereoLinkRules.ts`: `planKitStereo` gives a kit's automatic links,
mixdowns and quarantine problems, and `checkStereoLink` says when a voice
can be linked by hand (main's `updateVoiceStereoMode` refuses any other
link, #541). Setup (`mergeKitScanTx` with `linkStereoVoices`) and the write
(`planWriteStereo` in `syncStereoPlan.ts`, then
`linkVoicesAutomaticallyTx`) make the automatic links; the write records
its links only once every file is written, with the synced flags in one
transaction, so a cancelled or failed write leaves none. A scan only
reports. The write leaves a quarantined kit's files out and keeps its card
folder (`CardContents.keepKits`), and lists links, mixdowns and quarantine
in its summary (`SyncChangeSummary.stereo`). The user's own choice is
`voices.stereo_choice`, set by linking, unlinking and a drop's **Link** or
**Keep mono** (a `ModalDialog` in `KitVoicePanels`, through
`useExternalDragHandlers`' `stereoDrop`). The voice panels note a mixed-down
voice, label an automatic pair and a mono sample in a pair, and show the
quarantine notice.

## Sync to SD card

`syncService.ts` orchestrates. Each sample is converted if needed
(`formatConverter.ts`) and written directly into its kit folder, named
`<voice>-<slot> <name>.wav` (`A0/1-01 KICK.wav`). That is the layout the
Rample firmware and Squarp's factory kits use: the first character is the
voice, and the zero-padded slot keeps the layer order. The naming and
voice-parsing rules live in `shared/rampleCardLayout.ts`, which sync, the
setup wizard's import and rescan share; the spec is
[sd-card-layout.md](sd-card-layout.md).

A file the card already holds byte for byte isn't written again (#650,
`cardFileMatch.ts`). A copied sample is compared with its card file
(size first, then contents); a converted one is encoded in memory and
compared before it's written. An SD card reads far faster than it
writes, and each write costs a FAT update and, now and then, a stall
while the card flushes, so writing an unchanged store again takes
seconds rather than minutes. A failed read of the card copy counts as a
mismatch, so the file is written as before.

The card mirrors the store. Once every file is written (and only if the
sync wasn't cancelled), sync deletes the Rample content the store no
longer has: kit folders, anything inside a kit folder that isn't one of
its samples, and bank name files (`sdCardSafety.findStaleCardEntries`).
The write summary lists the same entries first. Sync never touches the
device's `_save/` folder or anything else on the card.

WAV headers are read by walking RIFF chunks (`wavHeader.ts`, RE-08), so
`fmt ` and `data` can sit anywhere: Squarp's factory kits have `junk`
chunks, and other tools write `JUNK`, `bext` or `LIST` chunks and 18- or
40-byte `fmt ` chunks. Metadata, conversion and adding a sample all use
it. Conversion decodes and encodes samples in-repo (`wavCodec.ts`,
RE-62), with the same scaling as node-wav, which it replaced, but
rounding to the nearest step when it encodes (RE-63), so an unchanged
sample comes back exactly. A file that isn't uncompressed PCM or float
is refused when added and listed in the write summary as a sample that
can't be written; float files and WAVE_FORMAT_EXTENSIBLE headers are
converted to plain 16-bit PCM. A file is never copied to the card
unconverted when its conversion fails.

Sync doesn't block the main process (RE-07): file I/O is asynchronous and
`syncFileOperations.processAllFiles` yields to the event loop after every
file, so progress events and `cancelKitSync` are handled while it runs.
Cancel stops after the file in progress and returns a `cancelled` outcome.
Removing what the store no longer has is asynchronous too, one entry at a
time with a yield between entries (#653, `sdCardSafety.removeCardEntries`):
a synchronous recursive delete of kit folders froze the window on a slow
card. Once every file is written, the write sends a `finalizing` progress
event, so the dialog leaves the last file's count, then `removing` events
with a count (`removal`, throttled like file progress) that the panel
shows as "Removing old kits… 3/40", and `finalizing` again while it
records the write; Cancel stops between
removals, and the next write removes the rest. The bank name files at the
card root are written and replaced with `fs.promises` too (#656,
`rtfFileService.writeAllBankRtfFiles`), and so is resolving the card's
path when the write checks its target (`validateSdCardTarget`). Each card
operation (resolving the card's path, a file written, a bank name file
written or removed, an entry removed) has a watchdog (`cardWatchdog.ts`,
60 s): a card whose driver stops responding fails the write with a
message saying so, instead of freezing the window or leaving the write
waiting. The pending operation can't be cancelled:
its thread pool thread returns only when the driver does, and until then
quitting may wait on it too.

On a FAT or exFAT card, macOS keeps extended attributes in an AppleDouble
file (`._<name>`) beside each file. It tags every file a downloaded app
creates with `com.apple.provenance`, which can't be removed, so every
sample written gets a `._` file whatever the copy method. The write
removes it as each file is written (`removeAppleDoubleCompanion`), and the
stale-entry check still lists any other `._` file in a kit folder. macOS's
own folders at the card root (`.fseventsd`, `.Spotlight-V100`, `.Trashes`)
aren't Rample content and are left alone.
Converting a file is synchronous CPU work, but short (about 0.1 s for a
3-minute stereo 24-bit file), so it runs in the main process.

Progress reaches the renderer at most every 50 ms (RE-61):
`syncProgressManager` sends per-file progress on a leading-edge throttle
and holds the newest skipped update until the interval ends. The first
update, the last file's count, completion and errors go out at once.
In the renderer, progress lives in a small store (`syncProgressStore.ts`),
not React state, and only the write panel (`LiveSyncUpdateDialog`)
subscribes to it, so an update doesn't re-render the kit browser or the
grid behind the panel.

The main process is built for Node (`vite.main.config.ts`, RE-16): Node
built-ins and every package in `dependencies` stay as imports and load
from Node and the packaged `node_modules` at runtime. So a package main
imports must be in `dependencies`, not `devDependencies`; the e2e
`main-bundle` test checks this, and that the bundle has no browser stubs
or `require` shims.

## Testing

- **Unit** (jsdom): `__tests__/` next to the source. Shared mocks live in
  `tests/mocks/` and are wired up in `vitest.setup.ts`; tests override them
  with `vi.mocked(globalThis.electronAPI.someMethod)` (assigning
  `window.electronAPI` is a lint error in tests).
- **Integration** (Node inside Electron): `tests/integration/*.integration.test.ts`.
  They run on Vitest's default runner extended by
  `tests/integration/support/runner.ts`, which closes every store
  connection when a test's body ends, passed or failed, and before any
  `afterEach` hook, so a test's cleanup can delete its temp store on
  Windows. (An `afterEach` in a setup file can't: Vitest runs a test's own
  `afterEach` hooks first.) `tests/integration/support/setup.ts` hands the
  runner the test file's connection registry.
  `createTempStore`/`removeTempStore` (`tests/integration/support/tempStore.ts`)
  make and delete temp stores; `removeTempStore` closes connections again
  first, so it's also safe in `afterAll`.
- **E2E** (Playwright against the built app): `*.e2e.test.ts`, mostly in
  `tests/e2e/`. Only e2e exercises app startup.
- Unit coverage thresholds are in `vite.config.ts`.
