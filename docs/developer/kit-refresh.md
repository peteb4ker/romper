<!--
title: Kit refresh after an edit - Specification
priority: medium
status: in progress
updated: 2026-10-08
context_size: small
implementation_status: step 1 in #765; steps 2-4 planned
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
- **A full reload is still right** when the list itself changes: startup and
  store changes, setup, Scan all, a finished write (it clears modified flags
  on many kits), a bank rename (bank names on many kits), and creating,
  duplicating or deleting a kit (until those return what they changed, step
  4).
- **What the user sees doesn't change**, apart from speed. A reload that
  fails keeps what's on screen and says so (see Decisions).

## Steps

One PR each. Earlier PRs say `Part of #452`; the PR that finishes step 3
says `Fixes #452`. Numbers live in [`tests/perf/budgets.ts`](../../tests/perf/budgets.ts),
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

### 2. Drop the extra reloads and refetches

- `KitVoicePanels` builds `sampleMetadata` from `kit.samples` (full rows,
  the same columns as `get-all-samples-for-kit`) instead of fetching on
  every kit change.
- A drop reloads once: each add already reloads, so the reload when the drop
  finishes (`onBatchDropComplete`) goes.
- The drop's duplicate check and the undo snapshots before a delete or move
  read the open kit's rows the renderer already holds, or main returns the
  rows it replaced, instead of another `get-all-samples-for-kit`.
- **Verified by:** the drop, delete and step-toggle budgets fall and are
  tightened; tests for the metadata copy following a reload.

### 3. Edits return the changed kit

- Add, delete, move, step pattern, trigger conditions, slices, voice
  settings, voice name, stereo link and rescan return the
  `KitWithRelations` they changed, read in the same transaction. The
  renderer patches with it, numbered like a read, and makes no `get-kit`.
- Main serializes writes, so each result is newer than the one before; a
  step toggle that returns while the next is saving no longer shows the
  older pattern for a moment.
- **Verified by:** the step-toggle `total` budget reaches its target;
  integration budgets for each operation's statements; ordering tests with
  results instead of reads. This PR says `Fixes #452`.

### 4. List changes without a full reload

- Create and duplicate return the new kit and delete removes its kit, so
  only Scan all, a write, a bank rename, setup and store changes reload
  every kit.
- A failed full reload (Scan all, a write, creating or deleting a kit)
  keeps the kits on screen instead of emptying the grid. Approved by Pete
  on #452 (2026-10-08).
- **Verified by:** unit tests for each list change and for the failure;
  the create and delete e2e flows.

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
  emptying the grid.

## Not covered

- Cross-kit moves (UC-22) aren't reachable from the UI. If they're built,
  the move must reload, or patch, the target kit too.
- An undo for a kit that isn't open doesn't reload it, as before.
