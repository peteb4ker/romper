<!--
title: Store check - Specification
priority: medium
status: specification
updated: 2026-10-09
context_size: medium
implementation_status: not built; stage 1 is #812, stages 2-6 wait for the decisions below
-->

# Store check: keeping the library's files and database in agreement

Tracks [#769](https://github.com/peteb4ker/romper/issues/769)
([UC-05](use-cases.md#uc-05-recover-from-an-invalid-or-missing-store),
[Q-01](use-cases.md#q-01-romper-stays-responsive-as-your-library-grows)).
The `_save` roadmap ([`rample-save-integration.md`](rample-save-integration.md))
is a separate plan: this check never reads the card or `_save`, and skips
the copies of `_save` the store keeps in `.romperdb`.

## Problem

Nothing tells you when the library's files and its database stop
agreeing. A sample file deleted or moved in Finder, a file replaced by one
Romper can't read, or new files dropped into a kit folder show up only
when you open that kit (the kit-open check, #537), when you scan it, or
when a write skips them. With hundreds of kits, a problem in a kit you
haven't opened stays hidden until the write.

## Decisions already made

Pete, 2026-10-09 (recorded on #769). This spec doesn't reopen them.

- **When:** automatically, in the background.
- **What:** it checks that the store's folder matches the database
  (sample files on disk against sample rows).
- **Reporting:** silent when everything is fine; when something is wrong,
  badges on the affected kits and a notice.
- **Fixes offered:** rescan the kit, remove the missing samples, or search
  on disk for the missing files and copy them back into place.
- **Wording:** every new string (badge, notice, fix actions) goes to Pete
  for sign-off. The wording below is drafted, not approved.

## What exists today

Confirmed by reading `main` at `ce90f1ba`:

- **Per-sample status.** `samples.source_status` (`readable`,
  `unreadable`, `missing`, or null when never checked) and
  `source_size` / `source_mtime_ms` (migration 0017, #793) in
  `shared/db/schema.ts`. Written by add, scan (`mergeKitScanTx`), the
  kit-open check and a completed write (`completeWrite`).
- **The kit-open check.** `ScanService.checkKitSampleFiles` and
  `checkSampleFile` (`electron/main/services/scanService.ts`), reached
  through `check-kit-sample-files` from `KitVoicePanels`
  (`checkSampleFilesOnce`), once per kit per session. One async `stat` per
  sample; the header is read only when the file isn't known to be
  readable or its size or modification time changed (#810). It runs every
  sample at once (`Promise.all`) and records changes in one transaction
  (`updateSampleSourceStatusTx`, which matches on the row's `id` only).
- **Labels and notices.** `SAMPLE_FILE_LABELS` ("File not found", "Can't
  be read") and `describeMissingSampleFile` in `shared/stereoLinkRules.ts`,
  shown in the kit editor's slots and its missing-files notice
  (`kit-missing-files-notice` in `KitVoicePanels.tsx`). An unreadable
  file quarantines the kit (`isKitQuarantined`, computed in main), which
  shows the `WarningOctagon` icon on its kit card (`KitGridItem.tsx`,
  `QUARANTINE_ICON_LABEL`). A missing file never quarantines, and the
  kit card shows nothing for it.
- **Scan.** `rescan-kit` → `ScanService.rescanKit` → `mergeKitScan`. It
  adds unreferenced voice-prefixed WAVs to read-only kits only (editable
  kits skip them as `kit_editable`), never deletes a row, and reports
  missing files. It fails with "Kit directory not found" when the folder
  is gone. It reads the folder with `readdirSync` and each header with
  `statSync` and a synchronous read, on the main thread.
- **The old whole-store validator.** `validateLocalStoreAgainstDb`
  (`electron/main/localStoreValidator.ts`), behind `validate-local-store`:
  `existsSync` per sample and `readdirSync` per kit folder, synchronously,
  on the main thread, for every kit. Its result type is
  `KitValidationError` (missing and extra files per kit).
  `ValidationResultsDialog` and `useValidationResults` display it, but
  nothing opens the dialog (#758 kept them for this work).
- **Store and database checks.** `validateLocalStoreAndDb` (folder, `.romperdb`,
  schema) and, while running, `checkOpenDatabaseFiles`
  (`electron/main/db/utils/dbUtilities.ts`, #773 for #535): one async
  `stat` per open store every second, pushing
  `local-store-database-missing`, which shows the Invalid Local Store
  dialog. #773 tried `fs.watch` first and dropped it: on macOS it loses
  events, can't see the store folder itself move, and network drives may
  not report changes.
- **What the store holds.** Setup copies the card's or factory archive's
  kit folders into the store; their rows point at those copies. Samples
  you add are referenced where they are, never copied
  ([`romper-db.md`](romper-db.md), "Reference-only storage";
  [`domain-model.md`](domain-model.md#local-store-library)). Creating,
  duplicating and deleting a kit change only the database
  (`kitService.deleteKit`: "DB-only operation - no filesystem changes"),
  so a kit made in Romper has no folder, and a deleted imported kit's
  folder stays in the store.
- **Path rules (Q-03).** `pathAccess` (`electron/main/security/pathAccess.ts`)
  allows writes to the store, the card, and folders the user picked in a
  native dialog shown by main this session; reads also to dropped files
  and sources the store references (`sampleSourceAccess.ts`).
- **Edits on read-only kits.** `requireEditableKitTx` (#572) refuses
  sample adds, moves and deletes on a kit that isn't editable.

### Found while writing this spec

- **Choosing a store in the Invalid Local Store dialog runs the old
  validator.** `InvalidLocalStoreDialog` (`validatePath`,
  `handleTryAgain`) calls `validateLocalStore`, which runs
  `validateLocalStoreAgainstDb`. So one missing sample file, or one extra
  WAV in a kit folder (including a macOS `._` AppleDouble file copied
  from a card, which its `.wav` filter counts), makes a good store read as
  invalid, with no `error` text. It also holds the main thread for the
  whole store. Confirmed by reading the code; not reproduced in the app.
  Filed as #813.
- **A stale check result can land on a changed row.** Both the kit-open
  check and a background check stat a path, then update the row by `id`.
  If an edit changes the row's `source_path` in between, the old file's
  status lands on the new file. Inferred from the code; not reproduced.
  Stage 1 makes the update compare the path.
- **The kit card's accessible name leaves out the quarantine icon.**
  `KitGridItem` sets the gridcell's `aria-label` to the kit name and
  sample count, which replaces the names of everything inside it.
  Confirmed by reading; filed as #814.

## Measurements

Run on 2026-10-09 against the factory archive the validation profile uses
(`~/.cache/romper/RampleSamplesV1-2.zip`, extracted to a scratch folder;
never Pete's store), with Node 22 on Pete's Mac, file cache warm. The
figures are in the PR that added this file and on #769, not here, because
they go stale. In short: listing every kit folder and `stat`-ing every
sample file of the factory library took tens of milliseconds, with no
measurable event-loop delay when done asynchronously one kit at a time;
reading every header took about ten times as long; reading one kit's
sample rows from SQLite took well under a millisecond, even with a
2,600-kit synthetic table. Not measured: a cold cache, a USB or network
drive, antivirus scanning on Windows, and iCloud files that are only in
the cloud. These are the cases the design guards against.

## What "matches" means

The check compares two things: each sample row with the file it points
at, and each kit folder in the store with the kit rows. Files are matched
the way `rescanKit` matches them: voice-prefixed `.wav` files
(`voiceOfCardFile`), so names starting with `.` (AppleDouble `._` files,
`.DS_Store`) and non-WAV files never count.

| Finding | Rule | Stored in | Shown |
|---|---|---|---|
| **Row with no file** (missing) | `stat(source_path)` fails with ENOENT or ENOTDIR, inside or outside the store | `source_status = "missing"` (exists) | Badge (new), the editor's "File not found" (exists) |
| **Drive not connected** | Missing, and the path's volume isn't mounted (macOS `/Volumes/<name>`, a Windows drive letter or share root) | `source_status = "missing"`, plus an in-memory flag | Its own line in the notice; never offered for removal (D6) |
| **Unreadable file** | The header read fails | `source_status = "unreadable"` (exists) | Quarantine icon (exists) |
| **Changed file** | Size or modification time differs from `source_size` / `source_mtime_ms` | Header re-read; `wav_*` and the stat columns updated (as #810 does) | Nothing, unless it's now unreadable (D9) |
| **File with no row** (untracked) | A voice-prefixed WAV in a **read-only** kit's folder that no row of that kit points at (D4) | In memory | Badge (new); fixed by Scan |
| **Read-only kit with no folder** | A read-only kit whose folder `<store>/<kit>` is gone | In memory | Reported as its samples missing, with a kit-level line (D4) |
| **Kit folder with no kit** | A folder whose name passes `isValidKit` and has no kit row | In memory | Not reported by default (D4): deleting an imported kit leaves its folder |

Not checks: editable kits' folders (their sample list is the database's,
and deleting a sample leaves its file), kits made in Romper having no
folder, `.romperdb` and everything in it (including `rample-save/`), the
bank name files, and the card.

## When it runs

Recommended (D7):

- **At startup**, once the store's status is valid (`isLocalStoreReady`)
  and the kit grid has loaded, after a few seconds with no IPC call in
  flight. Not before the grid, so none of its work lands in cold start.
- **After a store change**: the running pass is cancelled at once (before
  `closeAllDbConnections`), and a new one starts on the new store as at
  startup.
- **When the window regains focus**, if the last complete pass finished
  more than ten minutes ago. Coming back to Romper after working in Finder
  is the usual way files change.
- **Not periodically** while Romper sits in the background, and **not
  after a write or Scan All**: both record what they found themselves.
- **No file watching**, for the reasons #773 gave.

A pass that was cancelled resumes from the next unchecked kit rather than
starting over, unless the store changed.

## How it's scheduled

The check runs in main, as a `StoreCheckService` beside `ScanService`.
Main owns the database and the files; the renderer only shows results.

- **One kit per step.** Each step reads one kit's rows (one indexed
  query), `stat`s them, reads only the headers the rules above require,
  and records changes in one short transaction. Between steps it yields
  (`setImmediate`), then waits until no IPC call has been in flight for a
  short quiet period, so a user action always goes first. The folder side
  is one async `readdir` of the store root per pass and one per read-only
  kit folder, in the same steps.
- **One file operation at a time.** Every `stat`, `readdir` and header
  read is `fs.promises`, one in flight, never `Promise.all`. libuv's
  thread pool has four threads by default, shared with the write's file
  copies, audio loads and archive extraction. A check that filled it with
  `stat`s on a hung network drive would stall them, and the write's card
  watchdog would blame the card (#724, #748).
- **A time limit per operation.** Each operation has a limit like the
  card watchdog's (`withCardWatchdog`). A timeout marks that volume as not
  responding for the rest of the pass, skips its remaining files without
  touching their rows, and the notice says so. No sync fs call, ever (the
  `syncFsCalls: 0` budgets).
- **Pauses.** The check doesn't run while a write (`startKitSync`), setup,
  Scan All or a rescan is in progress, and skips the kit open in the
  editor (its own kit-open check covers it). A pass that paused for a
  write re-reads each kit's rows after it resumes.
- **Cancellation.** One `AbortController` per pass, aborted by a store
  change, quit, or a newer pass. An aborted pass records nothing more.
- **Safe recording.** The update matches the row's `id` and the
  `source_path` that was checked, so an edit in between wins. The
  kit-open check gets the same guard.

## Where results live

- **Row findings** go in the columns that exist (`source_status`,
  `source_size`, `source_mtime_ms`, `wav_*`). No migration. The renderer
  already gets them in `kits[i].samples`, and `quarantined` already
  follows `source_status`.
- **Folder findings** (untracked files, a missing read-only kit folder,
  drives not connected, and folders with no kit if D4 wants them) stay in
  main's memory, keyed by kit, and are rebuilt on every pass. They are
  cheap to recompute, would go stale in a table between sessions, and a
  table would need a migration for no gain. Recommended: no new table.
- **Pass state** (running, paused, last completed time, the resume point)
  is in memory too.

## IPC contract

Through the typed channel map (`shared/ipcChannels.ts`, #472), with the
types in `shared/electronApi.ts`:

```ts
interface StoreCheckKitFinding {
  kitName: string;
  missing: number;          // rows whose file is missing
  unreadable: number;       // rows whose file can't be read
  quarantined: boolean;     // isKitQuarantined after this pass
  untracked: string[];      // read-only kits only
  folderMissing: boolean;   // read-only kit whose folder is gone
  unavailableVolumes: string[]; // volumes not connected or not responding
}

interface StoreCheckStatus {
  state: "idle" | "paused" | "running";
  lastCompletedAt: null | number;
  kits: StoreCheckKitFinding[];  // only kits with a finding
  orphanFolders: string[];       // only if D4 reports them
}
```

- **Invoke** `get-store-check-status` → `DbResult<StoreCheckStatus>`.
  The renderer calls it once when the kit grid mounts (and after a
  renderer reload), so it doesn't depend on catching a push.
- **Push** `store-check-updated` (`IpcEvents`) with the kits whose
  finding changed in a step, a kit that's now clean included with zero
  counts, and the state. A step that changes nothing sends nothing. The
  first pass over an older library sets many statuses from null to
  readable, which changes no finding, so it sends nothing for them.
- The renderer patches `kits[i].quarantined` for each kit in the push
  (one object per changed kit, so only those cards redraw, #462) and keeps
  the rest of the finding in its own map. No `get-kit` and no
  `get-all-kits` on a push; opening a kit reads its rows as today.
- **Fix channels**, each added with its stage: `rescan-kit` (exists),
  `remove-missing-samples`, `pick-search-folder`, `find-missing-files`,
  `restore-missing-file`. Each validates its arguments in main, checks
  paths with `pathAccess`, and returns `DbResult`.

## Badges and the notice

All wording here is a draft for Pete (see
[Drafted wording](#drafted-wording)).

- **Kit card badge.** A kit with missing files or untracked files gets
  one icon beside the quarantine icon's place, in `--accent-warning`, a
  different shape from the quarantine octagon (D11), with `role="img"`,
  an accessible name and a tooltip saying what's wrong and how many. An
  unreadable file keeps showing the quarantine icon only: it's already
  shown, and it's the more serious state. Both can show.
- **Kit editor.** The existing slot labels and missing-files notice stay.
  The notice gains the fix buttons for that kit (stages 4–6).
- **The notice** (D8, recommended): a status bar item, shown only while
  problems exist, that says how many kits need attention and opens the
  details dialog. When a pass finds a problem that wasn't there before,
  one message also appears through the existing message system, once;
  known problems don't repeat it. Silent otherwise, and silent while a
  pass runs.
- **Details dialog.** Lists affected kits, grouped by finding, with each
  kit's fixes, and a line per drive not connected. Reuses the
  `ValidationResultsDialog` slot in `KitBrowser` (rewritten to the new
  types); `useValidationResults` and the old validator go.

## Fix actions

Each fix re-checks the files it acts on just before acting, in main, and
does nothing to a sample whose state changed since the pass.

### Rescan the kit

- Calls `rescan-kit`, unchanged: adds untracked files to a read-only kit,
  fills empty metadata, reports missing files. It never deletes a row.
- Offered for read-only kits with untracked files. For an editable kit,
  Scan only names voices, so it isn't offered there.
- Safety: as today (one transaction, a locked kit untouched).
- Q-01: `rescanKit` is synchronous on main (`readdirSync`, `statSync`,
  header reads). One kit at a time is acceptable as a user action, but
  stage 4 moves its file reads to `fs.promises` before the notice can
  offer it on many kits at once.

### Remove the missing samples

- Deletes the rows of a kit whose `source_status` is `missing` and whose
  file is still missing when re-checked, reindexes each voice, and marks
  the kit modified, in one transaction. Never touches a file.
- Not offered for samples on a drive that isn't connected (D6).
- Read-only kits: `requireEditableKitTx` refuses this today. D5 decides
  between a named exception for this fix and offering to make the kit
  editable first.
- Undo: one undo entry restoring the affected voices' rows
  (`VoiceSnapshot`, `restoreVoicesTx`), like a sample delete (UC-26).
- Confirmation: a popover that names the kit and the count.

### Search on disk and copy back

- **Where it looks (D1).** Recommended: the store's own kit folders
  (a file moved between kits), and one folder you pick in a native dialog
  shown by main, which grants it through `pathAccess` (Q-03). The dialog
  opens at the nearest folder above the missing file's old location that
  still exists. Not your whole home folder: on macOS, reading Desktop,
  Documents or Downloads asks for permission, reading an iCloud file
  that's only in the cloud downloads it, and a full walk is slow.
- **The walk.** Async `readdir`, one at a time, with the per-operation
  limit; skips hidden folders, `.romperdb`, packages and links (never
  followed); stops at a depth and a file count limit and says so;
  cancellable from the dialog.
- **Matching (D3).** Recommended: a *match* has the same file name (case
  ignored), the same size as `source_size` when it's known, and the same
  header (channels, sample rate, bit depth, format tag). A file with the
  same name that differs in size or header is a *possible match*. No
  content hash: Romper doesn't store one, and hashing would read every
  candidate in full.
- **Several matches.** Never picks one itself. One match is offered with
  its path; several, or only possible matches, are listed for you to
  choose, with path, size and modified date.
- **Putting it back (D2).**
  - A sample whose old place is in the store (an imported kit's file):
    copy the chosen file to its old path. The copy is written to a
    temporary name in the same folder, then put in place with a call that
    fails if a file is already there (`link` then `unlink`, or
    `copyFile` with `COPYFILE_EXCL` where links aren't supported). Never
    overwrites. Then the file is checked as any other.
  - A sample whose old place is outside the store: copying there writes
    outside the store, which Q-03 doesn't allow today. Recommended:
    point the sample at the file found, without copying
    (`updateSampleMetadata` already sets `source_path`). D2 decides.
- **Undo.** Pointing a sample elsewhere is undone by pointing it back.
  A copy is undone by deleting the copied file, only if its size and
  modification time are still what Romper wrote; otherwise undo says the
  file has changed and leaves it.
- **Never:** delete or move the found file, write outside the store or a
  granted folder, or follow a link out of the searched folder.

## Accessibility (Q-06)

- The badge has `role="img"` and an accessible name with the count, and
  its tooltip says the same; color is never the only signal.
- The kit card's accessible name includes the badge's text. Today the
  card's `aria-label` ("Kit A0 - 12 samples", in `KitGridItem`) replaces
  its content's names, so a screen reader doesn't hear the quarantine
  icon either; stage 3 adds both to the label.
- The status bar item is a button, reachable by keyboard, named with
  what it says. The one-time message uses the message system's polite
  announcement, never `role="alert"`; a pass that finds nothing new
  announces nothing.
- The details dialog follows the existing accessible dialog pattern
  (focus trapped and returned, Escape closes); each fix is a button whose
  name includes the kit; results are announced politely.
- The folder dialog is the operating system's own.

## Test strategy

Tag tests `[UC-05]` and `[Q-01]` (and `[Q-06]`, `[Q-03]` where they apply).

- **Unit:** the classifier (each row in [What "matches"
  means](#what-matches-means), including `._` files, editable kits, and a
  volume not connected); the scheduler with fake timers (yield, quiet
  period, pause during a write, cancel on store change, resume point,
  focus throttle); the compare-on-path update; the matcher (match,
  possible match, several); the no-overwrite copy; the renderer's patch
  of one kit card and the status bar item; the dialog's keyboard paths.
- **Integration** (Electron as Node, real IPC handlers): a generated
  store with a missing file, an unreadable file, a changed file, an
  untracked file and a deleted kit folder gets the right statuses and
  findings; a `stat` that never resolves times out without stalling the
  event loop or other fs work, and no sync fs call is made (like
  `setup-hung-card.integration.test.ts`); a write started mid-pass pauses
  it; remove and restore re-check before acting, never overwrite, and
  undo.
- **e2e:** a store with a sample deleted on disk shows the badge and the
  notice without opening the kit; the fix flows; the cold-start budget
  gains only `get-store-check-status`.
- **Screenshots and manual text** for the badge, notice and dialog, in
  the stages that add them.

## Performance budgets

In `tests/perf/budgets.ts`, by stage:

- **e2e** "cold start to the kit grid": `get-store-check-status` at most
  1. No `get-kit` or `get-all-kits` from a push.
- **integration**: "store check: one kit" with `connections: 0`, a small
  `statements` max, and `syncFsCalls: 0`; "store check: full pass" on
  the generated store with `syncFsCalls: 0`.
- **validation** (factory profile): "idle on the kit grid, 10 s" must
  hold with a pass running in it (it measures `mainBusyMs` and bytes); a
  new "store check: full pass" with `mainBusyMs: STALL`.

## Plan

Each stage is one PR. Stages 2 to 6 wait for the decisions named.

### Stage 1: check sample files in the background, no new UI ([#812](https://github.com/peteb4ker/romper/issues/812))

- `StoreCheckService` in main with the scheduler, triggers, pauses,
  cancellation and resume above; the row side only (missing,
  unreadable, changed), through the shared `checkSampleFile`.
- `updateSampleSourceStatusTx` matches on `source_path` too, for the
  kit-open check as well.
- `get-store-check-status` and `store-check-updated`; the renderer
  patches `quarantined` on changed kits. So a file that became unreadable
  shows the existing quarantine icon on its card without opening the
  kit. No new wording.
- **Acceptance:** with no kit opened, a sample file made unreadable on
  disk turns its kit's card quarantined within one pass; a deleted file's
  row reads `missing`; a hung `stat` times out without stalling main or
  other fs work; no sync fs call; a write pauses the pass; a store change
  cancels it; the budgets above hold; the "idle on the kit grid"
  validation budget holds.
- **Affects:** UC-05, Q-01. **Decisions:** none (D7's triggers are
  recommended; Pete can change the numbers on the issue).

### Stage 2: check kit folders (blocked on D4)

- Untracked files in read-only kits, read-only kits with no folder,
  drives not connected (D6), and folders with no kit if D4 wants them.
  In memory; in the status and the push.
- **Acceptance:** a WAV added to a read-only kit's folder is listed; one
  added to an editable kit's folder isn't; `._` files never are; a
  deleted kit's folder is handled as D4 says.

### Stage 3: badges and the notice (blocked on D8, D11 and wording)

- The kit card badge, the status bar item, the one-time message and the
  details dialog (replacing `ValidationResultsDialog` and
  `useValidationResults`). Screenshots and manual text: the manual's
  "Validating Your Store" section is rewritten for the automatic check.
- **Acceptance:** silent with no problems; badge and notice with one;
  the message appears once per new problem; keyboard and screen reader
  paths work.

### Stage 4: rescan from the notice (blocked on stage 3 and wording)

- The rescan fix in the dialog and the editor's notice. `rescanKit`'s
  file reads move to `fs.promises`.
- **Acceptance:** rescan from the dialog clears the untracked finding;
  `rescan-kit` makes no sync fs call.

### Stage 5: remove missing samples (blocked on D5, D6 and wording)

- `remove-missing-samples`, its popover, and undo.
- **Acceptance:** removes only rows still missing at the time; never
  those on a drive not connected; one undo restores them.

### Stage 6: find missing files and put them back (blocked on D1, D2, D3 and wording)

- `pick-search-folder`, `find-missing-files`, `restore-missing-file`,
  the results list and undo.
- **Acceptance:** finds a file moved to another folder; never overwrites;
  lists several matches for a choice; undo deletes only an unchanged copy
  or points the sample back.

### Separately: the Invalid Local Store dialog bug

[#813](https://github.com/peteb4ker/romper/issues/813): choosing or retrying a store should validate the
store (`validateLocalStoreAndDb`), not its samples. Once it and stage 3
land, `validateLocalStoreAgainstDb` has no caller and is deleted.

## Decisions for Pete

| # | Question | Recommendation |
|---|---|---|
| D1 | Where does "search on disk" look? | The store's kit folders, plus one folder you pick each time, opened at the nearest existing folder above the file's old place. Never the whole home folder. |
| D2 | "Copy back into place" for a sample whose file was outside the store | Point the sample at the file found, without copying. Copy only when the old place is inside the store. (Copying outside the store changes Q-03.) |
| D3 | What counts as a match? | Same name (case ignored) + same size + same header is a match; same name only is a possible match you confirm. No content hash. Several matches: you choose. |
| D4 | Which folder findings are reported? | Untracked WAVs in read-only kits only; a read-only kit with no folder; not folders with no kit (deleting an imported kit leaves its folder), or only as a line in the details dialog. |
| D5 | Remove missing samples from a read-only kit? | Allow it as a named exception for this fix only (re-checked, undoable). Alternative: offer "make editable" first. |
| D6 | A file on a drive that isn't connected | Report it as "drive not connected", not as missing; never offer to remove it. |
| D7 | Triggers and throttle | Startup after the grid loads; store change; focus if the last pass ended over ten minutes ago. No timer, no watcher. |
| D8 | What is "the notice"? | A status bar item while problems exist, opening a details dialog, plus one message when a pass finds something new. |
| D9 | Changed files | Refresh their details silently, as #810 does; show nothing unless one becomes unreadable. |
| D10 | The promised "Validate Store" button (UC-05) | Don't build an on-demand button; the automatic check replaces it. Optionally a "Check again" in the details dialog. |
| D11 | The badge's look | A warning-colored icon distinct from the quarantine octagon (for example Phosphor's `FileX`), one per card. |

## Drafted wording

**Drafts for Pete's sign-off; none is approved.**

- Badge, missing files: "2 sample files not found"
- Badge, untracked files: "3 files in this kit's folder aren't in the kit. Scan the kit to add them."
- Badge, both: "2 sample files not found; 3 files in the folder aren't in the kit"
- Kit with no folder: "A3's folder is missing from your library."
- Drive not connected: "The drive "Samples SSD" isn't connected, so 14 samples in 3 kits weren't checked."
- Drive not responding: "The drive "Samples SSD" didn't respond, so some samples weren't checked."
- Status bar item: "3 kits need attention"
- One-time message: "Romper found missing sample files in 3 kits. Open the list from the status bar."
- Details dialog title: "Library check"
- Fix buttons: "Scan kit", "Remove missing samples", "Find missing files…"
- Remove popover: "Remove 2 missing samples from A3? You can undo this."
- Search: "Choose a folder to search for kick.wav"; results "Found kick.wav in Samples/Drums." / "Found 2 files named kick.wav. Choose one." / "No copy of kick.wav found in Samples."
- Restore buttons: "Copy back" (store samples), "Use this file" (samples outside the store, if D2 says so)
- Undo of a copy whose file changed: "kick.wav has changed since Romper copied it, so it wasn't removed."

## Risks

- **A hung or slow drive** stalls fs work for the whole app if the check
  floods the thread pool. Mitigation: one operation at a time, a time
  limit, skip the volume for the pass, pause during writes.
- **A drive that isn't connected** makes every sample on it look missing,
  inviting a mass removal. Mitigation: D6.
- **First pass on an older library** reads every header once (statuses
  are null). Mitigation: it's spread over the steps, yields, and sends no
  pushes for null to readable.
- **iCloud files only in the cloud:** a header read downloads them.
  Mitigation: headers are read only for files that changed or were never
  read; the search never walks iCloud Drive unless you pick it.
- **Races with edits** recording a stale status. Mitigation: the update
  compares the path; the open kit is skipped.
- **Noise** from expected states (editable kits' folders, deleted kits'
  folders). Mitigation: D4.
- **Writing into the store** (copy back) adds a second kind of file
  Romper writes there. Mitigation: no overwrite, temp name then link, only
  under a missing sample's old path, undo checks the file is unchanged;
  the domain model's invariant is updated in stage 6.

## Not covered

- The card, `_save`, and write-time checks (the write already reports
  missing and unreadable files; [`rample-save-integration.md`](rample-save-integration.md)).
- Checking the database's own integrity (SQLite `integrity_check`) or
  schema, which `validateLocalStoreAndDb` and the migrations cover.
- Bank name files in the store (`banks.artist` owns bank names, #567).
- Relinking a sample by hand to any file you choose (#769 listed it; Pete
  didn't pick it), beyond what D2 decides.
