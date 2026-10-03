# Architecture review: performance and non-functional qualities

October 2026. Reviewed at `a37229af`. Findings cite the register
([`code-quality-assessment.md`](../../aidlc-docs/inception/reverse-engineering/code-quality-assessment.md));
this review adds RE-81 to RE-89.

## Summary

The architecture grew one feature at a time over about 18 months, and it
shows in three ways:

- **Each layer adds its own indirection.** A sample delete passes through
  about 8 modules and 5 classes before any SQL runs.
- **Every database call opens its own connection.**
- **The renderer refreshes by reloading everything.** It also keeps four
  copies of the sample data.

At factory scale (183 kits, 2,366 samples) on an Apple-silicon Mac, the app
is responsive. Cold start takes about 410 ms. A typical edit uses 15–45 ms of
main-process time. Most of the cost is not what a user feels today:

1. **One real freeze.** Opening the write summary blocks the main process for
   about 450 ms, during which every IPC call and window event waits. That
   time grows with library size and with the card's speed (RE-82).
2. **Waste that grows with the library.**
   - Each edit moves the whole library over IPC: 1.5 MB per `getKits`, twice
     per drop, once per sequencer step (RE-36).
   - Moving between kits moves 9–17 MB of WAV data, much of it fetched twice,
     with no cache (RE-83).
3. **Integrity and simplicity, which matter more than speed:**
   - Multi-step writes aren't atomic, and they can't be made atomic without
     changing how connections work (RE-28, RE-81).
   - The renderer has four copies of the sample data, and favourites have two
     sources of truth (RE-37).
   - Undo replays about 26 separate IPC calls and loses gain (RE-86).
   - Main isn't bound to the IPC contract (RE-57).

**Recommendation:** refactor for integrity and simplicity, in an order that
also removes the measured waste. Make the persistent connection with a unit
of work the first change: RE-26, RE-27 and RE-28 all depend on it.

Not recommended:
- a rewrite;
- a state-management or query library;
- moving search to a worker;
- code splitting.

The numbers below don't justify them.

## How this was measured

[`tests/validation/performance.validation.ts`](../../tests/validation/performance.validation.ts)
drives the production build through its UI, the same way `validate:full`
does. It sets up the factory store in the wizard, cold-starts the app three
times, and then performs each common action.

A main-process probe
([`ipc-probe.cjs`](../../tests/perf/ipc-probe.cjs)), loaded
with Electron's `--require`, records the following for each action:
- every IPC call;
- the handler's time;
- the size of the value it returned;
- the longest event-loop stall.

The renderer records long animation frames (over 50 ms).

```bash
npm run build
```

```bash
npx playwright test --config playwright.validation.config.ts performance
```

The report goes to `validation-report/performance/report.md`. **Call counts
and byte counts are deterministic.** Timings depend on the machine:
- These runs used a 12-core M-series Mac, headless, with load average 14–21
  from other sessions.
- The store was on the internal SSD. A store or card on removable media
  makes every file-bound number worse.

## Measurements

A snapshot from runs at `a37229af`, kept as a record and not updated. To
measure again, run the profile.

Cold start, from launch to the first kit card: 408–429 ms.

| Startup call | Calls | Main ms | Returned |
|---|---:|---:|---:|
| `get-all-kits` | 1 | 11 | 1.5 MB |
| `scan-banks` | 1 | 11 | — |
| `get-local-store-status` | 1 | 1.4 | — |
| `read-settings` | 2 | 0.2 | — |
| `get-favorite-kits-count` | 1 | 0.6 | — |

Actions (second run):

| Action | IPC calls | Handler ms | Main blocked max | Returned | Notes |
|---|---:|---:|---:|---:|---|
| Type "kick" in search | 4 | 6 | 11 ms | 152 B | 1 `get-favorite-kits-count` per keystroke |
| Toggle a favourite | 2 | 3 | 7 ms | 96 B | one run had a 188 ms long frame |
| Open kit A0 | 31 | 27 | 31 ms | 4.7 MB | 30 audio buffers; a 116 ms long frame |
| Next kit (A1) | 55 | 51 | 41 ms | 17 MB | **54 buffer fetches for 30 slots** |
| Previous kit (A0) | 55 | 46 | 32 ms | 9 MB | refetched; no cache |
| Drop one sample | 13 | 25 | 12 ms | 3.1 MB | **2 × `get-all-kits`**, 4 × `get-all-samples-for-kit` |
| Gain: 10 wheel steps | 10 | 19 | 9 ms | — | one DB write per step |
| Rename a voice | 4 | 14 | 12 ms | 1.5 MB | full reload |
| Toggle 4 sequencer steps | 16 | 41 | 13 ms | 6 MB | **a full reload per step** |
| Sequencer playing, 5 s | 0 | 0 | 10 ms | — | 0–1 long frames |
| Delete a sample | 12 | 25 | 14 ms | 2 MB | full reload + 5 buffer refetches |
| Open the write summary | 1 | **447** | **454 ms** | 1 KB | all synchronous inside one handler |
| Idle on the grid, 10 s | 0 | — | 12 ms | — | renderer 1.5 % CPU, main 1.2 % |

What the numbers say:

- **The write summary is the only measured freeze.** Planning makes about 370
  connections and about 930 queries, runs `existsSync`/`statSync` twice per
  sample, reads every WAV header synchronously, and walks every card folder.
  None of it yields. A real write plans twice.
- **Per-edit cost is mostly bytes, not time.** At 11 ms and 1.5 MB per reload
  it isn't noticeable on this machine. It grows linearly with the library and
  runs on every sequencer click.
- **Audio loading moves the most data.** Kit navigation fetches most buffers
  twice, revisiting a kit fetches them all again, and each fetch is a
  synchronous whole-file read on main.
- **The LED icon's permanent animation loop and per-trigger re-renders don't
  register at this scale.** Idle CPU is about 1.5 %, and playing the
  sequencer produced at most one long frame. They are still worth fixing for
  simplicity (RE-87), but not for speed.

## Findings by layer

### Database (main)

- **A new connection per call (RE-81).** `withDb` and `withDbTransaction`
  each open better-sqlite3, set three PRAGMAs, build drizzle's schema and
  close it (`db/utils/dbUtilities.ts:102-238`).
  - With WAL, closing the last connection checkpoints, so each write pays for
    the checkpoint.
  - Operations can't share a transaction. `deleteSamples` opens a second
    connection to reindex while its first is open, which would deadlock for
    the 5 s busy timeout inside a transaction (RE-28).
  - Counts per action: add sample is 4–5 connections, delete 5, replace 7,
    move between kits about 12.
- **The sample stack has 7 classes and 1,359 LOC, mostly pass-through:**
  - `sampleService` → `sampleCrudService` → `sampleBatchOperations` →
    `sampleValidation` → `sampleValidator` → barrel → `crudOperations` →
    `sampleCrudOperations`.
  - It has two validators for the same rules and six copies of private
    `getDbPath`.
  - Its results are discarded or recomputed. `checkSampleExists` is called
    and ignored. `getKit` (4 queries) runs only to read one voice's stereo
    mode.
- **Samples added by drop have no WAV metadata (RE-89).** `addSample` stores
  no `wav_*` values, although the header was read a line earlier
  (`crud/sampleCrudService.ts:53-80`).
- **There are three handler styles and five result shapes** (`DbResult`,
  `{isValid}`, `{ok}`, `{exists}`, thrown errors). Some service functions
  that return `DbResult` also throw, so the renderer has to handle both
  (RE-41, RE-57).

### Main-thread blocking

- Sync planning: see above (RE-82).
- `get-sample-audio-buffer` does a whole-kit query and `readFileSync` per
  slot (RE-83).
- `validate-local-store` calls `getKitSamples` once per kit (184 calls) on
  top of `getKits`, and does about 2,400 `existsSync` calls.
- **Path checks don't scale (RE-85).** `pathAccess.check` calls
  `realpathSync` on every root and every granted path, and the set of grants
  grows during a session. A denied check falls back to loading every sample
  row.

### IPC contract

- 68 channels, all `invoke`, mostly named for user intents. But writes return
  nothing the renderer uses, so it reloads instead of patching.
- **Nine preload methods have no caller (RE-84).** Two of them (`readFile`,
  `getAudioMetadata`) are still reachable from the renderer.
- **Main isn't bound to the contract (RE-57).** Handlers are untyped.
  Confirmed drift:
  - `getKit` returns `null`, not a `DbResult`;
  - `SyncProgress` is defined four times;
  - `updateKit` accepts fields that aren't columns (RE-22).
- **The renderer tolerates missing wiring.** It has 45 `?.()` calls and 41
  `if (!electronAPI?.x)` guards, which turn missing wiring back into silent
  no-ops.

### Renderer data flow

- **Edits reload everything (RE-36).** About 17 call sites end in
  `getKits()`. Each reload changes the `kits` identity, which triggers two
  more calls in effects: `get-all-samples-for-kit` and
  `get-favorite-kits-count`.
- **Sample data has four copies:**
  - `kits[].samples`;
  - `allKitSamples`, refreshed separately;
  - `selectedKitSamples`, mirrored by an effect and one render behind;
  - `KitVoicePanels.sampleMetadata`, refetched and keyed by filename
    (RE-45).
- **Favourites have two copies (RE-37).** Repro from the code:
  1. Star A0 in the grid.
  2. Open it: the header shows it unstarred.
  3. Star it there. The database goes from true to false, and the grid still
     shows a star.
- **Gain and BPM edits never reach `kits`.** Re-opening a kit after a BPM
  change probably shows the old value (not yet verified).
- **Undo replays fine-grained IPC calls (RE-86).** Undoing a delete in a full
  voice is about 26 non-atomic calls. Snapshots hold only the filename and
  source path, so gain is lost. The undo stack lives in the keyboard-shortcut
  hook, and refresh goes through a DOM event.

### Rendering and audio

- **Playback state lives in `KitEditor` (RE-87).** Each trigger commits the
  whole editor two or three times (48 waveforms, 48 knobs, the sequencer).
  Play state is keyed by voice and filename (RE-45).
- **Gain writes on every input event (RE-88).** Each wheel step or mousemove
  of the knob writes to the database and re-renders all four voice panels.
- **RE-46 is unchanged.** A playing waveform rebuilds its whole envelope and
  calls `getComputedStyle` on every frame.
- **RE-47 is unchanged:**
  - the message context value changes on every toast;
  - `itemData` is rebuilt on every render;
  - search copies every kit object, so per-card memoisation can't work.
- **Logging is on in packaged builds** (the register's Low "Settings and
  logging" item). `logger.log` treats an undefined `NODE_ENV` as
  development, and nothing sets `NODE_ENV` in a packaged app. Settings objects and whole sync summaries are logged.

## Target shape

The direction, without new libraries:

**Main**
- **One connection per store,** opened and migrated once. It closes on store
  change, on setup cleanup (Windows file locks) and at quit.
- **A unit of work.** Operations take a handle (`fooTx(db, …)`).
  `withDbTransaction` is reentrant through better-sqlite3's
  `db.transaction()` savepoints.
- **One module per intent** (add, replace, delete, move, link, gain…). Each
  reads what it needs once, validates against those rows, writes, and sets
  `modified_since_sync` in one transaction. It returns the changed kit.
- **A typed channel map.** `handle(name, impl)` in main and typed invokes in
  the preload make drift a compile error. The same wrapper converts throws to
  `DbResult` and hosts an IPC trace for tests.

**Renderer**
- **A kits store** on `useSyncExternalStore` (the `syncProgressStore`
  pattern). It holds kits by name and sample rows by slot, and edits patch it
  with the kit the operation returned. Selectors replace the derived copies,
  the favourites shadow map and the four sorts. `getKits` is called only at
  startup, after scan and sync, and when kits are created, copied or deleted.
- **A per-slot playback store,** so a trigger re-renders one slot.
- **An audio buffer cache** keyed by source path and mtime, shared by the
  waveform and the slice strip. Main reads the file asynchronously and looks
  the row up by id.

## Plan

One PR each, in this order. Each step reruns the profile and adds its own
assertions.

**Budgets.** The targets in this table now live in code, in
[`tests/perf/budgets.ts`](../../tests/perf/budgets.ts), as `target` values
marked `until: "RE-NN"`. Every PR checks them; when a step reaches a target,
the check fails until the budget is tightened in that PR. The target column
below describes the goal; the budgets file has the numbers. See the coding
guide's [performance budgets](coding-guide.md#performance-budgets) section.

| # | Change | IDs | Size | Measured target (budgets in `tests/perf/budgets.ts`) |
|---|---|---|---|---|
| 1 | **Done in #513.** Persistent connection per store; reentrant unit of work; handles passed down; reindex in the same transaction | RE-81, RE-28 | M | the test asserts one connection per store; delete is 1 connection, not 5 |
| 2 | Replace as one in-place update (keeps gain and metadata) | RE-26 | S | fault injection leaves no partial state |
| 3 | Move between kits in one transaction, carrying the row | RE-27 | M | gain and metadata survive; move is 1 connection, not ~12 |
| 4 | Sync planning from one query, with async header reads that yield | RE-82 | S–M | write summary blocks main < 50 ms |
| 5 | Edits return the changed kit; the renderer patches instead of reloading | RE-36 | M | step toggle 4 calls / 1.5 MB → 1 call / < 1 KB; drop 13 → ~5 calls |
| 6 | Audio: async read by id, renderer cache, no double fetch | RE-83 | S–M | fetches = filled slots; a revisit makes 0 fetches |
| 7 | Typed channel map, unused channels pruned, one result shape | RE-57, RE-84, RE-41 | M | `tsc` fails on drift |
| 8 | Kits store with selectors; one favourites path | RE-37, RE-45 | L | favourites repro test; no copies of sample state |
| 9 | Undo as transactional intent-level operations | RE-86 | M | undo of a delete is 1–2 calls and keeps gain |
| 10 | Playback store; waveform draw path; memoisation; throttled gain | RE-87, RE-46, RE-47, RE-88 | M | gain drag ≤ 10 writes/s; grid cards don't re-render on a toast |

Steps 1–3 are RE-26, RE-27 and RE-28 as already researched; the persistent
connection makes them straightforward. Steps 4 and 6 are small,
self-contained wins. Step 5 is needed before the store (8) and undo (9).

Quick fixes that can go in at any time:
- the logging item from the register's Low list;
- RE-21 (settings loading and atomic writes);
- the rest of RE-56 (about 490 LOC of unused main code, plus the unused hooks
  `useKit`, `useKitStepSequencer` and `useKitVoicePanel`);
- RE-89 (store WAV metadata on add, which falls out of step 1's add
  operation).
