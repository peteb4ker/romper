<!--
title: Kit refresh after an edit - Specification
priority: medium
status: done
updated: 2026-10-08
context_size: small
implementation_status: step 1 in #765; step 4's failure handling in #775; step 2 in #776; step 3a in #777; step 3b in #779; the rest of step 4 in the PR that closed #452
-->

# Kit refresh after an edit

Tracks [#452](https://github.com/peteb4ker/romper/issues/452) (RE-36,
[Q-01](use-cases.md#q-01-romper-stays-responsive-as-your-library-grows)).
Part of step 5 in the [architecture review](architecture-review.md#plan);
[`domain-model.md`](domain-model.md) maps every renderer copy of kit and
sample data.

## Problem

Almost every edit in the kit editor reloaded the whole library: every kit,
with every sample row, over `get-all-kits`. What one edit sends grows with
the library, and a sample edit made three or more IPC calls. The reloads
also caused three correctness problems (see the
[issue comment](https://github.com/peteb4ker/romper/issues/452)):

1. **Out-of-order responses.** Nothing sequenced the reloads. Several run at
   once (each step and trigger-condition save, the debounced level and
   slicer saves, sample-mode saves), and an older `getKits` response that
   resolved last put older data back. `useStepPattern` and
   `useTriggerConditions` then reset to it, so the grid could bounce back.
2. **A failed reload empties the screen.** On any error
   `refreshAllKitsAndSamples` cleared `kits` and `allKitSamples`.
3. **Copies refresh through different calls.** `refreshSingleKitMetadata`
   updated `kits[i].samples` but not `allKitSamples`;
   `reloadCurrentKitSamples` did the opposite.

## Refresh paths before step 1

`useKitDataManager` owns `kits` and `allKitSamples`. On `main` before step
1 these paths refreshed them:

| Path | Trigger | What it called |
| --- | --- | --- |
| `loadKitsData` | Startup, a store change | `get-all-kits` |
| `refreshAllKitsAndSamples`, as the editor's `onKitUpdated` (`useKitEditorLogic.reloadKit`) | Sample add, delete and move; step pattern and trigger-condition saves; voice rename; stereo link, unlink and the stereo drop prompt; a finished drop (`onBatchDropComplete`); sequencer voice settings (level, sample mode, slices); the first-open file check when statuses changed; Rescan kit | `get-all-kits` |
| `reloadCurrentKitSamples`, as `onRequestSamplesReload` | Sample add, delete and move (after the full reload above); Rescan kit; opening a kit whose samples aren't loaded (#605) | `get-all-samples-for-kit` |
| `refreshSingleKitMetadata` | Voice name inference | `get-kit` |
| Both of the above | Undo and redo (`romper:refresh-samples`) | `get-all-samples-for-kit` and `get-kit` |
| `refreshAllKitsAndSamples`, as the browser's `onRefreshKits` | Create, duplicate or delete a kit; rename a bank; a finished write; Scan all | `get-all-kits` |
| None | BPM (patches `kits`), gain (`markKitModified`), favorite, alias and editable (patch after main's answer) | |

Each reload also gives the open kit a new object, so `KitVoicePanels`
refetches its own `sampleMetadata` copy with `get-all-samples-for-kit`.

## Target design

- **An edit reloads only its kit.** The editor's reload names the kit the
  edit was made in, so a save that finishes after a step to another kit
  still reloads the right one. One `get-kit` call returns the kit with its
  bank, voices and samples, and patches both `kits[i]` and
  `allKitSamples[kit]`; every other kit keeps its object, so the grid and
  cards don't redraw.
- **Later, an edit returns its kit.** Each edit operation in main returns
  the kit it changed, read in the transaction that changed it, and the
  renderer patches with that instead of asking again (architecture review
  step 5).
- **Reads are sequenced.** Every kit read is numbered when it's sent. A
  kit's data on screen remembers the number of the read it came from, and a
  response older than that is dropped. A full load that lands after a newer
  single-kit read keeps that kit's newer data and replaces the rest; a full
  load older than the last full load that landed is dropped.
- **A full reload is still right** when the list itself changes in ways
  only a full read shows: startup and store changes, setup, Scan all, a
  finished write (it clears modified flags on many kits) and a bank rename
  (bank names on many kits). Creating, duplicating or deleting a kit
  changes one kit, so it adds or removes that kit (step 4).
- **What the user sees doesn't change**, apart from speed. A reload that
  fails keeps what's on screen and says so (see Decisions).

## Steps

One PR each (step 3 is two). Earlier PRs say `Part of #452`; the PR
that finishes the plan, the rest of step 4, says `Fixes #452`. Numbers live in [`tests/perf/budgets.ts`](../../tests/perf/budgets.ts),
not here.

### 1. Reload one kit, in order (done in the PR that added this file)

- `useKitDataManager.refreshKit(kitName)` reads one kit with the existing
  `get-kit` channel and patches both copies. If the kit can't be read, it
  keeps what's shown and uses the #605 failure handling (mark the kit, say
  so) after any edit. It replaces `reloadCurrentKitSamples` and
  `refreshSingleKitMetadata`.
- `KitsView` passes the editor a kit-named `onKitUpdated`, and
  `onRequestSamplesReload` takes the kit name too. A sample edit, a rescan
  and an undo each reload once (one `get-kit`), not a full reload plus a
  samples fetch.
- Full loads (`loadKitsData`, `refreshAllKitsAndSamples`) and kit reads
  share the read numbering above.
- **Verified by:** unit tests in `useKitDataManager.test.ts` for each
  ordering case (they fail with the numbering removed) and for a failed
  read; `KitsView.test.tsx` for a voice rename, which reloads one kit and
  says so when that fails; `useKitEditorLogic.test.ts` for the kit name and the single reload;
  the e2e budgets, where every editor action has a `get-all-kits` budget of
  none and a `get-kit` budget, and the step toggle has a `get-kit bytes`
  budget; tighter `bytes` budgets in the validation profile for the editor
  actions.

### 2. Drop the extra reloads and refetches (done in #776)

- `KitVoicePanels` builds `sampleMetadata` from `kit.samples` (full rows,
  the same columns as `get-all-samples-for-kit`) instead of fetching it on
  every kit change. A kit listed without its rows shows unknown gains, as
  a failed read did, until reopening it loads them (#605).
- For that, a gain main saved goes into the loaded kit's row
  (`markGainSaved`, which replaces `markKitModified`), and a gain being
  turned stays on screen over a reload until main answers for it.
- **Saved changes outlive older reads.** A change main has saved and the
  renderer shows without a reload (a gain, BPM, favorite, name or editable
  flag) is numbered like a read. A read sent before it is shown with the
  change applied; a read sent after it supersedes it.
- A drop reloads once: each add already reloads, so the reload when the drop
  finishes (`onBatchDropComplete`) is gone.
- The drop's duplicate check reads the kit's rows as loaded.
- The undo snapshot before a delete or move moves to step 3: main returns
  the rows it replaced, read in the same transaction. A snapshot from the
  renderer's copy could be stale while a reload is on its way, and undo
  would then put back the wrong rows.
- **Verified by:** the `get-all-samples-for-kit` budgets are pinned at none
  for opening, stepping, editing, renaming, toggling and dropping, and the
  drop's `total` reached its target; delete keeps one fetch, the undo
  snapshot, with a target of none. Tests cover the details following the
  kit's rows, a saved gain going into the rows, a gain kept over an older
  reload, a favorite kept over an older full load, and the duplicate check
  reading the held rows. The validation profile's byte budgets are
  tightened.

### 3. Edits return the changed kit

Two PRs.

**3a. Edits to a kit's own fields and voices** (done in #777)

- The step pattern, trigger conditions, slices, slice division, voice
  level, sample mode, slicer settings, voice name and stereo link return
  the kit as the edit left it, without its samples (`KitEdit`), read back
  right after the write on main's one connection. If it can't be read
  back, the edit still succeeds and the renderer reads the kit as before.
- The renderer shows it (`applyKitEdit`) as a saved change: everything but
  the samples, kept over a read sent before it and replacing the
  kit-level changes saved before it. No `get-kit`.
- The debounced shows (level drags, slice bursts) show the kit the last
  save of the burst returned.
- What an edit returns holds the kit's pattern, conditions, slices and
  voices, so it's a few KB rather than the architecture review's
  sub-KB goal, which would need each edit to return only the fields it
  changed.
- **Verified by:** the step-toggle `total` reached its target and is
  pinned at one call, with a bytes budget on the save; renaming a voice
  reads nothing; `get-kit` is pinned at none for both. Tests cover
  `applyKitEdit` against older and newer reads, each hook passing on the
  kit its save returned, the debounced bursts showing the last result,
  and main returning the kit without its samples (and none when it can't
  be read back).

**3b. Sample edits** (done in #779)

- Add, delete and move within a kit return the kit they changed, samples
  and all, read back right after the edit (`SampleEditKit.kit`). The
  renderer shows it as a read made when it arrived (`applyReadKit`), and
  makes no `get-kit`. If it can't be read back, the renderer reads the
  kit as before.
- Delete and move also return the edited voices' rows as they were
  (`voicesBefore`), read right before the edit, for the undo snapshot, so
  the renderer no longer fetches them first. Main runs one handler's
  synchronous work at a time, so nothing changes the rows in between.
- A rescan, an undo or redo of a sample edit, and a move to another kit
  (UC-22, not reachable from the UI) still read the kit with `get-kit`.
- **Verified by:** the drop and delete budgets pin `get-kit` and
  `get-all-samples-for-kit` at none; the integration budgets for add,
  delete and move are raised by the read-back and the undo read, which
  replace the renderer's own calls, and the test checks what each
  returns; tests for `applyReadKit` against an older reload, and for the
  undo actions recorded from what main returned.

Still open after step 3: a step toggle whose save returns while the next
toggle is still saving shows the pattern without the newer toggle until
that one's save returns. Fixing it means the sequencer keeps edits that
are still saving over a kit that comes back, which changes what's on
screen: tracked in #778.

### 4. List changes without a full reload (done in the PR that closed #452)

- Create and duplicate return the new kit, samples and all, read back
  after it's added; the renderer adds it to the list (`addKit`). Delete
  takes its kit off the list (`removeKit`). Only Scan all, a write, a bank
  rename, setup and store changes reload every kit. If a new kit can't be
  read back, the kits are read again as before.
- Both use the read numbering from step 1: a full load sent before a kit
  was created keeps the new kit, a full load sent before a kit was deleted
  doesn't bring it back, and neither does a reload of the deleted kit sent
  before. A full load sent after either shows what it reads.
- **Done, ahead of the rest of this step:** a failed full reload (Scan all,
  a write, a bank rename, creating, duplicating or deleting a kit) keeps
  the kits on screen instead of emptying the grid, with no message.
  Approved by Pete on #452 (2026-10-08). Loading at startup or after a
  store change still empties the list when the store can't be read: the
  kits on screen may belong to another store.
- **Verified by:** unit tests for each list change against older and newer
  reads, and for the failure (`useKitDataManager.test.ts`, which also
  checks a store change still empties the list); the hooks passing on the
  kit main returned; `kitService` returning the new kit; e2e budgets for
  creating, duplicating and deleting a kit, with no `get-all-kits`; the
  create, duplicate and delete e2e flows.

The renderer kits store (architecture review step 8) then replaces
`kits`, `allKitSamples` and the per-component copies, patched from step 3's
results.

## Decisions

Approved by Pete on #452 (2026-10-08):

- **A single-kit reload that fails** (step 1) keeps the kit on screen,
  where any failed reload used to empty the kit list. After every kind of
  edit (samples, steps, trigger conditions, voice names, stereo, sequencer
  settings, slices) and after an undo, it shows the #605 message, "Couldn't
  load the samples for kit X. Try reopening it." No new wording. The
  message stack drops a repeat of a message already showing (#657), so
  several failed reloads show it once.
- **A failed full reload** (step 4) keeps the kits on screen instead of
  emptying the grid. A load at startup or after a store change still
  empties it.

## Not covered

- Cross-kit moves (UC-22) aren't reachable from the UI. If they're built,
  the move must reload, or patch, the target kit too.
- An undo for a kit that isn't open doesn't reload it, as before.
