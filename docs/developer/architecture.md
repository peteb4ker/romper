<!--
layout: default
title: Romper Architecture
-->

# Romper Architecture

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
- **Typed wizard targets** (`localStoreAccessPrompt.ts`). A target folder the
  user typed rather than picked needs their OK in a native prompt shown by
  main (`requestLocalStoreAccess`). The filesystem root and the home folder
  (and anything above it) are refused. E2E tests answer the prompt with
  `tests/utils/e2e-dialogs.ts`.
- **Sample sources** (`sampleSourceAccess.ts`). Samples are referenced from
  wherever the user dragged them, so reading one file (`readFile`,
  `getAudioMetadata`, `validateSampleFormat`, the path given to
  `addSampleToSlot`/`replaceSampleInSlot`) is also allowed when the store's
  database already references it, or referenced it before an edit this
  session (so undo can put a sample back).
- The factory-samples archive URL is fixed in main
  (`getFactorySamplesArchiveUrl`, overridable only by the
  `ROMPER_SQUARP_ARCHIVE_URL` launch environment). Wizard database channels
  (`createRomperDb`, `insertKit`, `insertSample`) still name the new store's
  `.romperdb` folder because it isn't configured yet; main requires it to be
  a `.romperdb` folder inside a writable root, and an inserted sample's
  `source_path` to be inside a root. Other database channels derive the path
  from the configured store.

## Data

- SQLite at `<local store>/.romperdb/romper.sqlite`, accessed through Drizzle
  on the **synchronous** better-sqlite3 driver. Queries end in `.all()`,
  `.get()`, `.run()` or `.values()`; there is no `await` on the database.
- Tables: `banks`, `kits`, `voices` (4 per kit), `samples` (up to 12 per
  voice). Kits are keyed by their human-readable name (`A0`, `B12`), which
  other tables use as the foreign key. Slots are 0-based in the database.
  Details: [romper-db.md](romper-db.md).
- Migrations live in `electron/main/db/migrations/` (drizzle-kit).
- The `postinstall` step rebuilds better-sqlite3 for Electron's Node ABI. That
  is why integration tests run inside Electron (`ELECTRON_RUN_AS_NODE`)
  rather than plain Node.

Pass database shapes (e.g. `KitWithRelations`) down the component tree as
they are, and derive display data where it's consumed (e.g.
`extractVoiceNames` in `KitGridItem`), rather than reshaping them up front.

## Local store and samples

Setup creates a local store from an SD card, the Squarp factory samples, or
an empty folder. That baseline is never modified.

Samples the user adds are **referenced, not copied**: the database stores the
file's absolute `source_path`. Preview plays from that path; conversion and
copying happen only at sync time. Sync validation checks that referenced files
exist, but see RE-09 below.

## Kits

- Kit flags: `editable` (user kits on, factory kits off), `locked`,
  `is_favorite`, and `modified_since_sync`.
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
- User-facing messages go through `MessageDisplayContext` /
  `useMessageDisplay`.

## Playback

- **Voices are monophonic (voice choke).** Triggering a sample stops any other
  sample playing on the same voice (`handlePlay` in `useKitPlayback.ts`).
- Kit samples are loaded over IPC by kit / voice / slot
  (`getSampleAudioBuffer`) and played through an `AudioBufferSourceNode` into
  a `GainNode`. Channels that take a file path (`readFile`,
  `getAudioMetadata`) are scoped by main; see "The renderer is untrusted".
- Each voice picks a sample by `sample_mode`: `first`, `random`, or
  `round-robin`. A voice in slice mode then plays only a region of that
  sample (`PlayOptions.region`, offset + duration with ~2 ms anti-click
  fades).
- Sequencer timing: the step worker times each step from the start (no
  `setInterval` drift) and sends its ideal time. Every trigger is scheduled
  `SCHEDULE_AHEAD_MS` (80 ms) after that (`PlayOptions.startAt`), mapped to
  each `AudioContext` with `getOutputTimestamp()`, so voices land exactly on
  the grid regardless of React latency. Chokes and retriggers stop the old
  sound at the new one's start (`stopAt`), so scheduling never opens a gap.
  Clicked previews play immediately.

## Stereo

Stereo is a **voice** setting (`voices.stereo_mode`), not a sample property.
A stereo voice pairs with the next voice. Never infer stereo from a file's
channel count, and never copy samples to the adjacent voice based on the
sample's `is_stereo` flag; doing so created phantom samples that couldn't be
deleted. At sync, `syncMonoAnnotation.ts` marks stereo files on mono voices
for downmixing (channel average, in `formatConverter.ts`).

## Sync to SD card

`syncService.ts` orchestrates. Each sample is converted if needed
(`formatConverter.ts`) and written directly into its kit folder, named
`<voice>-<slot> <name>.wav` (`A0/1-01 KICK.wav`). That is the layout the
Rample firmware and Squarp's factory kits use: the first character is the
voice, and the zero-padded slot keeps the layer order. The naming and
voice-parsing rules live in `shared/rampleCardLayout.ts`, which sync, the
setup wizard's import and rescan share; the spec is
[sd-card-layout.md](sd-card-layout.md).

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
RE-62), with the same scaling as node-wav, which it replaced. A file
that isn't uncompressed PCM or float is refused when added and listed in
the write summary as a sample that can't be written; float files and
WAVE_FORMAT_EXTENSIBLE headers are converted to plain 16-bit PCM. A file
is never copied to the card unconverted when its conversion fails.

Sync doesn't block the main process (RE-07): file I/O is asynchronous and
`syncFileOperations.processAllFiles` yields to the event loop after every
file, so progress events and `cancelKitSync` are handled while it runs.
Cancel stops after the file in progress and returns a `cancelled` outcome.
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
- **E2E** (Playwright against the built app): `*.e2e.test.ts`, mostly in
  `tests/e2e/`. Only e2e exercises app startup.
- Unit coverage thresholds are in `vite.config.ts`.
