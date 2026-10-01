<!--
title: Full-pipeline validation, test layering and traceability - Specification
priority: high
status: specification (approved 2026-10-01)
updated: 2026-10-01
context_size: large
implementation_status: harness built (PR 2); PRs 3 onward to do
-->

# Full-pipeline validation, test layering and traceability

## Goals

1. **Prove the main promise end to end, on demand.** Starting from nothing:
   download Squarp's factory samples, create a local store, add a kit with
   stereo samples, write the store to a folder, and compare every WAV written
   with what it should be, byte for byte. Run it against the real built app,
   driven through its UI.
2. **Capture every error and warning** the app shows or logs during that run,
   and fail on anything unexpected.
3. **Find latent bugs** along the way and register them (`RE-` IDs).
4. **Layer in the tests the suites are missing**, including the focused tests
   that come out of the harness.
5. **Trace use cases to features, code and tests**, so we can show what Romper
   supports and how each use case is implemented and verified.

The harness is too heavy for the normal e2e suite (a ~313 MiB download, 2,373
files written twice). It runs on demand: locally with one command, and in CI
from a manual workflow.

## Where we are (2026-10-01)

From a read-only audit of the docs, the test suites and the pipeline.

### Tests

- About 263 unit files (~3,800 tests), 30 integration files (~576 tests,
  mostly a real SQLite DB and real temp files) and 14 e2e specs (36 tests,
  the real built app).
- **No real-world audio above unit level.** Every e2e WAV is a 100-150 ms
  mono, 16-bit, 44.1 kHz file. The factory "download" e2e uses a 928-byte zip
  of 4-byte stub files.
- **Stereo has never been through a sync** at integration or e2e level.
- **Almost nothing checks bytes written to the card.** One assertion in the
  codebase compares bytes (a JUNK-first file in `sync-wav-formats`).
  Conversion tests decode with the same codec that encoded, so they aren't
  independent.
- **The setup wizard's e2e stops at "the database file exists"**; nothing checks
  the kits, samples or banks it imported, and the wizard → browser → sync
  chain is never run as one flow.
- **No e2e for any editing flow**: kit create, duplicate or delete; sample add,
  replace, move or delete; voice settings; stereo link; undo/redo; preferences.
- **Nothing fails a test on an unexpected error.** E2E console listeners only
  log; no spec listens for `pageerror`; only `messages.e2e` asserts zero
  toasts, and only at launch. Unit tests mock `errorHandling` globally.
- **Hollow or misleading tests:** `sync-workflow.e2e` never syncs despite its
  test names; `debug-navigation-logic.e2e` tests a copy of the logic inside
  `page.evaluate`; `sync-ipc.integration` mocks the sync service and `fs`.
- About 20% of `expect` calls are `toHaveBeenCalled*` on mocks.
- `coverage:total` reads `coverage/merged`, which holds only `lcov.info`, so the
  total it prints is probably empty.
- `VITE_ROMPER_TEST_MODE` is read by `useLocalStoreSetupFlow.ts` but nothing sets
  it, so those branches never run.
- `sync-unsaved-state.integration` writes into `tests/integration/` rather than
  a temp directory.

### Use cases and docs

- No document gives use cases or requirements IDs. The PRD
  (`product-requirements.md`, last updated 2025-07-18) has 37 user stories and
  ~83 functional requirements without IDs. `aidlc-docs` has T1-T10 business
  transactions, written against an older commit and now partly wrong.
- Nothing maps tests to features or requirements.
- About 29 doc promises are missing or contradicted by the code (listed in
  "Doc corrections" below), from a "Treat Stereo as Mono" setting to a Linux
  AppImage.

### Latent bugs found during the audit

Registered in the findings register and `BACKLOG.md` with this spec:

| ID | Severity | Area | Finding |
|---|---|---|---|
| RE-29 (raised to High) | High | Sync | A stereo sample on a mono voice is written to the card as stereo. Mono conversion keys on `samples.is_stereo`, which every add and import path writes as `false`. Converting to mono is the intended behaviour. |
| RE-64 | High | Kits | A kit can only be created in a bank that already has one, so an empty local store can't create its first kit. |
| RE-65 | Medium | Undo | Edit > Undo and Edit > Redo use Electron's native roles and never reach Romper's undo; only Cmd/Ctrl+Z works. |
| RE-66 | Medium | Setup | Cancel in the setup wizard closes it but leaves the download and import running in main. |
| RE-67 | Medium | Tests | The test gaps listed above; this spec is the fix. |
| RE-24 (exists) | Medium | Archive | The ~313 MiB zip is never deleted; the download has no status check, redirect handling or timeout. |
| RE-42 (exists) | Medium | Setup | The truncation notice after a factory import is never shown. |
| Low list | Low | Setup, tests | The wizard reads every WAV over IPC to name voices; `VITE_ROMPER_TEST_MODE` is never set; one integration test writes into the source tree. |

`sd-card-layout.md` said the factory archive has 137 kit folders and 2,374
WAVs. It has 183 kit folders and 2,373 WAVs; S62 voice 2 has 18 files and S67
voice 4 has 13, so 7 never reach the card. Fixed with this spec.

## 1. The full-pipeline validation

### What it does

Run against the built app (`dist/`), driven through the UI with Playwright's
Electron support, as a user would:

1. **Start clean.** Fresh temp folders for the local store, the "SD card" and
   Electron's user data (settings, window state), so a run never touches the
   developer's real library or settings.
2. **Download the factory archive** through the setup wizard's "Squarp" option,
   into the new store. By default the archive comes from a local cache (below);
   `--fresh` downloads it from `data.squarp.net` as a user would.
3. **Finish setup**, including the post-setup guidance (the factory set has
   voices over 12 samples, so the truncation notice should appear; today it
   doesn't, RE-42) and land in the kit browser.
4. **Verify the import** against the archive itself: every kit folder is a kit;
   every voice has the first 12 files in `localeCompare` order; the bank names
   match the RTF file names; the browser shows the right kit count.
5. **Create a new kit** with "Add kit" (in bank A it takes the first free
   slot), open it, make it editable.
6. **Add samples through the real drop path**: put real files on a hidden
   `<input type=file>`, build a `DataTransfer` from them and drop it on
   `drop-zone-voice-N`, so `webUtils.getPathForFile`, `register-dropped-file`,
   validation and `add-sample-to-slot` all run as for a Finder drop. The harness
   generates the source files itself:
   - Voices 1+2, linked as stereo: a stereo 16-bit/44.1 kHz file (copied byte
     for byte, written once, on voice 1), a stereo 24-bit/48 kHz file
     (converted, stays stereo) and a mono 16-bit/44.1 kHz file (copied).
     Nothing is written on voice 2.
   - Voice 3 (not linked): a stereo 16-bit/44.1 kHz file. **Expected: converted
     to mono**, the intended behaviour. Today this fails (RE-29); the harness
     reports it as a known failure until RE-29 is fixed.
   - Voice 4 (not linked): a mono 32-bit float file (converted), and a mono
     16-bit file with +3 dB gain (converted).
7. **Write to the card**: open the write panel, check the summary (kit and
   sample counts, no removals on an empty card, the expected warnings), write,
   and wait for "Write Complete".
8. **Compare the card with the store** (below), then **sync again** and check
   the second write is a no-op for content (same bytes, nothing removed).
9. **Edit and sync again**: delete one sample and the new kit's last voice, then
   sync and check the card now mirrors the store (RE-05).

### Byte-for-byte rules

The expected card contents are worked out from the store's database after
setup (not recomputed), using `shared/rampleCardLayout.ts` for file names:

- **Copied files** (PCM, 8 or 16-bit, 44.1 kHz, at most 2 channels, no gain,
  not forced to mono): the card file must be **byte-identical** to the source,
  including any `JUNK` or `LIST` chunks. That covers all 2,366 factory samples
  that reach the card.
- **Converted files**: the card file must be a canonical 44-byte-header PCM
  WAV, 16-bit, 44.1 kHz, with the expected channel count. Its audio is checked
  **independently**: the harness has its own small WAV reader and reference
  conversion (channel average, gain, linear-interpolation resample, rounding)
  and compares sample by sample, allowing ±1 LSB. It doesn't use `wavCodec` or
  `formatConverter`, so a bug there can't hide itself.
- **Bank name files**: each named bank has `<L> - <name>.rtf` at the card root.
  Content is regenerated (`{\rtf1}`), so only names are compared.
- **Nothing else**: no extra files, no temp files, no per-voice subfolders, and
  `_save/` untouched (a pre-seeded `_save/A0.rpl` must survive).

### Capturing every error and warning

One collector, active for the whole run, records:

- renderer `console` messages at `warning` and `error` level, and `pageerror`
  (uncaught exceptions);
- the main process's stdout and stderr (`electronApp.process()`), parsed for
  `console.warn`/`console.error` output;
- every toast (`[data-testid^="message-"]`), through a `MutationObserver`
  installed at startup, since toasts disappear after 4-7 s;
- `wizard-error`, `error-boundary`, the write panel's `invalid-files`,
  `sync-warnings`, `summary-error` and "Write Failed";
- the IPC results the harness reads (sync outcome `warnings`, `skippedFiles`).

Expected messages are declared in the scenario with a reason, for example the
truncation notice for S62/S67, the voice-1 warning if a kit has none, and the
known CSP `frame-ancestors` console error. **Any message not on that list fails
the run** and appears in the report. The same collector becomes the e2e error
guard (section 2).

### Isolation, caching and running

- **User data**: Electron's user data goes to a temp folder. If
  `--user-data-dir` doesn't move `app.getPath("userData")`, main gains a small
  `ROMPER_USER_DATA_DIR` override, read before anything touches settings.
- **Archive copy**: every run used to mean another ~313 MiB from Squarp's
  server, so the harness keeps its own copy and only goes to Squarp when asked.
  - The archive's SHA-256 and size are recorded in
    `tests/validation/factory-archive.json`, beside the URL.
  - Locally the copy lives at `~/.cache/romper/RampleSamplesV1-2.zip`, outside
    the repo. The harness points `ROMPER_SQUARP_ARCHIVE_URL` at it (a
    `file://` URL), so the wizard's download path still runs.
  - In CI the copy is an `actions/cache` entry keyed by the SHA-256, so
    Squarp is hit once per archive version, not once per run.
  - `--fresh` (and the workflow's `fresh` input) downloads from Squarp through
    the app, as a user would, then checks the checksum. A mismatch fails with
    "Squarp's archive changed" and the new checksum, so updating the record is
    a deliberate edit.
  - The archive is Squarp's content, so it's never committed or published
    (no release asset, no artifact upload).
- **Running**: `npm run validate:full` builds the app and runs the scenario
  with its own Playwright config (`playwright.validation.config.ts`,
  `testDir: tests/validation`, files named `*.validation.ts` so the normal
  suite never picks them up, long timeouts, one worker). Hidden window by
  default; `--headed` to watch.
- **CI**: a manual (`workflow_dispatch`) workflow, `validate-full.yml`, runs it
  on macOS, Windows and Linux and uploads the report. Not on PRs. It's written
  as a reusable workflow (`workflow_call`), so the release workflow can add it
  as a gate later.
- **Report**: `validation-report/` with `report.md` (steps, timings, counts,
  comparison results, every captured message, known failures with their RE
  IDs) and `report.json`, plus screenshots at each step and a trace on failure.

Expected run time: a few minutes with the cached archive.

## 2. Tests to layer in

In rough priority order. Each new test names the use cases it covers (section 3).

**Integration (real files, real DB):**

1. Stereo through `syncService`: a stereo file on a linked voice is copied once;
   on an unlinked voice it is converted to mono (fails until RE-29); a linked
   voice's partner never gets a copy.
2. Conversion checked independently: 24-bit, 48 kHz, 8-bit, float, extensible
   and gain cases, compared with the reference conversion from the harness
   (shared test utility), not with `wavCodec`.
3. Cancel mid-write against the real sync service: nothing removed, nothing
   marked synced, files written so far intact, no temp files left.
4. Sync error paths: unwritable card, card removed during the write, a source
   deleted between the summary and the write.
5. Factory-shaped import: the wizard's import functions on a generated archive
   with the factory's layouts (JUNK-first, junk between, 13+ files in a voice,
   RTF bank files), checking kits, slot order and truncation.

**E2E (normal suite, light):**

6. A shared fixture that fails any e2e test on an unexpected `console.error`,
   `pageerror`, error toast or error boundary, using the harness's collector.
   Existing tests declare the messages they expect. Done in #411:
   `tests/utils/e2e-error-guard.ts`.
7. Editing flows: create a kit; add samples by a real drop; link and unlink
   stereo; rename a voice; delete and undo; move a sample.
8. First kit in an empty library (settles the "no Add kit card" question).
9. Wizard happy paths assert what was imported (kits, samples, banks), not just
   that the database exists.
10. Edit > Undo from the menu.
11. Replace `sync-workflow.e2e` with tests that sync, and delete
    `debug-navigation-logic.e2e` (it tests a copy).

**Unit:** where the harness finds a bug, a unit test pins the fix (as with
RE-13's choke tests).

## 3. Use cases and traceability

### Use case register

A new `docs/developer/use-cases.md` gives every supported use case an ID,
written from the user's side. The IDs are fixed here so tests can cite them
from the first harness PR:

- **Setup and local store**
  - UC-01 Set up from an SD card
  - UC-02 Set up from the factory archive
  - UC-03 Set up an empty library
  - UC-04 Choose an existing local store
  - UC-05 Recover from an invalid or missing store
  - UC-06 Change the local store
- **Browse and organise**
  - UC-07 Browse kits by bank
  - UC-08 Read kit card details
  - UC-09 Search kits
  - UC-10 Favourite kits
  - UC-11 Filter to kits modified since the last sync
  - UC-12 Name banks
  - UC-13 Scan a kit, or scan all
- **Kit lifecycle**
  - UC-14 Create a kit
  - UC-15 Duplicate a kit
  - UC-16 Delete a kit
  - UC-17 Make a kit editable and set its alias
  - UC-18 Step to the previous or next kit
- **Samples**
  - UC-19 Drop WAVs onto a voice
  - UC-20 Replace a sample
  - UC-21 Move samples within a kit
  - UC-22 Move a sample to another kit
  - UC-23 Delete a sample
  - UC-24 Set a sample's gain
  - UC-25 Reveal a sample in Finder or Explorer
  - UC-26 Undo and redo
- **Voices and stereo**
  - UC-27 Name voices
  - UC-28 Link a voice pair as stereo
- **Audition**
  - UC-29 Play a sample
  - UC-30 Step sequencer
  - UC-31 Trigger conditions
  - UC-32 Sample mode, level and mute
  - UC-33 Slicer
- **Write to card**
  - UC-34 Write kits to the SD card (summary, conversion, gain, bank names,
    mirroring, cancel)
- **App**
  - UC-35 Preferences
  - UC-36 Messages and error containment
  - UC-37 About, help, updates and diagnostics

Each entry in `use-cases.md` has:
- **Status**: supported, partial, or not built;
- the feature description (link to the manual page);
- implementation entry points (renderer component or hook, IPC channels, main
  service);
- tests by layer;
- known issues (RE IDs).

Promises the code doesn't keep are either built, removed from the docs, or
listed as "not built" with a decision.

### Linking tests to use cases

- **Tag tests with their use case IDs** in the `describe` or `test` title, for
  example `describe("[UC-34] write to card: mirroring", ...)`. Titles show up in
  every runner's output and need no extra tooling.
- **`scripts/traceability.mjs`** scans test titles in unit, integration, e2e and
  validation tests and writes `docs/developer/traceability.md`: a matrix of use
  cases × test layers, with links to each test. It runs in CI (`npm run
  trace:check`) and fails if:
  - a supported use case has no test above unit level;
  - a test names an unknown use case ID.
- The matrix is generated, never edited by hand, so it can't go stale. The
  register (descriptions, status, entry points) is edited by hand and reviewed
  in PRs.

### Doc corrections

Raised by the audit, to fix or register:
- **Missing features the manual describes:** a "Treat Stereo as Mono" setting,
  a global preview volume slider, the "Validate Store" and "New Kit" header
  buttons, "Duplicate" in the kit view, kit locking.
- **Behaviour that differs from the docs:**
  - download resume;
  - wizard cancel stopping the work;
  - the prompt before going over 12 samples;
  - cross-voice duplicate warnings;
  - undo for "all" edits;
  - message position and persistence;
  - the Change Local Store menu and restart.
- **Packaging and size:** a Linux AppImage (not built), and three different
  factory download sizes.
- **Wrong card layout:** `troubleshooting.md` describes a bank-folder card
  layout that contradicts `sd-card-layout.md`.
- **Aspirational PRD sections:** tags, modes, sync variants, export and sharing.

## 4. Technical debt in the test suite

The code began with early AI tools, and some of the tests show it:
- hollow or misnamed tests;
- heavy global mocks;
- about 1 in 5 assertions checking mock calls rather than outcomes;
- synthetic 44-byte WAVs standing in for audio;
- tests excluded from type-checking (RE-51: about 3,000 errors).

The harness and the error guard catch what those tests can't. The cleanup itself
runs alongside: each PR that touches an area replaces mock-call assertions with
behaviour checks, and RE-51 makes tests type-check.

## Delivery

| PR | Content |
|---|---|
| 1 | This spec; the new findings (RE-64 to RE-67, RE-29 raised to High); the `sd-card-layout.md` counts. |
| 2 | The harness: user-data isolation, the archive copy, the error collector, the reference WAV reader and converter, the scenario, the report, `npm run validate:full` and `validate-full.yml`. Known failures marked with their RE IDs. |
| 3 | The e2e error guard (section 2, item 6) across the existing suite, plus fixing whatever it uncovers. Done in #411. |
| 4 | `use-cases.md`; tests tagged with use case IDs; `scripts/traceability.mjs`, the generated matrix and the CI check. |
| 5 onward | The focused tests from section 2 and fixes for the bugs found (RE-29 and RE-64 first), one PR per finding. |

## First results (2026-10-01, macOS arm64, 23 s with the local archive copy)

- The factory import matches the archive: 183 kits and 2,366 files, all
  byte-identical, with the 7 files over the 12-per-voice limit left out in
  the right places. Bank names match the 14 bank files.
- All 2,368 copied card files are byte-identical to their sources, the
  converted files match the reference conversion, `_save` survives every
  write, a second write changes nothing, and deleting a sample removes it
  from the card at the next write.
- Known bugs seen: RE-29 (the stereo file on an unlinked voice reaches the
  card as stereo) and RE-42 (no truncation notice after setup). RE-34's
  voice-naming failures show up as 458 console warnings during setup.
- New: RE-68 (the e2e suite overwrote the installed app's settings; fixed in
  #400), plus three Low items in the register: the Test Mode banner on an
  empty override, a warning logged for a normal voice-inference outcome, and
  `scripts/capture-screenshots.ts` still using the installed app's settings.

Fixes for these, in order: [`validation-fix-plan.md`](validation-fix-plan.md).

## Decisions (Pete, 2026-10-01)

1. **Stereo file on an unlinked voice**: convert to mono when writing to the
   card. That's the intended behaviour; RE-29 tracks the bug.
2. **Archive source**: keep a copy (local cache and CI cache, checked by
   SHA-256) so runs don't hit Squarp's server; `--fresh` for a real download.
3. **CI**: a manual workflow, reusable so a release can run it later.
