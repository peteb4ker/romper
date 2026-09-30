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
  a `GainNode`. Other channels (`readFile`, `getAudioMetadata`) still take
  raw paths and aren't scoped (RE-03).
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
(`formatConverter.ts`) and written to `<card>/<kit>/<voice>/<original file
name>` (`syncSampleProcessing.ts`). The user can choose to wipe the card
first; `sdCardSafety.ts` guards which folders may be cleared.

Known gaps, tracked in the findings register
([aidlc-docs/inception/reverse-engineering/code-quality-assessment.md](../../aidlc-docs/inception/reverse-engineering/code-quality-assessment.md)):

- **RE-06:** scan and SD import read WAVs at the kit root and take the voice
  from the file name's first character, so a card written by sync can't be
  re-imported. `rampleNamingService.ts` implements flat
  `{voice}sample{slot}.wav` naming, but nothing on the sync path calls it
  (nor `stereoSyncProcessor.ts`).
- **RE-09:** validation results are built and then dropped, so sync can
  report success with samples missing.

## Testing

- **Unit** (jsdom): `__tests__/` next to the source. Shared mocks live in
  `tests/mocks/` and are wired up in `vitest.setup.ts`; tests override them
  with `vi.mocked(globalThis.electronAPI.someMethod)` (assigning
  `window.electronAPI` is a lint error in tests).
- **Integration** (Node inside Electron): `tests/integration/*.integration.test.ts`.
- **E2E** (Playwright against the built app): `*.e2e.test.ts`, mostly in
  `tests/e2e/`. Only e2e exercises app startup.
- Unit coverage thresholds are in `vite.config.ts`.
