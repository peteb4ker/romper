<!--
title: Fixing what the full-pipeline validation found - Plan
priority: high
status: plan
updated: 2026-10-01
context_size: medium
implementation_status: RE-29 in #404, RE-64 in #401, validation CI in #403, RE-65 in #406, RE-24 in #405, hygiene in #409, RE-69 in #407, e2e error guard in #PR; the rest to do
-->

# Fixing what the full-pipeline validation found

The full-pipeline validation (`npm run validate:full`, RE-67; see
[`validation-and-traceability.md`](validation-and-traceability.md)) and the
audit behind it found the issues below. This plan orders the fixes into PRs,
says how each one is proven, and which can run in parallel sessions.

Two rules for every PR here:

- **The harness proves the fix.** A bug the harness reports as known
  (`knownBug: "RE-NN"`, or an expected message tagged `ref: "RE-NN"`) loses
  its marker in the PR that fixes it. A known-bug check that starts passing
  fails the run, so a marker can't outlive its bug. Bugs the harness can't
  see yet get a harness step or a focused test in the same PR.
- **Focused tests at the lowest layer that can see the bug**, plus a
  `[UC-NN]` tag in the test title (use case IDs are listed in the
  validation plan).

Severity and details for each ID are in the findings register
(`aidlc-docs/inception/reverse-engineering/code-quality-assessment.md`).

## Status

| Item | Severity | What | PR | Status |
|---|---|---|---|---|
| RE-29 | High | Stereo files on unlinked voices weren't mixed to mono | #404 | done in PR |
| RE-64 | High | No way to create a kit in an empty bank or library | #401 | in review (another session) |
| RE-70 | Medium | `file://` archive URLs weren't decoded (Windows, spaces) | #403 | done in PR |
| RE-69 | High | Unlinking a stereo pair silently does nothing when the voice holds a 2-channel file; dead `is_stereo` rules | #407 | done in PR |
| RE-42 | Medium | No truncation notice after setup | #410 | done in PR |
| RE-34 | Medium | Setup's voice naming does nothing; 2,373 file reads over IPC | 3 | to do |
| RE-66 | Medium | Cancel during setup quits mid-import and leaves a store that blocks a retry | 4: #408 (step 1) | step 1 done in PR; step 2 to do |
| RE-24 | Medium | Download has no status, redirect, timeout or checksum; temp zip kept; extraction errors ignored | #405 | done |
| RE-65 | Medium | Edit > Undo/Redo never reach Romper's undo | #406 | done |
| Low | Low | Test and tooling hygiene (below) | #409 | done |
| RE-67 | Medium | E2E error guard; use case register and traceability | #PR (8), 9 | 8 done in PR; 9 to do |
| Docs | Low | About 29 doc promises the code doesn't keep | 10 | to do |

## 1. Stereo is a voice setting, everywhere (RE-69)

**Problem.**
- `unlinkVoices` (`useStereoHandling.ts:339-349`) refuses to unlink a voice that holds "stereo samples". `KitVoicePanels.tsx:130` derives that from `is_stereo || wav_channels === 2`, and `handleVoiceUnlink` (`KitVoicePanels.tsx:199-218`) ignores the refusal. Unlinking a voice that holds any 2-channel file silently does nothing.
- The other `samples.is_stereo` readers are dead or wrong under the "stereo is a voice setting" invariant:
  - the move rules in `sampleValidator.ts` (`checkStereoConflicts`, `validateStereoSampleMove`);
  - `validateVoiceAssignment` and `analyzeSampleAssignment` (no callers);
  - the `is_stereo` fields in the undo payloads (`shared/undoTypes.ts`, `useSampleManagementUndoActions.ts`).
- The external drag highlight treats "two files dragged" as stereo (`useExternalDragHandlers.ts:86`).

**Fix.**
- Unlinking just clears `voices.stereo_mode`; the next write mixes the voice's stereo files to mono (RE-29).
- Delete the `is_stereo` move rules. If a rule is wanted, make it voice-level: nothing moves into voice N+1 while voice N is linked.
- Delete the dead helpers and undo fields.
- Key the drag highlight on `voices.stereo_mode`.
- Drop the `samples.is_stereo` column in a migration (no data migration: nobody has a store to preserve).

**Tests.**
- `useStereoHandling.test.ts`: unlink succeeds with 2-channel files present.
- e2e `[UC-28]`: link, drop a stereo file, unlink, and the badge goes.
- Harness: after the writes, unlink voices 1+2 and write again. The 2-channel files on voice 1 must reach the card as mono mixes.

**Size:** M. Can run in parallel with everything except item 3, which shares the wizard insert path; whichever lands second rebases.

## 2. Truncation notice after setup (RE-42)

**Problem.** `handleInitialize` (`LocalStoreWizardUI.tsx:108-121`) reads `state.truncationWarnings` from the render in which Initialize was clicked, so it's always empty. A factory or SD import therefore calls `onSuccess()` and closes, and the guidance never shows. Warnings are also never reset at the start of `initialize`.

**Fix.**
- `initialize()` returns `{ success, truncationWarnings }`, and `handleInitialize` uses the result.
- Reset the warnings when a run starts.

**Tests.**
- `LocalStoreWizardUI.test.tsx`: warnings returned → `truncation-warnings` shown, `onSuccess` only after Continue.
- The wizard e2e gets a fixture with 13 files on a voice and asserts the notice.
- Harness: drop `knownBug: "RE-42"`; the check becomes "setup names the 7 files left out".

**Size:** S. Do it before item 3, which keeps the same contract.

## 3. Setup imports kits in main (RE-34, plus the wizard's IPC load)

**Problem.**
- The wizard's voice naming writes aliases through `update-voice-alias`, which resolves the store from settings. The store isn't saved until the end, so every write fails with "No local store path configured" (458 warnings per factory import).
- The wizard reads every WAV over IPC (2,373 `read-file` calls) for a WAV analysis it then discards.
- It makes one `insert-sample` call per file.
- It never fills the `wav_*` metadata.
- It logs a normal "no voice types inferred" outcome as a warning, 43 times per import.

**Fix.**
- Main already has the right routine: `mergeKitScan(dbDir, kit, folder, io)` (`kitScanOperations.ts`). It runs in one transaction, fills slots 1-12, reports files over the limit as `skippedFiles` (`voice_full`), fills WAV metadata and infers voice names.
- Add one setup-scoped IPC, `setup-import-kits(dbDir)`. It:
  - is guarded like `insert-kit` by `checkDatabaseDirAccess`;
  - runs `addKit` + `mergeKitScan` per kit and reports progress;
  - clears `modified_since_sync` on the imported kits;
  - returns `skippedFiles` as the truncation warnings (item 2's contract).
- Delete the wizard's scanning step and insert loop (`useLocalStoreWizardScanning.ts`, `createAndPopulateDb` in `useLocalStoreWizardFileOps.ts`).
- The voice-inference outcome is logged at debug level.

**Tests.**
- A main-side unit test for the import: aliases set, slots, `skippedFiles`, `modified_since_sync` false.
- The new channel rejects a `dbDir` outside the allowed roots.
- IPC parity.
- `useLocalStoreWizard.test.ts`: no `readFile` or `updateVoiceAlias` calls.
- Harness:
  - remove the RE-34 and voice-inference expected messages;
  - assert voice names in the store (the factory kits with drum names get them);
  - assert `wav_*` metadata on every imported sample;
  - setup time is reported (expect a large drop).

**Size:** M. One session, after item 2.

## 4. Cancel during setup (RE-66, corrected)

**Problem (corrected by the audit).**
- On first run, Cancel quits the app: the wizard's close is `close-app` while no store is configured.
- So the import dies mid-step, nothing is cleaned up, and the half-built `.romperdb` makes the next launch refuse the same folder ("already contains a Romper local store").
- Outside first run, Cancel closes the wizard while the work continues.

**Fix.**
- **Step 1 (S): safety net.** Main runs `cleanupFailedSetup` on quit for every store this run created that isn't the configured one. The Cancel prompt says it will stop setup.
- **Step 2 (M): real cancel, after items 3 and 5.**
  - A `cancel-setup` IPC aborts main's `AbortController` for the download and extraction (item 5) and the per-kit import (item 3).
  - The wizard waits for the abort, runs the existing failure cleanup, then closes or quits.
  - Cleanup removes only the kit folders this run created.

**Tests.**
- `localStoreSetupService.test.ts`: quit cleanup skips the configured store.
- `archiveService.test.ts`: abort mid-download and mid-extract rejects, and the temp zip is deleted.
- Wizard hook test: cancel between kits runs cleanup and never saves the setting.
- Harness: a new scenario cancels setup at the import step, relaunches with the same profile, and sets up the same folder successfully `[UC-02]`.

**Size:** S, then M.

## 5. Archive download and extraction (RE-24)

**Problem.**
- `downloadArchive` (`archiveUtils.ts:53-77`) saves any response body, including a redirect or error page, with no timeout and no response error handler.
- The temp zip is deleted only on failure.
- Extraction's mkdir and write errors are logged, and extraction still reports success.

**Fix.**
- Download with `fetch` (`redirect: "follow"`), require `response.ok`, and stream to `<tmp>.part`, hashing as it goes.
- Use an idle timeout (no data for 60 s), and take the item 4 abort signal.
- Delete the temp file in `finally`.
- Pin `SQUARP_FACTORY_SAMPLES_SHA256` next to the URL. Check it only for the default URL. A mismatch says the archive changed and suggests updating Romper or setting up from an SD card. A unit test keeps the constant equal to `tests/validation/factory-archive.json`.
- Extraction calls `fail()` on every write or mkdir error. The existing tests that lock in "logs but continues" are inverted.

**Tests.**
- `archiveUtils.test.ts`: non-2xx, redirect, idle timeout, hash mismatch, write error.
- `archiveService.test.ts`: temp file removed on success and on failure.
- Harness `--fresh` in the manual workflow once (real download through the app).

**Size:** M. Parallel with items 1, 2 and 6.

## 6. Edit menu undo (RE-65)

**Problem.** The Edit menu uses native `undo`/`redo` roles (`applicationMenu.ts:119-120`), so the menu items never reach Romper's undo. Keyboard Cmd/Ctrl+Z works only through the renderer's key listener.

**Fix.**
- Give the items click handlers that send `menu-undo`/`menu-redo`.
- In the renderer, a focused text field gets native undo (as the role did), and anything else gets Romper's undo, called directly rather than through a synthetic keydown.

**Tests.**
- `applicationMenu.integration.test.ts`: the items send the channels.
- Handler test: native undo with an input focused.
- e2e `[UC-26]`:
  - clicking Edit > Undo through `Menu.getApplicationMenu()` undoes a sample add;
  - one Cmd+Z is exactly one undo step on macOS.

**Size:** S. Parallel with everything.

## 7. Test and tooling hygiene (Low)

One PR:

- An empty `ROMPER_LOCAL_PATH` no longer counts as an override (`localStoreService.ts:67-80`; every other reader already treats it as unset). The e2e specs stop setting it, since #400 isolates userData. The Test Mode banner only shows for a real override.
- Delete `isTestEnvironment` (`useLocalStoreSetupFlow.ts:43-46`): `VITE_ROMPER_TEST_MODE` is never set, and `MODE === "test"` makes unit tests cover only the test-only branch.
- `scripts/capture-screenshots.ts` runs with a temp `--user-data-dir` and a pre-written `romper-settings.json`, never the installed app's settings.
- `sync-unsaved-state.integration` uses a temp folder.
- `coverage:total` reads a folder that holds the merged JSON.
- `scripts/worktree-create.js` prints the failing command's error instead of a bare "Failed to create worktree".

**Size:** S. Parallel with everything.

## 8. E2E error guard (RE-67, PR 3 of the validation plan)

A shared Playwright fixture built on the harness's `MessageCollector` fails any e2e test on an unexpected console error, page error, error toast or error boundary. Existing specs declare what they expect. This lands after item 7, which removes the Test Mode banner noise.

**Size:** M.

## 9. Use cases and traceability (RE-67, PR 4)

- `docs/developer/use-cases.md` with UC-01 to UC-37: status, entry points, tests and known issues.
- Tests tagged `[UC-NN]`.
- `scripts/traceability.mjs` generates the matrix, and a CI check fails on unknown IDs or supported use cases without a test above unit level.

**Size:** M.

## 10. Docs that promise what the code doesn't do

Fix the docs, or build the feature if it's wanted. The audit list is in the validation plan ("Doc corrections"). RE-29 already corrected the manual's stereo section; the rest goes in one docs PR after items 1-6 settle, so it describes the code as it ends up.

**Size:** M (docs only).

## Order and parallel sessions

```
main thread:  RE-29 (#404) → 2 (RE-42) → 3 (RE-34) → 4 step 2 (RE-66) → 10
session A:    1 (RE-69 stereo)
session B:    5 (RE-24 download) → 4 step 1 (RE-66 safety net)
session C:    6 (RE-65) → 7 (hygiene) → 8 (error guard) → 9 (traceability)
in flight:    RE-64 (#401), validation CI (#403)
```

Each PR:
- updates its `BACKLOG.md` row and the register;
- removes its harness markers;
- runs `npm run validate:full` before it's opened, and quotes the result in the description.

The manual workflow runs on all three platforms after items 3 and 5, which change setup the most.
