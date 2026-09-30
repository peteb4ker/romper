# Backlog

The status of every known issue, in priority order. Details, evidence and
suggested fixes live in the findings register,
[`aidlc-docs/inception/reverse-engineering/code-quality-assessment.md`](aidlc-docs/inception/reverse-engineering/code-quality-assessment.md).
This file tracks what's being done about each item.

## How to use it

- **Pick** from Now, top down, then Next. Owner items need Pete.
- **Check before starting:** `gh pr list --state open --search "RE-NN"`, and the
  item's Status here. Skip anything already in progress.
- **Claim** by pushing a branch named after the item (`fix/re-NN-...`) and
  opening a draft PR whose title ends with `(RE-NN)`. The open PR is the
  claim, and it's visible to local and cloud sessions alike.
- **Update the Status here in the same PR** that changes it. When the fix
  merges, move the row to Done with the PR number. Keep one row per item so
  concurrent PRs only conflict on the lines they touch.
- **New findings:** add them to the register with the next free `RE-` ID,
  then add a row here.

## Now

| ID | Severity | Area | Item | Status |
|---|---|---|---|---|
| RE-03 | High | Security | The renderer can read any file (up to 256 MiB), list any folder, create and copy folders, extract a downloaded archive into any folder, write a probe file anywhere, and create or insert into a database in any folder. | in progress (`fix/re-03-scoped-fs-ipc`) |

## Next

| ID | Severity | Area | Item | Status |
|---|---|---|---|---|
| RE-06 | High | Sync | Sync writes `<card>/<kit>/<voice>/<file>`, but SD import and rescan read only WAVs at the kit root and take the voice from the first character of the file name. | open; needs a decision on the card layout (confirm what the Rample firmware reads) |
| RE-05 | High | Sync | Sync only adds or overwrites. Removed, moved or renamed samples and deleted kits stay on the card. | open |
| RE-07 | High | Sync | Sync blocks the main process for the whole run: every file is copied or converted with synchronous calls, so no IPC (including Cancel) runs until it finishes. | open |
| RE-08 | High | Sync | The WAV header parser requires the `fmt ` chunk at byte 12 with size 16. | open |
| RE-11 | High | Renderer | Toast messages never appear. `useMessageDisplay()` creates local state. | open |
| RE-12 | High | Renderer | There is no React error boundary. Any exception during render unmounts the whole tree and leaves a blank window with no way to recover. | open |
| RE-13 | High | Playback | The voice choke can fail after any kit refresh. Step, condition, mode, volume and alias edits reload all kits, which resets the "playing" map while samples are still playing, so the next trigger on that voice does not stop them. | open |
| RE-14 | High | Playback | Each play connects a new analyser (and a splitter for stereo) to the slot's gain node, and nothing disconnects them. | open |
| RE-16 | High | Platform | macOS auto-update does not work in packaged builds. The main process is built as a browser-style library, so the bundled `update-electron-app` gets an empty `node:assert` and a `require` shim that throws under ESM. | open |
| RE-17 | High | Release | The release workflow runs no unit, integration or e2e tests and does not check that the tag is on `main` or that CI passed. | open |
| RE-15 | High | Platform | Electron 39.8.10 is out of support (its last patch was 2026-05-05; supported majors are 42 to 44). | open (#348 moved to Electron 41; 42+ is supported) |
| RE-18 | High | Release | Signing is silently optional. Windows v1.3.1 shipped **unsigned** (the Azure step was skipped because `AZURE_CLIENT_ID` is empty). | open |
| RE-19 | High | Release | Release secrets are more exposed than needed: the base64 p12 is a job-level environment variable during `npm ci` (the lifecycle scripts of about 1,500 packages) on all three runners; checkout keeps the token while the workflow has `contents: write`; `id-token: write` is unused; third-party actions that receive secrets are pinned by tag, not by SHA. | open |
| RE-20 | High | Docs | User-facing docs promise behaviour that does not exist. README, the manual and the website promise an automatic backup and rollback before sync; there is no backup code. | open |

## Owner (needs Pete)

| ID | Item | Status |
|---|---|---|
| OPS-1 | Branch protection on `main`: require `e2e-tests-check`, enforce for admins, require linear history. The repo is public, so the Free plan supports all three. | open |
| OPS-2 | Azure Trusted Signing for Windows releases (#276, RE-18) | open |
| OPS-3 | Delete the unused `APPLE_ID`, `APPLE_ID_PASSWORD`, and `APPLE_TEAM_ID` secrets | open |

## Later

| ID | Severity | Area | Item | Status |
|---|---|---|---|---|
| RE-21 | Medium | Settings | Only `localStorePath` and `sdCardPath` are loaded at startup. | open |
| RE-22 | Medium | IPC | `update-kit-metadata` spreads the renderer's object straight into the update. | open |
| RE-23 | Medium | Banks | Clearing a bank name deletes the RTF file but keeps the name in the database, so it returns on reload and is written to the card at the next sync. | open |
| RE-24 | Medium | Archive | The downloaded archive (about 313 MiB) is never deleted after a successful setup. | open |
| RE-25 | Medium | Validation | No range or enum checks in main for volume (0 to 100), gain (-24 to +12), BPM (30 to 180) or sample mode. | open |
| RE-26 | Medium | Samples | Replace deletes the old sample, then adds the new one, with no transaction. | open |
| RE-27 | Medium | Samples | Moving a sample to another kit is not atomic and rebuilds the row from `source_path` only, dropping gain, WAV metadata and the stereo flag. | open |
| RE-28 | Medium | DB | Multi-step writes run without a transaction: kit plus its four voices; delete plus reindex (the reindex opens a second connection while the first is open); write plus the modified flag; scan insert plus metadata. | open |
| RE-29 | Medium | Sync | Mono conversion is effectively dead. It runs only when `samples.is_stereo` is true, but that is `false` for every added or imported sample and is guessed from the file name on rescan (`/stereo\ | partly done (#360 stops the scan guessing stereo from filenames) |
| RE-31 | Medium | Setup | A failed SD-card setup cannot be retried: the directory copy uses a non-recursive `mkdirSync`, which fails because the earlier cleanup left the copied kit folders behind. | open (needs a decision: a recursive copy would overwrite same-named kit folders; see #359) |
| RE-32 | Medium | Kits | Kit names are checked inconsistently. Import accepts names such as `Drum01`; `insert-kit` checks nothing; `kitService` rejects anything outside `^\p{Lu}\d{1,2}$`, so such kits cannot be deleted or duplicated. | open |
| RE-33 | Medium | DB | Migration upkeep: 0008 is missing and there are two 0009 migrations, handled by a custom repair that runs `ALTER` statements outside a transaction. | open |
| RE-34 | Medium | Setup | Voice naming in the first-run wizard does nothing: its alias writes are rejected because the store path is saved only afterwards. | open |
| RE-35 | Medium | Sync | "Modified since sync" is set only by sample add, delete and move. | partly done (#360: scan sets it when it adds samples) |
| RE-36 | Medium | Performance | Almost every edit reloads the whole library (`getKits()` with all samples); sample operations cost three or more IPC calls. | open |
| RE-37 | Medium | Renderer | Favourites have two sources of truth. The browser keeps a shadow map that overrides the database value; the editor toggles through `useKitDataManager`. | open |
| RE-38 | Medium | Renderer | Keyboard shortcuts clash. "F" jumps to bank F and toggles the favourite on the focused kit. | open |
| RE-39 | Medium | Renderer | Kit-grid keyboard navigation is broken: index 0 is treated as "nothing focused", so arrow keys and Enter do nothing from the first kit (the default). | open |
| RE-40 | Medium | Renderer | More silent failures: stereo link errors are ignored; rejected drops (duplicate, bad format, full voice) go only to the console; undo errors never reach the UI; the sync-failure toast reads a stale value. | open |
| RE-41 | Medium | Renderer | Toggling "editable" and editing the kit alias rethrow IPC errors into click and blur handlers with no catch, giving unhandled rejections. | open |
| RE-42 | Medium | Setup | Truncation guidance ("some samples were skipped") is never shown after SD or factory imports, because the UI reads the warnings from before `initialize()` ran. | open |
| RE-43 | Medium | Scan | "Scan All" from the menu scans only the kits that pass the current filters, and with the editor open it scans banks only. | open |
| RE-44 | Medium | Settings | The "Confirm destructive actions" preference is shown but never read; sample delete and replace run immediately. | open |
| RE-45 | Medium | Playback | Playback triggers and sample metadata are keyed by file name, so two samples with the same name in one voice play together (bypassing the choke), and same-named files in different voices share gain and metadata in the UI. | open |
| RE-46 | Medium | Performance | While a sample plays, the waveform redraws its full envelope and calls `getComputedStyle` on every animation frame. | open |
| RE-47 | Medium | Performance | Memoisation is defeated: inline props break `React.memo` on the containers and grid, the grid's `itemData` is rebuilt every render, and the menu and editor key listeners re-subscribe on every render. | open |
| RE-48 | Medium | Accessibility | A `grid` contains `option` children; the gain knob (`role="slider"`) has no keyboard support; 5 inputs have no label; trigger conditions can only be set by right-click; 6 modals have no dialog role, focus trap or Escape handling. | open |
| RE-49 | Medium | Dependencies | Build tools (`drizzle-kit`, `@tailwindcss/vite`, `@vitejs/plugin-react`, `@typescript-eslint/eslint-plugin`) and unused packages sit in `dependencies`. | open |
| RE-50 | Medium | CI | Coverage thresholds are not checked on pull requests, and the margin is 0.28 points on functions and 0.40 on lines. | partly done (#352 runs coverage on PRs; the margin is still thin) |
| RE-51 | Medium | Tests | Test code is excluded from type-checking; 3,048 errors in 195 test files. | open |
| RE-52 | Medium | CI | E2E is not a required check; PRs run it on Ubuntu only, with no retries. | blocked on OPS-1 (make e2e a required check) |
| RE-53 | Medium | CI | SonarCloud never gates PRs (it runs on `main` only and is `continue-on-error`). | partly done (#352 analyzes PRs; not a required check) |
| RE-54 | Medium | Dependencies | 30 packages are at least a major version behind. Forge 8 would clear 19 High advisories in the Forge chain. | open |
| RE-55 | Medium | Release | macOS builds are arm64 only; Linux and Windows are x64 only. | open |
| RE-56 | Medium | Dead code | About 942 LOC of unused main-process files (`stereoSyncProcessor`, `rampleNamingService`, `db/fileOperations`, `stepPatternUtils`, `sampleSlotService`, two utils) and about 1,100 LOC in the renderer (9 test-only modules, the unreachable `AboutView` route and `ValidationResultsDialog`). | open |
| RE-57 | Medium | Contract | The bridge contract does not bind main. `SyncChangeSummary` does not match what main returns (the renderer casts it); `SyncProgress` is defined four times with different fields and status values; several return types differ from the contract (null versus undefined, `unknown`, an `"overwrite"` mode main rejects). | open |
| RE-58 | Medium | Tooling | The pre-commit tests fail with Vitest worker-start timeouts when the machine is busy (load average above ~20, for example several sessions testing at once), because `vitest.config.fast.ts` always starts 10 workers. | open |

## Done

| ID | Severity | Area | Item | Status |
|---|---|---|---|---|
| RE-04 | High | Scan | "Scan Kit" on a non-editable kit, and "File > Scan All" on every kit, delete all of the kit's sample rows and rebuild them from `<store>/<kit>/*.wav`. | done (#360) |
| RE-09 | High | Sync | Validation errors (such as missing source files) and warnings are built and then dropped. | done (#364) |
| RE-30 | Medium | Config | `ROMPER_LOCAL_PATH` is honoured by kit and DB handlers but ignored by sample, scan, sync and audio-buffer code. | done (#355) |
| RE-02 | High | Security | The `will-navigate` guard compares `URL.origin`, which is `"null"` for every `file://` URL. | done (#358; the IPC sender check ships with RE-03) |
| RE-10 | High | Setup | If setup fails, the cleanup deletes `<target>/.romperdb` without checking that this run created it. | done (#359) |
| RE-01 | Critical | Sync | "Clear SD card before writing" deletes every file and folder at the chosen path. | done (#351) |
