<!--
title: Domain model
status: living map; checked against origin/main 3612a5be on 2026-10-03
updated: 2026-10-08
context_size: large
-->

# Romper domain model

What each concept in Romper means, which one place owns it, who writes and
reads it, every copy of it, the rules it must keep, and where `main`
disagrees today.

## Why this exists: concept drift

Romper grew one feature at a time, mostly in parallel sessions, each fixing
what it could see. Nothing said which place owned a concept, so each fix
picked a source, and parallel work picked different ones. The bugs that
followed weren't in any one function; they were in the gaps between two
copies of the same fact:

- **Bank names** came from the `banks` table, from RTF files and from the
  loaded kits. A bank with no kits had nowhere to keep its name (#488).
  The fix started reading the table (#512) at the same time as a cleanup
  removed that read as unused (#514).
- **Favourites** had two sources of truth, so the star in the browser and
  the editor disagreed and toggling in both flipped the stored value the
  wrong way (#453).
- **Sample state** was copied four times in the renderer and keyed by file
  name, so two same-named samples played together and shared a gain knob
  (#460).
- **Stereo** meant one thing to the code (a voice setting), another to the
  Rample manual (a file that fills two voices) and nothing to import, so a
  card's stereo samples came back mono (#537), and main accepted links the
  editor refused (#541).
- **The IPC contract** had no owner, so methods came and went per feature,
  and **failed saves** looked like success in several places (#489, #511,
  #543), each caller deciding for itself what a missing result meant.

The remedy is one owner per concept: one table and column, one file, one
setting or one piece of main-process state that every reader and writer
goes through, with every other copy derived from it and refreshed by a
known event. This document names that owner for each concept, lists every
copy that exists today, and links an issue for each place `main` still
disagrees.

## The chain

Each concept sits in a chain that runs from the hardware to the tests:

**Rample feature** (a section of the [Rample manual](https://squarp.net/rample/manual/))
→ **Romper concept** (this document: meaning, owner, copies, invariants)
→ **use cases and qualities** (`UC-NN`, `Q-NN` in
[`use-cases.md`](use-cases.md), each with a **Concepts:** line back here)
→ **tests and issues** (tests tagged `[UC-NN]`, issues labelled `UC-NN`;
`npm run trace` joins them and generates each entry's status).

Read along it in either direction. When Squarp changes the manual, the
[Rample manual index](rample-manual-index.md) finds the changed section, the [summary](#summary) finds the
concepts it touches, and their use cases find the tests to re-run and the
issues to file. When an issue is filed, its label finds the use case, whose
Concepts line finds the owner the fix must go through.

Read a concept's section before changing anything it lists. If your change
moves an owner, adds a copy or changes a meaning, update the section in the
same pull request.

## Summary

| Concept | Canonical owner | Rample manual (relationship) | Use cases and qualities |
|---|---|---|---|
| [Local store](#local-store-library) | `localStorePath` setting (or `ROMPER_LOCAL_PATH`) | none | [UC-01](use-cases.md#uc-01-set-up-from-an-sd-card)–[UC-06](use-cases.md#uc-06-change-the-local-store), [Q-03](use-cases.md#q-03-romper-only-touches-what-you-point-it-at) |
| [Settings](#settings) | `romper-settings.json`, held by main | Settings (none) | [UC-03](use-cases.md#uc-03-set-up-an-empty-library)–[UC-06](use-cases.md#uc-06-change-the-local-store), [UC-23](use-cases.md#uc-23-delete-a-sample), [UC-34](use-cases.md#uc-34-write-kits-to-the-sd-card), [UC-35](use-cases.md#uc-35-preferences), [UC-37](use-cases.md#uc-37-about-help-updates-and-diagnostics), [Q-03](use-cases.md#q-03-romper-only-touches-what-you-point-it-at) |
| [Bank](#bank) | letter: kit name; name: `banks.artist` | Select a kit; How to make your own sample kits (writes; name files unverified) | [UC-01](use-cases.md#uc-01-set-up-from-an-sd-card), [UC-02](use-cases.md#uc-02-set-up-from-the-factory-archive), [UC-07](use-cases.md#uc-07-browse-kits-by-bank), [UC-09](use-cases.md#uc-09-search-kits), [UC-12](use-cases.md#uc-12-name-banks), [UC-13](use-cases.md#uc-13-scan-a-kit-or-scan-all), [UC-34](use-cases.md#uc-34-write-kits-to-the-sd-card) |
| [Kit](#kit) | `kits` row | Select a kit; How to make your own sample kits (writes); Advanced parameters, SLICER (mirrors) | [UC-07](use-cases.md#uc-07-browse-kits-by-bank)–[UC-11](use-cases.md#uc-11-filter-to-kits-modified-since-the-last-sync), [UC-14](use-cases.md#uc-14-create-a-kit)–[UC-18](use-cases.md#uc-18-step-to-the-previous-or-next-kit), [UC-30](use-cases.md#uc-30-step-sequencer), [UC-31](use-cases.md#uc-31-trigger-conditions), [UC-33](use-cases.md#uc-33-slicer), [Q-01](use-cases.md#q-01-romper-stays-responsive-as-your-library-grows) |
| [Voice](#voice) | `voices` row | What's inside a kit? (writes); Layers, Levels/Drive (mirrors) | [UC-08](use-cases.md#uc-08-read-kit-card-details), [UC-09](use-cases.md#uc-09-search-kits), [UC-15](use-cases.md#uc-15-duplicate-a-kit), [UC-27](use-cases.md#uc-27-name-voices), [UC-28](use-cases.md#uc-28-link-a-voice-pair-as-stereo), [UC-32](use-cases.md#uc-32-sample-mode-level-and-mute), [UC-33](use-cases.md#uc-33-slicer) |
| [Stereo](#stereo) | `voices.stereo_mode` | How to make your own sample kits (STEREO SUPPORT); Multi–layers kits (writes) | [UC-01](use-cases.md#uc-01-set-up-from-an-sd-card), [UC-13](use-cases.md#uc-13-scan-a-kit-or-scan-all), [UC-19](use-cases.md#uc-19-drop-wavs-onto-a-voice), [UC-28](use-cases.md#uc-28-link-a-voice-pair-as-stereo), [UC-29](use-cases.md#uc-29-play-a-sample), [UC-34](use-cases.md#uc-34-write-kits-to-the-sd-card), [Q-04](use-cases.md#q-04-the-card-ends-up-exactly-matching-your-library) |
| [Sample](#sample) | `samples` row; format: the file | How to make your own sample kits; Multi–layers kits (writes) | [UC-08](use-cases.md#uc-08-read-kit-card-details), [UC-09](use-cases.md#uc-09-search-kits), [UC-15](use-cases.md#uc-15-duplicate-a-kit), [UC-19](use-cases.md#uc-19-drop-wavs-onto-a-voice)–[UC-25](use-cases.md#uc-25-reveal-a-sample-in-finder-or-explorer), [UC-29](use-cases.md#uc-29-play-a-sample), [UC-33](use-cases.md#uc-33-slicer), [UC-34](use-cases.md#uc-34-write-kits-to-the-sd-card), [Q-01](use-cases.md#q-01-romper-stays-responsive-as-your-library-grows), [Q-04](use-cases.md#q-04-the-card-ends-up-exactly-matching-your-library) |
| [The card and a write](#the-card-and-a-write) | the database; the card is generated | How to make your own sample kits; microSD; Settings: STORE (writes) | [UC-11](use-cases.md#uc-11-filter-to-kits-modified-since-the-last-sync), [UC-12](use-cases.md#uc-12-name-banks), [UC-16](use-cases.md#uc-16-delete-a-kit), [UC-24](use-cases.md#uc-24-set-a-samples-gain), [UC-34](use-cases.md#uc-34-write-kits-to-the-sd-card), [Q-04](use-cases.md#q-04-the-card-ends-up-exactly-matching-your-library) |
| [Scan and setup import](#scan-and-setup-import) | the database (merge, never rebuild) | How to make your own sample kits (writes, in reverse) | [UC-01](use-cases.md#uc-01-set-up-from-an-sd-card), [UC-02](use-cases.md#uc-02-set-up-from-the-factory-archive), [UC-13](use-cases.md#uc-13-scan-a-kit-or-scan-all), [UC-27](use-cases.md#uc-27-name-voices), [Q-02](use-cases.md#q-02-your-changes-are-saved-completely-or-not-at-all) |
| [Undo history](#undo-history) | renderer state (`useUndoRedoState`) | none | [UC-06](use-cases.md#uc-06-change-the-local-store), [UC-26](use-cases.md#uc-26-undo-and-redo), [Q-02](use-cases.md#q-02-your-changes-are-saved-completely-or-not-at-all) |
| [Playback and voice choke](#playback-and-voice-choke) | audio layer (`claimVoice`, shared `AudioContext`) | Trig a sample; Layers (mirrors; choke unverified) | [UC-29](use-cases.md#uc-29-play-a-sample), [UC-30](use-cases.md#uc-30-step-sequencer), [UC-32](use-cases.md#uc-32-sample-mode-level-and-mute), [UC-33](use-cases.md#uc-33-slicer), [Q-01](use-cases.md#q-01-romper-stays-responsive-as-your-library-grows) |
| [Use cases, qualities and issues](#use-cases-qualities-and-issues) | `use-cases.md`; GitHub issues | the whole manual (documents, via the [index](rample-manual-index.md)) | [Q-07](use-cases.md#q-07-every-change-is-tested-before-it-reaches-you), [Q-08](use-cases.md#q-08-romper-supports-or-mirrors-the-ramples-features) |
| [The IPC contract](#the-ipc-contract) | `ElectronAPI` (`shared/electronApi.ts`) | none | [UC-36](use-cases.md#uc-36-messages-and-error-containment), [Q-01](use-cases.md#q-01-romper-stays-responsive-as-your-library-grows)–[Q-03](use-cases.md#q-03-romper-only-touches-what-you-point-it-at), [Q-07](use-cases.md#q-07-every-change-is-tested-before-it-reaches-you) |

A range such as UC-07–UC-11 means every entry in it. Each concept's
section has the full list, linked to the manual by heading and anchor.

## How to read an entry

Each concept has the same fields:

- **Meaning:** what it means to the user, in a sentence.
- **Use cases:** the entries in [`use-cases.md`](use-cases.md) that read or
  change it; each links back here from its **Concepts:** line.
- **Rample manual:** the manual sections it relates to, by heading and
  anchor, and the relationship, in #538's vocabulary:
  - **writes:** Romper produces what the Rample reads from the card;
  - **mirrors:** Romper reproduces it on the computer for preview;
  - **documents:** Romper's docs explain it;
  - **none:** Romper's own concept; the Rample has no counterpart.

  Anything the manual doesn't say is marked "unverified on hardware"
  (CLAUDE.md). The headings are the stable key; the anchors are the page's
  element ids as fetched on 2026-10-03 and look generated, so they may
  change. See [Rample manual coverage](#rample-manual-coverage).
- **Canonical owner:** the one source of truth: a table and column, a file,
  a setting, or main-process state.
- **Writers:** main operations and IPC channels, by symbol.
- **Readers and copies:** who reads it, every derived copy (renderer state,
  caches, files on the card) and what refreshes each copy.
- **Invariants:** rules that must always hold.
- **Disagreements on main:** reads or writes that bypass the owner, stale
  copies, and different meanings. Each links its issue.

Renderer paths are under `app/renderer/components/` unless they start with
`app/renderer/utils/` or `views/`; main paths are under `electron/main/`.

### Three facts behind most renderer drift

1. **One kits array, many mirrors.** `useKitDataManager` holds `kits`
   (from `get-all-kits`) and `allKitSamples`. Everything else is derived
   from them and re-syncs only when an object's identity changes. An edit
   to a kit's own fields or voices returns the kit, which patches `kits`
   (`applyKitEdit`); a sample edit returns the kit with its samples
   (`applyReadKit`); a rescan or undo reloads the kit with one `get-kit`
   call (`refreshKit`). A kit created or copied is added as main returned
   it (`addKit`) and a deleted one taken off (`removeKit`); Scan all, a
   write and a bank rename reload every kit (`refreshAllKitsAndSamples`).
   Reads are numbered so an older response can't land over a newer one. A BPM, gain, favorite, name or editable
   save patches its kit in `kits` instead, and stays over a read sent
   before it (#452; plan in [`kit-refresh.md`](kit-refresh.md)).
2. **The kit editor isn't remounted between kits.** `KitsView` renders
   `KitEditorContainer` without a `key`, and the error boundary's
   `resetKey` only clears its error. Every `useState` and `useRef` in the
   editor outlives a step to the next or previous kit unless it resets on
   `kitName` itself.
3. **Saves report in several shapes.** `DbResult`, `{ isValid }`,
   `{ exists }`, raw values, `void` or a thrown error (see
   [The IPC contract](#the-ipc-contract)). Each caller decides what a
   missing result means, so "failed but looks saved" keeps coming back.

## Local store (library)

- **Meaning:** your library on disk: the folder that holds Romper's database
  and the kit folders setup copied in.
- **Use cases:** [UC-01](use-cases.md#uc-01-set-up-from-an-sd-card), [UC-02](use-cases.md#uc-02-set-up-from-the-factory-archive), [UC-03](use-cases.md#uc-03-set-up-an-empty-library), [UC-04](use-cases.md#uc-04-choose-an-existing-local-store), [UC-05](use-cases.md#uc-05-recover-from-an-invalid-or-missing-store), [UC-06](use-cases.md#uc-06-change-the-local-store), [Q-03](use-cases.md#q-03-romper-only-touches-what-you-point-it-at).
- **Rample manual:** none. Romper's own concept. The kit folders inside it
  follow the card layout ([How to make your own sample kits](https://squarp.net/rample/manual/#Gssvcjr)),
  so a store made from a card holds a copy of the card's kits.
- **Canonical owner:** the `localStorePath` setting, overridden for the
  whole process by `ROMPER_LOCAL_PATH`. Resolved in main by
  `ServicePathManager.getLocalStorePath` (`utils/fileSystemUtils.ts`); the
  database is `<store>/.romperdb/romper.sqlite`.
- **Writers:** `write-settings` (`settingsService.writeSetting`), reached
  from `SettingsContext.setLocalStorePath`, the wizard's fallback in
  `useLocalStoreWizard`, and Change Local Store; setup creates the folder
  and database (`create-romper-db` → `localStoreSetupService.createSetupDatabase`).
  Changing it closes every connection (`closeAllDbConnections`) and marks
  setup complete (`markSetupComplete`). The wizard marks it complete
  earlier, with `finish-setup`, as soon as the store is built, so a quit
  after a failed save keeps the store (#616).
- **Readers and copies:**
  - main: `ServicePathManager.getLocalStorePath` for almost every service;
    `get-local-store-status` (`localStoreService.getLocalStoreStatus`) with
    its own copy of the same precedence; `pathAccess.getRoots`.
  - renderer: `SettingsContext` `state.settings.localStorePath`, seeded
    from `config.localStorePath || settings.localStorePath` and then updated
    by its own setter; `localStoreStatus` from `get-local-store-status`.
    When it changes, `useKitNavigation` closes the open kit and the undo
    stack clears (#568).
  - the database path is built by `ServicePathManager.getDbPath` (six
    services wrap it in a private `getDbPath`), by `localStoreValidator`,
    `localStoreSetupService` and `pathAccess` with their own literals, and
    by the wizard in the renderer (`` `${targetPath}/.romperdb` ``).
- **Invariants:**
  - A valid store is a readable, writable folder with
    `.romperdb/romper.sqlite` whose schema validates
    (`validateLocalStoreAndDb`). Nothing reads the store until its status
    says it's valid (`isLocalStoreReady`, #553).
  - One connection per store, closed when the setting changes, before a
    database file is moved or deleted, and at quit (RE-81).
  - Romper writes only its database and the bank name files into the store;
    samples you add are referenced, never copied.
- **Disagreements on main:**
  - `validate-local-store`, `validate-local-store-basic` and
    `validate-local-store-opens` take `ROMPER_LOCAL_PATH` before their
    argument, so with the override set the folder you pick is never the one validated. `ServicePathManager` and
    `getLocalStoreStatus` ignore a blank override; `readSettings`, the
    preload and the `validate-*` handlers don't. Test-only today; part of
    the precedence that should live in one function.

## Settings

Main owns every setting: the file `<userData>/romper-settings.json`, loaded
once into `inMemorySettings` (`mainProcessSetup.loadSettings`,
`settingsFile.normalizeSettings`) and written through `write-settings`
(`settingsService.writeSetting`: validated, written to a temporary file and
renamed, then applied in memory). `read-settings` returns a copy with the
environment overrides applied, which are never saved. There's no
`localStorage`; `sessionStorage` holds only dev hot-reload state
(`app/renderer/utils/hmrStateManager.ts`). Window size and position are a
separate file (`window-state.json`), not a setting.

| Setting | Meaning | Default | Writers | Copies |
|---|---|---|---|---|
| `localStorePath` | Your library ([Local store](#local-store-library)) | none: the wizard opens | `SettingsContext.setLocalStorePath`; the wizard's fallback `setSetting` | `SettingsContext`; main `inMemorySettings`, overridden by `ROMPER_LOCAL_PATH` |
| `sdCardPath` | The card folder you last wrote to | none | `useKitSync.handleSdCardPathChange` | `useKitSync` state (read once at mount), `SyncUpdateDialog`'s `localSdCardPath`; main reads it only to allow the path (`pathAccess.getRoots`). A write always takes the path as an argument |
| `themeMode` | Light, dark or system | `system` (renderer) | `SettingsContext.setThemeMode` | `SettingsContext`, applied as the `dark` class |
| `confirmDestructiveActions` | Ask before deleting a sample | `true` (renderer) | `SettingsContext.setConfirmDestructiveActions` | `SettingsContext`; read by `SampleDeleteButton`. Main never reads it |

Environment overrides (launch-time, never saved): `ROMPER_LOCAL_PATH`,
`ROMPER_SDCARD_PATH`, `ROMPER_USER_DATA_DIR`, `ROMPER_HEADLESS`,
`ROMPER_SQUARP_ARCHIVE_URL`, `ROMPER_TEST_MODE`, `ROMPER_ENABLE_DEVTOOLS`,
`ROMPER_DEBUG`. The preload exposes some as `romperEnv`, and the renderer
reads them through `app/renderer/config.ts`.

- **Use cases:** [UC-03](use-cases.md#uc-03-set-up-an-empty-library), [UC-04](use-cases.md#uc-04-choose-an-existing-local-store), [UC-05](use-cases.md#uc-05-recover-from-an-invalid-or-missing-store), [UC-06](use-cases.md#uc-06-change-the-local-store), [UC-23](use-cases.md#uc-23-delete-a-sample), [UC-34](use-cases.md#uc-34-write-kits-to-the-sd-card), [UC-35](use-cases.md#uc-35-preferences), [UC-37](use-cases.md#uc-37-about-help-updates-and-diagnostics), [Q-03](use-cases.md#q-03-romper-only-touches-what-you-point-it-at).
- **Rample manual:** none. The Rample has its own settings
  ([Settings](https://squarp.net/rample/manual/#VhwOTqd), saved with SAVE
  SETTINGS to `_save/settings.rpl` on the card), which Romper doesn't read
  or write ([`rample-save-integration.md`](rample-save-integration.md)).
- **Invariants:** a setting has one writer path (`write-settings`) and one
  in-memory owner (main). Path settings are checked against the allowed
  roots before they're saved, so the renderer can't grant itself access.
- **Disagreements on main:**
  - `ROMPER_LOCAL_PATH` is applied four times (main `readSettings`, the
    preload's `SettingsManager.readSettings`, `config.localStorePath` in
    `SettingsContext`, and `ServicePathManager`) with different rules for a
    blank value. With the override set, `SettingsContext.localStorePath`
    follows what you pick while main keeps the override.
  - `ROMPER_SDCARD_PATH` is honoured by `select-sd-card` only in test mode,
    but always by the wizard (`config.sdCardPath`), `readSettings` and
    `pathAccess`.
  - `SettingsData` in `shared/electronApi.ts` allows a `theme` key nothing
    uses and types `localStorePath` as `string`, where main uses
    `null | string` (#472).
  - The renderer reads settings twice (`SettingsContext.initializeSettings`
    and `useKitSync`), so `sdCardPath` lives outside the context, read once
    at mount.

## Bank

A bank is one of the 26 letters A to Z. It has a letter (from its kits'
names) and an optional name (the "artist").

- **Meaning:** a group of up to 100 kits under one letter, with a name you
  can give it.
- **Use cases:** [UC-01](use-cases.md#uc-01-set-up-from-an-sd-card), [UC-02](use-cases.md#uc-02-set-up-from-the-factory-archive), [UC-07](use-cases.md#uc-07-browse-kits-by-bank), [UC-09](use-cases.md#uc-09-search-kits), [UC-12](use-cases.md#uc-12-name-banks), [UC-13](use-cases.md#uc-13-scan-a-kit-or-scan-all), [UC-34](use-cases.md#uc-34-write-kits-to-the-sd-card).
- **Rample manual:** [Select a kit](https://squarp.net/rample/manual/#igGTWqk)
  ("Kits are organized in 26 banks (A to Z)") and
  [How to make your own sample kits](https://squarp.net/rample/manual/#Gssvcjr)
  (the folder's first character "is the bank letter, from A to Z").
  - letter: **writes** (the kit folder name).
  - name: **writes**, but the manual doesn't mention bank name files. The
    factory archive has them (`A - ALWIS.rtf`); whether the Rample shows
    them is unverified on hardware.
- **Canonical owner:**
  - letter: the first character of the kit name. `kits.bank_letter` stores
    a copy, set from the name by `addKit`, `copyKit` and
    `importSetupKit`.
  - name: `banks.artist`, the only owner (#567). `banks.rtf_filename` is
    derived from it (`bankRtfFileName`); `banks.scanned_at` records when
    setup imported it (in stores from before #567, the last bank scan).
    The store's and the card's `<L> - <name>.rtf` files are output, written
    from it: `planCardContents` and `writeBankRtfFiles` build the card's
    files from it, and `update-bank` the store's.
- **Writers:**
  - `update-bank` (handler in `dbIpcHandlers.ts`, `saveBankName`) changes
    `banks.artist` and `<store>/<L> - <name>.rtf` together, or neither:
    it stages the file change (`rtfFileService.stageRtfFile`, which moves
    the old file aside), then calls `updateBank` (`source: "edit"`, which
    flags every kit in the bank modified), then keeps the file change or
    undoes it.
  - setup: `setup-import-bank-names`
    (`localStoreSetupService.importSetupBankNames`) reads the
    `<L> - <name>.rtf` files (`parseBankNameFile`) in one folder and calls
    `updateBank` with `source: "scan"`, which flags nothing, in the step
    that imports the kits. The folder is the card for a card setup, whose
    files aren't copied into the store (#564), or the store for the
    factory archive, which was extracted into it (#567)
    (`bankNamesSourcePath`). This is the only time Romper reads bank name
    files: not at startup, not on Scan All, so a name file edited by hand
    in the store isn't read.
  - the write puts `<L> - <name>.rtf` on the card root and removes bank
    files the store doesn't name (`findStaleCardEntries`).
- **Readers and copies:**
  - main: `getAllBanks` (`get-all-banks`); every kit row joined with its
    bank (`kitRelationalHelpers`, so `get-all-kits` and `get-kit` carry
    `kit.bank.artist`); sync planning.
  - files: `<store>/<L> - <name>.rtf` and `<card>/<L> - <name>.rtf`,
    written only, except by setup's import.
  - renderer: `useKitBankNavigation` `bankNames`, only from `get-all-banks`:
    loaded when the store opens (effect on `localStorePath`, which is also
    when setup has just imported names) and again after a rename;
    `BankHeader` `editValue`; search (`kitSearchUtils`) reads
    `kit.bank.artist`, which the kit reload after a rename refreshes.
- **Invariants:**
  - The `banks` table always has 26 rows (migration `0001`).
  - A letter is one capital A to Z (`isBankLetter` in
    `shared/rampleCardLayout.ts`, #573), which `update-bank` and the
    renderer check. A bank name file's letter may be either case
    (`a - Name.rtf` is bank A; Pete, #567); any other letter, such as `Ä`,
    isn't a bank.
  - A name is never blank and holds none of `/ \ : * ? " < > |` or control
    characters (`bankNameError`), because it becomes a file name.
  - At most one name file per letter, in the store and on the card.
  - Every reader of a bank name file uses one pattern,
    `BANK_NAME_FILE_PATTERN` (`parseBankNameFile`) in
    `shared/rampleCardLayout.ts`: a letter A to Z, either case.
- **Disagreements on main:**
  - Comments in `rtfFileService` state that the Rample shows these files,
    which the manual doesn't say (#571).

## Kit

A kit is one slot, `A0` to `Z99`, with four voices.

- **Meaning:** a set of up to four voices of samples you load on the Rample
  as one, plus Romper's own settings for it.
- **Use cases:** [UC-07](use-cases.md#uc-07-browse-kits-by-bank), [UC-08](use-cases.md#uc-08-read-kit-card-details), [UC-09](use-cases.md#uc-09-search-kits), [UC-10](use-cases.md#uc-10-favourite-kits), [UC-11](use-cases.md#uc-11-filter-to-kits-modified-since-the-last-sync), [UC-14](use-cases.md#uc-14-create-a-kit), [UC-15](use-cases.md#uc-15-duplicate-a-kit), [UC-16](use-cases.md#uc-16-delete-a-kit), [UC-17](use-cases.md#uc-17-make-a-kit-editable-and-set-its-alias), [UC-18](use-cases.md#uc-18-step-to-the-previous-or-next-kit), [UC-30](use-cases.md#uc-30-step-sequencer), [UC-31](use-cases.md#uc-31-trigger-conditions), [UC-33](use-cases.md#uc-33-slicer), [Q-01](use-cases.md#q-01-romper-stays-responsive-as-your-library-grows).
- **Rample manual:** [Select a kit](https://squarp.net/rample/manual/#igGTWqk)
  ("A kit is a group of 4 samples", "up to 100 kits: A0 to A99") and
  [How to make your own sample kits](https://squarp.net/rample/manual/#Gssvcjr)
  ("1 kit = 1 folder", "Up to 2600 folders can be created!", and a kit
  folder "must include at least the voice 1 sample").

Kit fields, each owned by a column of `kits`:

| Field | Meaning | Rample | Writers (main / IPC) | Renderer copies |
|---|---|---|---|---|
| `name` | Slot and identity, primary key everywhere | writes (folder name) | `createKit` (`create-kit`), `copyKit` (`copy-kit`), `importSetupKit`; never renamed | `selectedKit` (`useKitNavigation`), every key below |
| `alias` | Your display name for the kit | none | `updateKit` via `update-kit-metadata` (`parseKitMetadataUpdates` allows only `alias` and `editable`) | `kits[i]`, patched after a save; `KitEditor` `kitAliasInput` |
| `editable` | Whether sample, gain, voice-name and stereo edits are allowed | none | `update-kit-metadata`; on for created and duplicated kits, off for imported ones | `kits[i]`, patched; `useKitEditorLogic.isEditable`; gates undo of sample edits (`applyUndoRedo`) |
| `locked` | Protection from scan and delete | none | nothing in the UI | `kits[i]` (`KitGridItem` `canDelete`) |
| `is_favorite` | Starred | none | `toggleKitFavorite` (`toggle-kit-favorite`): flips the stored value and returns the new one | `kits[i]`, set from the returned value (#453 removed the shadow map) |
| `modified_since_sync` | The next write will change this kit on the card (#566) | none | see below | `kits[i]`; `markGainSaved` patches it locally after a gain save; the Modified filter and count (`useKitFilters`), card border, header badge |
| `bpm` | Sequencer tempo, 30 to 180 | none | `updateKit` via `update-kit-bpm`; no reload after, but `KitsView` patches the kit's `bpm` in `kits` once it's saved (`useBpm` `onSaved`) | `KitStepSequencer`'s `useBpm`, which drives playback and resets on the kit name as well as the loaded BPM |
| `step_pattern` | 4 voices × 16 steps | none | `updateKit` via `update-step-pattern`, then a full reload; undo and redo write it with the conditions and slices via `restore-kit-sequence` | `useStepPattern` state and `latestRef`; `useSequenceHistory` |
| `trigger_conditions` | A:B condition per step | none | `updateKit` via `update-trigger-conditions`, then a full reload | `useTriggerConditions` state and ref |
| `slice_steps` | Slice per step, in ticks of 384 per sample | mirrors | `updateKit` via `update-slice-steps` (debounced reload) | `useSliceSteps` state and ref |
| `slicer_division` | Slices per sample (8 to 128) | mirrors the SLICER setting | `updateKit` via `update-kit-slicer-division` | `useSliceSteps` |

- **Rample relationship of the sequencer fields:** the manual describes no
  step sequencer, tempo or trigger conditions on the module. Romper's
  sequencer previews what an external sequencer would trigger
  ([Trig a sample](https://squarp.net/rample/manual/#npDPEfP)): **none** for
  BPM and conditions, **mirrors** for the slicer. The Rample's SLICER is a
  device setting ([Settings](https://squarp.net/rample/manual/#VhwOTqd),
  [Advanced parameters](https://squarp.net/rample/manual/#C0ft3/t),
  [Note about start point & sample length](https://squarp.net/rample/manual/#XX9CMqGW9):
  "/8, /16, /32, /64, /128, /12, /24, /48" or EXP); Romper stores it per
  kit and has no EXP.
- **Modified since last write.** Means the next write will change this kit
  on the card (#566). Set once per edit, in the edit's transaction, by
  `flagKitModified` (sample add, delete, move, restore; gain,
  since the written file is scaled; stereo link, unlink and Keep mono,
  since they decide which files are mixed to mono) and
  `flagBankKitsModified` (bank rename or clear, since the bank's name file
  sits beside its kits); new and duplicated kits start set; a scan sets it
  only when it adds samples. Edits the card never sees don't set it: voice
  names, the kit alias, `editable`, BPM, steps, trigger conditions, slicer
  data and settings, level and sample mode. Cleared on every kit by a
  completed, uncancelled write, except kits with a skipped sample
  (`markAllKitsAsSyncedExcept`), and by setup import (`markKitsAsSyncedTx`,
  whose bank names are saved with `source: "scan"` and set nothing). It
  drives only the UI: every write sends the whole store, whatever the flag
  says. Deleting a kit can't set it (the row is gone), though the next
  write removes the kit's folder.
- **Invariants:**
  - A name is a bank letter and 0 to 99. A kit has exactly four voice rows
    and at most 12 samples per voice.
  - One rule, in `shared/rampleCardLayout.ts`, says what a kit name is
    (#573): `isKitName` (a capital A to Z, then 0 to 99) for the store and
    every check in main and the renderer, and `kitNameOfCardFolder` on the
    card, where a folder's name is compared ignoring case, as FAT32 does.
    So setup imports a card folder `a5` as kit A5 (`cardKitFolders`), and
    the write (`findStaleCardEntries`) treats it as A5's folder; a folder
    that isn't a kit by the rule, such as `Ä1` or `A100`, is neither
    imported nor removed. `A01` is a kit name distinct from `A1`; whether
    the Rample reads it as kit 1 is unverified on hardware.
  - `bank_letter` equals the name's first character.
  - A kit the Rample can open has a voice-1 sample; a write warns when it
    doesn't (`kitsWithoutVoiceOne`).
  - Only an editable kit takes sample, gain, voice-name and stereo-link
    edits; sequencer edits are allowed on any kit (`applyUndoRedo`: "the
    sequencer works on locked kits too", where "locked" means not
    editable).
- **Disagreements on main:**
  - Main enforces `editable` only for stereo links (RE-71). Sample add,
    delete and move, gain, voice names and kit delete are refused
    only by the renderer (#572).
  - The step pattern and trigger conditions reload their kit on every
    save, undebounced. An older reload can't land over a newer one, but a
    reload that returns while the next toggle is still saving shows the
    pattern without it for a moment (#452).
  - `updateKit` still accepts `name` and `bank_letter`; only
    `parseKitMetadataUpdates` stops a renderer rename
    (RE-22). Six channels reach it with different validation.
  - "Locked" is used in comments and the UI vocabulary for "not editable",
    while `kits.locked` is a different, unused flag.

## Voice

Each kit has voices 1 to 4.

- **Meaning:** one of the Rample's four outputs and the up-to-12 layered
  samples it plays.
- **Use cases:** [UC-08](use-cases.md#uc-08-read-kit-card-details), [UC-09](use-cases.md#uc-09-search-kits), [UC-15](use-cases.md#uc-15-duplicate-a-kit), [UC-27](use-cases.md#uc-27-name-voices), [UC-28](use-cases.md#uc-28-link-a-voice-pair-as-stereo), [UC-32](use-cases.md#uc-32-sample-mode-level-and-mute), [UC-33](use-cases.md#uc-33-slicer).
- **Rample manual:** [What's inside a kit?](https://squarp.net/rample/manual/#YanSdon)
  ("There are 4 voices: audio outputs SP1, SP2, SP3 and SP4", "up to 12
  layers") and [Multi–layers kits](https://squarp.net/rample/manual/#XX2FJ2ONj).

Voice fields, each owned by a column of `voices` (one row per kit and
voice number):

| Field | Meaning | Rample | Writers | Renderer copies |
|---|---|---|---|---|
| `voice_number` | 1 to 4; the first character of a card file | writes | created with the kit (`addKitTx`, `copyKit`); `ensureVoiceRow` can insert one | key for everything below |
| `voice_alias` | Your name for the voice, or one inferred from a file name | none | `updateVoiceAlias` (`update-voice-alias`, flags the kit); scan and setup (`inferMissingVoiceAliases`, only unnamed voices); the editor's `handleInferVoiceNames` | `kits[i].voices`; `useKitEditorLogic.voiceNames`; `KitVoicePanels.voiceData`; `useVoiceNameEditor` `editValue`; grid icon (`extractVoiceNames`) |
| `stereo_mode` | Links this voice with the next as a stereo pair | writes (see [Stereo](#stereo)) | `updateVoiceStereoMode` (`update-voice-stereo-mode`, refused for a read-only kit, flags the kit) | `KitVoicePanels.voiceData` → `useStereoHandling`; `KitStepSequencer.stereoLinks`; grid badge; search |
| `voice_volume` | Preview level, 0 to 100 | mirrors [Levels/Drive effect](https://squarp.net/rample/manual/#zPtALyJ) loosely; never written to the card | `updateVoiceVolume` (`update-voice-volume`) | `KitStepSequencer` `voiceVolumes` |
| `sample_mode` | Which layer plays: first, random, round-robin | mirrors [Layers](https://squarp.net/rample/manual/#e+hlH+Q) and the LAYER setting, with different modes | `updateVoiceSampleMode` (`update-voice-sample-mode`) | `KitStepSequencer` `sampleModes`; `useKitStepSequencerLogic` `roundRobinIndexRef`, cleared on a kit change |
| `slice_enabled`, `slice_max_length`, `slice_roll_amount`, `slice_vary_length` | Slicer settings | mirrors | `updateVoiceSliceSettings` (`update-voice-slice-settings`) | `useVoiceSliceSettings` state and ref |
| mute | Silence a voice in the sequencer | none ([Mute groups](https://squarp.net/rample/manual/#qdSsFkF) is a different feature) | not saved | `KitStepSequencer` `voiceMutes`, cleared when you step to another kit |

- **Invariants:**
  - Exactly one row per kit and voice number (not enforced: #510).
  - Voice data is keyed by voice number, never by position.
  - A sample mode is one of `first`, `random`, `round-robin`
    (`sampleModeError`); a level is 0 to 100 (`volumeError`).
- **Disagreements on main:**
  - The Rample's layer modes are "MANUAL, RANDOM, CYCLIC, REVERSE CYCLIC,
    VELOCITY", and [Multi–layers kits](https://squarp.net/rample/manual/#XX2FJ2ONj)
    says layers play "randomly (by default)". Romper has `first` (its
    default), `random` and `round-robin`, and saves none of it to the card,
    since the Rample keeps layer modes in its own STORE data. A parity gap
    (Layers in the [Rample manual index](rample-manual-index.md)), not a bug.
  - `updateVoiceAlias` reports success when the voice row doesn't exist,
    so the editor's `handleInferVoiceNames` counts that voice as named.
  - The voice level, sample mode and slicer settings don't flag the kit,
    and neither does a kit alias, but a voice name does (#566).

### Stereo

- **Meaning:** a stereo pair plays and writes voice N's files in stereo and
  leaves voice N+1 empty on the card.
- **Use cases:** [UC-01](use-cases.md#uc-01-set-up-from-an-sd-card), [UC-13](use-cases.md#uc-13-scan-a-kit-or-scan-all), [UC-19](use-cases.md#uc-19-drop-wavs-onto-a-voice), [UC-28](use-cases.md#uc-28-link-a-voice-pair-as-stereo), [UC-29](use-cases.md#uc-29-play-a-sample), [UC-34](use-cases.md#uc-34-write-kits-to-the-sd-card), [Q-04](use-cases.md#q-04-the-card-ends-up-exactly-matching-your-library).
- **Rample manual:** [How to make your own sample kits](https://squarp.net/rample/manual/#Gssvcjr),
  under STEREO SUPPORT: "A stereo sample will fill 2 mono voices." and
  [Multi–layers kits](https://squarp.net/rample/manual/#XX2FJ2ONj): "All
  layers must be of the same type (mono OR stereo) in a voice."
  Relationship: **writes**. The manual says nothing about voice 4, about a
  stereo file whose next voice has samples, or about a voice that mixes
  types: Romper's rules for those are unverified on hardware.
- **Samples carry no stereo flag** (`samples.is_stereo` was dropped,
  RE-69); a sample's channel count comes from its WAV header.
- **Canonical owners:** `voices.stereo_mode` on the left-hand voice (the
  link), and `voices.stereo_choice` (the user's own choice: `stereo` after
  linking by hand or **Link** on a drop, `mono` after **Keep mono** or an
  unlink, null when Romper may decide). Migration `0014_stereo_choice`
  added it and recorded every existing link as `stereo`.
- **Rules (Pete's "Final stereo rules v2" on #537, 2026-10-03).** Stereo
  is a voice setting, Romper's design, not Rample behaviour. Terms: a
  *stereo* or *mono sample* is a 2- or 1-channel WAV; a *mono voice* is an
  unlinked voice (voice 4 always is); a *stereo pair* is voices N and N+1
  linked, N 1 to 3. Romper says *link* and *unlink*, never "busy" or "in
  use". All of it is in `shared/stereoLinkRules.ts` (`planKitStereo`,
  `checkStereoLink` and the wording), which setup, scan, the write, main,
  the link button, drops and the kit editor share.

  1. **A mono voice is always fine.** Any mix of samples is allowed on it;
     at write its stereo samples are mixed down to mono. The voice carries
     a note while that lasts, and the write summary lists it. That covers
     stereo samples on voice 4, mixed samples on an unlinked voice, and
     stereo samples whose next voice has samples.
  2. **Linking automatically.** Setup from a card and the write link voice
     N with N+1 when N is 1 to 3, every sample on N is stereo, N+1 has no
     samples and isn't in a pair, and the user hasn't chosen mono for N.
     The pair is labelled "Linked automatically" (a link with no choice by
     hand), and the setup or write summary says so.
  3. **Never undo links.** If N+1 is in a pair (even an empty one), N
     isn't linked, and its note says "Voice 1 can't pair with voice 2
     because voices 2 and 3 are linked. Unlink them to pair voices 1 and
     2." Links come from Romper or the user, never from the card.
  4. **Quarantine.** A kit with a linked pair holding a mono sample on its
     voice, a linked pair whose right voice has samples, or a WAV Romper
     can't read is quarantined: it isn't written, and its folder on the
     card is left untouched, neither overwritten nor removed
     (`CardContents.keepKits`). The kit editor and the write summary say
     what's wrong and how to fix it; quarantine ends when it's fixed. The
     other kits are written. Whether a WAV can be read is recorded in
     `samples.source_status` (see [Sample](#sample)) by add, scan, the
     kit editor's check when a kit opens, and a completed write, and
     `isKitQuarantined` reads it, so a kit with an unreadable file shows
     as quarantined in the kit browser and the kit editor. The write
     reads every file itself, then records the problems it found. A quarantined kit shows a `WarningOctagon` icon in
     `--accent-danger` on its kit card, with the accessible name and
     tooltip `QUARANTINE_ICON_LABEL`, and the icon and "Quarantined" in the
     kit editor's header. A missing file never quarantines.
  5. **Scan and drop.** A scan never changes anything; it reports what
     rules 1 to 4 will do. Dropping a stereo sample on a mono voice that
     rule 2 would link asks "kick.wav is stereo. Link voices 1 and 2 as a
     stereo pair?" with **Link** or **Keep mono**, and remembers the
     answer. Dropping a mono sample on a stereo pair adds it with the
     warning "kick.wav is a mono sample, but voices 1 and 2 are a stereo
     pair and expect stereo samples." and quarantines the kit.
  6. **Warn once.** Each message appears once, when its event happens;
     persistent labels show the state while it lasts (mixed down, linked
     automatically, quarantined), so nothing that matters is only a toast.

  Linking by hand is refused, with "Voices 2 and 3 can't be linked: voice
  3 has samples." and the like, for voice 4, a voice in a pair, and a voice
  whose next voice has samples or is in a pair (#541, main and the link
  button). Unlinking is always allowed and says "Voices 1 and 2 are
  unlinked. Voice 1's stereo samples will be written to the card as
  mono."
- **Writers:** the link button and a drop's **Link** or **Keep mono**
  (`update-voice-stereo-mode` → `updateVoiceStereoMode`, which refuses with
  `checkStereoLink`, #541, and records `stereo_choice`); setup
  (`importSetupKit` → `mergeKitScanTx` with `linkStereoVoices`); the write
  (`startKitSync` → `completeWrite` → `linkVoicesAutomaticallyTx`, from
  `planWriteStereo`). The write's links are part of the write: they're
  recorded only once every file is written, in the transaction that
  clears the modified flags, so a cancelled or failed write leaves none.
- **Readers and copies:** `planWriteStereo` and `annotateMonoConversion`
  (write: links, mixdowns, quarantine); `planKitScanMerge` (scan report);
  `validateVoiceNotLinkedPartner` (refuses samples on the right-hand voice
  of a pair); the voice panels' notes, labels and quarantine notice; the
  renderer copies listed under [Voice](#voice).
- **Invariants:** nothing is ever copied onto N+1 because a file is stereo;
  a scan never changes a link; Romper never unlinks; a quarantined kit's
  card folder is never written or removed.
- **Disagreements on main:**
  - Preview plays a stereo file in stereo on an unlinked voice, though the
    card gets a mono mix (#569).

## Sample

A sample is one layer: a file reference in one slot of one voice.

- **Meaning:** a WAV file you put in a voice, in a position (1 to 12), with
  a gain.
- **Use cases:** [UC-08](use-cases.md#uc-08-read-kit-card-details), [UC-09](use-cases.md#uc-09-search-kits), [UC-15](use-cases.md#uc-15-duplicate-a-kit), [UC-19](use-cases.md#uc-19-drop-wavs-onto-a-voice), [UC-20](use-cases.md#uc-20-replace-a-sample), [UC-21](use-cases.md#uc-21-move-samples-within-a-kit), [UC-22](use-cases.md#uc-22-move-a-sample-to-another-kit), [UC-23](use-cases.md#uc-23-delete-a-sample), [UC-24](use-cases.md#uc-24-set-a-samples-gain), [UC-25](use-cases.md#uc-25-reveal-a-sample-in-finder-or-explorer), [UC-29](use-cases.md#uc-29-play-a-sample), [UC-33](use-cases.md#uc-33-slicer), [UC-34](use-cases.md#uc-34-write-kits-to-the-sd-card), [Q-01](use-cases.md#q-01-romper-stays-responsive-as-your-library-grows), [Q-04](use-cases.md#q-04-the-card-ends-up-exactly-matching-your-library).
- **Rample manual:** [How to make your own sample kits](https://squarp.net/rample/manual/#Gssvcjr)
  ("The first character must be the number of the voice", "standard .wav
  mono format, 16–bit or 8–bit, 44100 Hz, minimum length 50ms") and
  [Multi–layers kits](https://squarp.net/rample/manual/#XX2FJ2ONj) ("Sample
  layer names are numerically and alphabetically sorted").

Sample fields, each owned by a column of `samples` (one row per kit,
voice and slot):

| Field | Meaning | Rample | Writers | Renderer copies |
|---|---|---|---|---|
| `slot_number` | Position in the voice, 0 to 11 (shown 1 to 12) | writes (the `-NN` in the card name sets the layer order) | add, move, delete with reindex, restore (`sampleCrudService`, `sampleBatchOperations`, `sampleMovement`, `restoreVoicesTx`) | `allKitSamples[kit][voice][slot]` (file name only, `""` for gaps); `sampleMetadata` keyed by `slotKey(voice, slot)` |
| `source_path` | The file Romper reads: outside the store for samples you add, inside it for imported ones | none | add; scan inserts | `sampleMetadata`; undo snapshots |
| `filename` | The readable part of the card name | writes (`cardSampleFileName`) | add, scan | `allKitSamples`; `kits[i].samples` |
| `gain_db` | Trim from -24 to +12 dB, baked in at write | writes (no counterpart: the Rample's level is per voice) | `updateSampleGain` (`update-sample-gain`, flags the kit) | `kits[i].samples[].gain_db`, patched after a save (`markGainSaved`); `sampleMetadata`, built from it |
| `wav_bit_depth`, `wav_channels`, `wav_sample_rate`, `wav_bitrate`, `wav_format_tag` | The file's format when it was added or last read: the format tag is the header's PCM, float or extensible (#576) | none (the write reads the header) | add (from the validation read); scan and the kit-open check when any is null, or when the file's size or modification time differs from `source_size` and `source_mtime_ms` (#793) | `sampleMetadata` → tooltip and format badge (`wavMetadataFormatter`, by `planConversion`) |
| `source_size`, `source_mtime_ms` | The file's size in bytes and modification time (whole ms) when its header was read; null in older libraries and after a restore from an older undo entry, which reads as changed (#793) | none | wherever the header is read, with the `wav_*` columns: add, scan, setup import, the kit-open check (one async `stat` per sample, the header read only when it differs) | none (compared in main only) |
| `source_status` | What Romper found when it last read the file: `readable`, `missing`, `unreadable`, or null (never checked, as in older libraries) | none | add (`readable`); scan (`mergeKitScanTx`); the kit editor's check when a kit opens (`check-kit-sample-files` → `checkKitSampleFiles`, #537); a completed write (`completeWrite`: `missing`, `unreadable`, or null once a problem file is fine) | `kits[i].quarantined` (`isKitQuarantined`, in main); `sampleMetadata` → the slot labels "File not found" and "Can't be read", the missing-files notice, and the quarantine notice |

- **Canonical owner of the file's format:** the file itself, read at write
  time (`validateSampleFormatAsync`, `formatConverter`). The `wav_*`
  columns are a cache for display. What a write does to it is one rule,
  `planConversion` in `shared/rampleFormat.ts` (#576): written as it is, or
  re-encoded for its format (the Rample's requirements, or a mixdown on a
  mono voice) or only for its gain. The write plans every file with it
  and the format badge shows it, from the voice's stereo setting as the
  write makes it (`playsStereo`).
- **File status (#537):** catch a problem early and say how to fix it.
  When a kit opens, the kit editor asks main, once and in one batch
  (`check-kit-sample-files`), to check every sample's file still exists
  (an async stat), so a file deleted since it was last read shows as
  missing straight away. Files not known to be readable (never checked,
  or last found missing or unreadable, so a file that was put back is
  seen too) also have their header read, as does a known-readable file
  whose size or modification time differs from what was stored when it
  was read (#793); an unchanged one isn't read again. If anything
  changed, the kit reloads. A
  completed write records what it found too, in the transaction that
  records the write (`completeWrite`): missing and unreadable files, and
  null for a file last found missing or unreadable that's now fine, so
  the kit-open check reads it afresh. A cancelled or failed write records
  nothing. A missing file is labelled
  "File not found" in its slot and listed above the voices with how to
  fix it (`describeMissingSampleFile`); it's skipped at write, and doesn't
  quarantine the kit. An unreadable file is labelled "Can't be read" and
  quarantines the kit (rule 4); the quarantine notice says how to fix it.
- **Readers and copies:** besides the table above, `kits[i].samples` (from
  `get-all-kits` and `get-kit`); `selectedKitSamples`, an effect-driven
  mirror one render behind; `SampleWaveform`'s decoded buffer (reloads when
  kit, voice, slot or file name change); `SliceStrip`'s peaks cache (keyed
  by kit, voice and slot, never invalidated); the card file
  `<kit>/<voice>-<slot> <name>.wav`.
- **Invariants:**
  - At most 12 per voice; one per slot; one row per source per voice
    (unique constraints).
  - Slots are contiguous from 0 after delete and move (reindexing).
  - A sample on the right-hand voice of a linked pair is refused.
  - The card name is `<voice>-<slot+1, two digits> <name>.wav`, at most 64
    characters (`cardSampleFileName`).
- **Disagreements on main:**
  - `kits[i].samples` and `allKitSamples` refresh together (`refreshKit`),
    and `sampleMetadata` is built from `kits[i].samples` with the gains
    being turned on top (#452); it's still a separate copy until step 8.
  - Search reads `allKitSamples` as objects, but its values are file-name
    strings, so that input matches nothing; search works from
    `kit.samples` only.
  - The slicer's waveform cache and `SampleWaveform` don't notice a slot's
    file changing (#575).

## The card and a write

- **Meaning:** the SD card you put in the Rample, and the operation that
  makes it match your library.
- **Use cases:** [UC-11](use-cases.md#uc-11-filter-to-kits-modified-since-the-last-sync), [UC-12](use-cases.md#uc-12-name-banks), [UC-16](use-cases.md#uc-16-delete-a-kit), [UC-24](use-cases.md#uc-24-set-a-samples-gain), [UC-34](use-cases.md#uc-34-write-kits-to-the-sd-card), [Q-04](use-cases.md#q-04-the-card-ends-up-exactly-matching-your-library).
- **Rample manual:** [How to make your own sample kits](https://squarp.net/rample/manual/#Gssvcjr)
  (kit folders "must be located on the root of the SD card"),
  [microSD](https://squarp.net/rample/manual/#XX2d0DE/0), and the STORE and
  SAVE SETTINGS entries of [Settings](https://squarp.net/rample/manual/#VhwOTqd)
  ("Save current kit parameters & assignments on the SD card"). The manual
  doesn't name the folder the device writes; `_save/` comes from the Squarp
  forum and a real card ([`sd-card-layout.md`](sd-card-layout.md)).
  Relationship: **writes**.
- **The device's saved settings:** `_save/` holds a CBOR file per stored
  kit (`<kit>.rpl`: knob positions, layer modes, selected layers, mute
  groups, CV assignments), the device settings (`settings.rpl`), the
  GLOBAL CV assignments (`global_assign.rpl`) and an empty
  `autosave_<kit>.rpl`. The device owns them; the app doesn't change
  them. The reader (`electron/main/rample/`, #788) decodes them, for
  developers with `npm run rample:save`, and for the kit editor's
  read-only "On the Rample" section, which shows a kit's file from the
  store's latest copy of the folder (#800). A kit's file belongs to its slot, so the device
  applies it to whatever samples a write puts there next. See
  [`rample-save-integration.md`](rample-save-integration.md) (#786).
- **Canonical owner:** the store's database. The card is a generated copy:
  "the card mirrors the store". The card path is an argument to each
  write, remembered in the `sdCardPath` setting.
- **Writers:** `startKitSync` (`syncService`):
  1. **plan** (`planSync`): one load (`getSyncPlanData`), the expected card
     contents (`planCardContents`), a read of each source header in
     batches (`processSampleForSync`), each file's copy or conversion by
     the shared rule (`planConversion`, #576), the voice-1 warning, mono
     annotation, and a warning for samples shorter than the manual's 50 ms
     minimum;
  2. **refuse** when samples can't be written, unless you chose to skip
     them;
  3. **write** every sample (`syncFileOperations.processAllFiles`): copy, or
     convert to 16-bit 44.1 kHz with gain and any mono mix
     (`formatConverter`), yielding after each file;
  4. **bank files** (`writeBankRtfFiles`) and **removal** of what the store
     no longer has (`findStaleCardEntries`, `removeCardEntries`), only
     after a complete, uncancelled write;
  5. **record** the write in one transaction (`completeWrite`): the links
     made automatically (`linkVoicesAutomaticallyTx`) and the cleared
     modified flags (`markAllKitsAsSyncedExceptTx`). A cancelled or failed
     write records neither.

  The summary (`generateSyncChangeSummary` → `generateChangeSummary`) runs
  the same plan.
- **Readers and copies:** the renderer's progress store
  (`syncProgressStore`), the summary in `SyncUpdateDialog`, `useKitSync`'s
  remembered path.
- **Invariants:**
  - After a complete write, every Rample entry on the card (kit folders
    named like kits, files in them, bank name files) is exactly what the
    store says; `_save/` and anything else is never touched (Q-04).
  - Nothing is removed from the card after a cancelled or failed write.
  - A file is never copied unconverted when its conversion fails.
  - Names are compared ignoring case (FAT32).
- **Disagreements on main:**
  - `SyncProgress` is defined four times with different status values, and
    `useSyncUpdate` casts `"complete"` to `"completed"` (#472).
  - Without a card path the plan names files under `<store>/sync_output`
    (`getDestinationPath`), and `handleSyncFailure` deletes that folder. A
    write always has a card path, so only a summary without one uses it.
  - The blanket clear at the end of a write would also clear a kit changed
    while the write ran. The write panel is modal, so only menu actions
    could do that today.
  - The flag is per store, not per card: writing to a second card leaves
    every kit "unmodified" for the first.

## Scan and setup import

- **Meaning:** reading kit folders in the store (or on a card, at setup)
  into the database, without losing what you've set.
- **Use cases:** [UC-01](use-cases.md#uc-01-set-up-from-an-sd-card), [UC-02](use-cases.md#uc-02-set-up-from-the-factory-archive), [UC-13](use-cases.md#uc-13-scan-a-kit-or-scan-all), [UC-27](use-cases.md#uc-27-name-voices), [Q-02](use-cases.md#q-02-your-changes-are-saved-completely-or-not-at-all).
- **Rample manual:** the card layout in
  [How to make your own sample kits](https://squarp.net/rample/manual/#Gssvcjr)
  and [Multi–layers kits](https://squarp.net/rample/manual/#XX2FJ2ONj).
  Relationship: **writes** in reverse (Romper reads what the Rample reads).
- **Canonical owner:** the database. Scan merges into it; it never
  rebuilds.
- **Writers:**
  - kit scan: `rescan-kit` → `scanService.rescanKit` → `mergeKitScan`
    (`planKitScanMerge`, one transaction): existing rows keep slot, voice,
    gain and source; missing files are reported; new files are added to
    read-only kits only, in the lowest free slot, up to 12; empty `wav_*`
    columns are filled; unnamed voices are named from the first file.
  - setup: the wizard copies kit folders (`copy-dir`) or extracts the
    factory archive, then `setup-import-kit` → `importSetupKit`: `addKitTx`
    (read-only kit, four mono voices), `mergeKitScanTx` (which links voices
    automatically by stereo rule 2) and `markKitsAsSyncedTx`, in one
    transaction per kit. `setup-import-bank-names` then imports the card's
    or the factory archive's bank names (see [Bank](#bank)).
  - the editor's Scan on an editable kit only names voices, in the renderer
    (`useKitScanning.handleInferVoiceNames`).
- **Readers and copies:** `KitScanResult` drives the scan messages; Scan
  All runs every kit (`useKitScan.scanAllKits`), then one reload. Neither
  scan reads bank names (#567).
- **Invariants:** a locked kit is untouched; a scan never deletes a row or
  moves a sample, and never changes a stereo link (it reports what the
  stereo rules will do); a user-set voice name survives a scan.
- **Disagreements on main:**
  - `planKitScanMerge`'s comment still lists a "stereo flag" on rows.
  - Voice names are inferred twice: in main (`inferMissingVoiceAliases`,
    from database rows) and in the renderer (`handleInferVoiceNames`, from
    `allKitSamples`, where slot 0 may be a `""` gap).
  - Scan All reports a partial failure as success (#540).

## Undo history

- **Meaning:** Cmd/Ctrl+Z steps back through your sample and sequencer
  edits in the open kit.
- **Use cases:** [UC-06](use-cases.md#uc-06-change-the-local-store), [UC-26](use-cases.md#uc-26-undo-and-redo), [Q-02](use-cases.md#q-02-your-changes-are-saved-completely-or-not-at-all).
- **Rample manual:** none.
- **Canonical owner:** renderer state, `useUndoRedoState`, held by
  `useUndoRedo(currentKitName, onMessage, localStorePath)` inside
  `useGlobalKeyboardShortcuts` in `KitsView`, and cleared when the kit name
  or the store changes. Not persisted.
- **Writers:** `addAction` after a successful edit (sample add, delete,
  move; `SEQUENCE_EDIT` from `useSequenceHistory` once main has
  saved the edit, merged by `mergeSequenceEdit`). Sample actions keep full voice rows fetched from
  main before the edit (`VoiceSnapshot`); sequencer actions keep the
  renderer's own pattern state.
- **Readers and copies:** undo and redo replay through
  `useUndoActionHandlers` and `useRedoActionHandlers`
  (`restore-kit-voices` for delete and move, one transaction;
  add and delete channels otherwise; `writeSequenceSnapshot` for the
  sequencer, one `restore-kit-sequence` write of the parts that differ),
  then dispatch `romper:refresh-samples` on `document`, which
  `useSampleRefreshListener` turns into reloads of the selected kit.
- **Invariants:** the stack belongs to one kit in one store; it clears when
  that changes; an undo either restores everything it touched or nothing.
- **Disagreements on main:**
  - Undoing a move between kits refreshes only the selected kit; the move
    itself can't be reached from the UI (UC-22).
  - Undo isn't offered for gain, voice names, links, BPM, level, sample mode
    or slicer settings ("Promised, not built" in
    [`use-cases.md`](use-cases.md)).

## Playback and voice choke

- **Meaning:** previewing samples on the computer, one sound per voice at a
  time.
- **Use cases:** [UC-29](use-cases.md#uc-29-play-a-sample), [UC-30](use-cases.md#uc-30-step-sequencer), [UC-32](use-cases.md#uc-32-sample-mode-level-and-mute), [UC-33](use-cases.md#uc-33-slicer), [Q-01](use-cases.md#q-01-romper-stays-responsive-as-your-library-grows).
- **Rample manual:** [Trig a sample](https://squarp.net/rample/manual/#npDPEfP)
  ("Each sample is always outputted on its dedicated audio output") and
  [Layers](https://squarp.net/rample/manual/#e+hlH+Q). Relationship:
  **mirrors**. The manual doesn't describe a choke; that voices are
  monophonic is Romper's design, unverified on hardware.
- **Canonical owner:** the audio layer: `voiceChoke.ts`'s `sounding` map
  (`claimVoice`), keyed by voice number, and the one shared `AudioContext`
  (`sharedAudioContext.ts`).
- **Writers:** `SampleWaveform` (each preview, sequencer trigger and slice
  audition calls `claimVoice`); `useKitPlayback` (play and stop triggers).
- **Readers and copies:** `useKitPlayback` state (its per-slot store,
  `slotPlaybackStore.ts`, and `activeSamples`, keyed by
  `slotKey(voice, slot)`, never reset); `useKitStepSequencerLogic` (`isSeqPlaying` and
  `roundRobinIndexRef`, both reset on a kit change, and the worker); the decoded buffers fetched by kit, voice and slot
  (`get-sample-audio-buffer`), cached by file version in
  `sampleAudioCache.ts` (#478).
- **Invariants:** starting a sound on a voice stops every other sound on it
  at the new one's start; audio comes from main by kit, voice and slot,
  never by path.
- **Disagreements on main:**
  - Preview doesn't apply the voice's stereo setting (#569).
  - `voiceChoke.ts` says "a Rample voice is monophonic" as fact, and that
    `useKitPlayback` is keyed by file name and resets on refresh; neither
    holds (#571).

## Use cases, qualities and issues

- **Meaning:** what you can do with Romper (`UC-NN`), how it behaves while
  you do it (`Q-NN`), and the open problems with each.
- **Use cases:** [Q-07](use-cases.md#q-07-every-change-is-tested-before-it-reaches-you), [Q-08](use-cases.md#q-08-romper-supports-or-mirrors-the-ramples-features).
- **Rample manual:** **documents**: Q-08 traces Rample features to the use
  cases that cover them, in the [Rample manual index](rample-manual-index.md).
- **Canonical owner:** the register, [`use-cases.md`](use-cases.md), for
  entries; GitHub issues for open work, labelled with an entry's ID, a kind
  and a severity ([`BACKLOG.md`](../../BACKLOG.md)). Status is generated
  from the issues (`npm run trace`), never written.
- **Readers and copies:** `scripts/traceability.mjs` (the generated
  `traceability.md` and the Lint job summary), test titles tagged
  `[UC-NN]`, the website's testing page. The frozen findings register
  (`RE-` IDs) is history, not a copy to update.
- **Invariants:** every issue carries an entry's label; an entry is
  partial while any issue with its label is open; a supported entry has a
  test above unit level or a declared gap.
- **Disagreements on main:** this document links an issue for each
  disagreement it lists.

## The IPC contract

- **Meaning:** the boundary between the window (renderer) and the process
  that owns the data and files (main). Not a user concept, but every other
  concept crosses it.
- **Use cases:** [UC-36](use-cases.md#uc-36-messages-and-error-containment), [Q-01](use-cases.md#q-01-romper-stays-responsive-as-your-library-grows), [Q-02](use-cases.md#q-02-your-changes-are-saved-completely-or-not-at-all), [Q-03](use-cases.md#q-03-romper-only-touches-what-you-point-it-at), [Q-07](use-cases.md#q-07-every-change-is-tested-before-it-reaches-you).
- **Rample manual:** none.
- **Canonical owner:** `ElectronAPI` in `shared/electronApi.ts`. The
  preload implements it (`satisfies ElectronAPI`), the renderer's global
  and the tests' mock use it, and main registers every handler through
  `handle` against the channel map derived from it
  (`shared/ipcChannels.ts`, #472), so none of them can drift.
  `tests/unit/ipcChannelParity.test.ts` checks that every channel is
  handled.
- **Writers:** whoever adds a feature (the four steps in the coding guide).
  Removals are shared work: re-check callers on current `main` at merge
  (#514 against #512).
- **Invariants (target):** one result shape (`DbResult`) for every call
  that can fail; a missing result is a failure; main validates every
  argument; every write returns what changed, so the renderer can patch
  instead of reload (architecture review steps 5 and 7).
- **Disagreements on main** (#472 bound main to the contract and fixed
  the return shapes and throws it listed):
  - several result families (`DbResult`, `{ isValid }`, `{ exists }`,
    `{ writable }`, `{ sufficient }`, `{ granted }`, `{ removed }`, raw
    values, `void`), so callers each decide what failure looks like;
    `setSetting` is the one write with no result, and `ensureDir`'s
    result is ignored by the wizard;
  - one intent, several channels: six kit-field channels reach `updateKit`;
    every kit row carries its bank's name (`kit.bank.artist`, which search
    reads) beside `get-all-banks`, which the browser reads; the local
    store is validated by three channels; the wizard picks a card folder
    with the store's folder picker (`select-local-store-path`).

## Rample manual coverage

The map of manual sections is
[`rample-manual-index.md`](rample-manual-index.md): one row per section
and sub-heading, keyed by heading, with its anchor, a hash of its text, its
relationship to Romper and the use cases it relates to. `npm run
rample-manual` regenerates it from the manual (the `rample-manual-map`
skill, run by hand when Squarp publishes a new manual or firmware), keeps
the mapping, and reports changed sections and candidate features.

The index's Concepts column comes from this document: a concept whose
**Rample manual:** line links a section
(`https://squarp.net/rample/manual/#<anchor>`) is listed against it. So
cite sections by link, with the anchors the index records, and a changed
section leads to the concepts it touches.

**What the device stores, by key:** the files in `_save/` name the
settings the manual describes (STORE's kit parameters, SAVE SETTINGS'
device settings, LAYER, ASSIGN, SLICER, mute groups), so a manual section
can now be traced to the key that holds it. The key tables, and which
meanings are confirmed, are in
[`rample-save-integration.md`](rample-save-integration.md). SLICER is in
`settings.rpl` and in no kit file, so it is one setting for the whole
device on the firmware that wrote Pete's card (#617, still to check on
hardware).

**Romper concepts with no manual section:** bank name files, the step
sequencer, BPM, trigger conditions, voice choke, per-sample gain, kit
alias, editable, favourites and the modified flag.

## Target ownership

Which owners to change, in order. Each step is one or more PRs, ties into
the plan in [`architecture-review.md`](architecture-review.md), and closes
the issues it names.

1. **Main is the guard for every rule** (small, now). Main refuses what the
   renderer refuses: read-only kits (#572) and stereo links (#541). Kit and
   bank names have one pattern each, in `shared/` (#573, done). These are
   preconditions for everything below: once main enforces the rules, the
   renderer's copies can be dropped without losing a check.
2. **One owner per stored concept in main** (small, alongside 1).
   - Bank names: `banks.artist` only. The store's RTF files are output,
     like the card's; setup reads a card's or the factory archive's files
     once (#564, #567, done).
   - Stereo: `voices.stereo_mode`, plus the user's own choice in
     `voices.stereo_choice` (#537).
   - Modified: one written definition, set in one place per writer
     (#566, done).
   - Settings: one function for the store path and its override.
3. **Typed channel map, one result shape** (architecture review step 7,
   #472). `handle(name, impl)` in main against `ElectronAPI`; every
   fallible call returns `DbResult`; a missing result is a failure; the
   mock `satisfies ElectronAPI`. This removes the class of #543 and #570
   instead of fixing each caller. (Channel map, typed handlers and mock
   done in #472; one result shape and a missing result as a failure are
   not.)
4. **Edits return the changed kit** (step 5, #452). Each intent-level
   operation returns the kit (with its bank, voices and samples) it changed,
   in the transaction that changed it.
5. **One renderer kits store** (step 8). A `useSyncExternalStore` store
   holding kits by name, voices by kit and number, samples by kit, voice
   and slot, and banks by letter, patched from step 4's results. It
   replaces `kits`, `allKitSamples`, `selectedKitSamples`, `sampleMetadata`,
   `bankNames`, the two `useBpm` copies and the per-hook mirrors; per-kit
   editor state (mutes, play state, undo) is keyed by store and kit and
   resets with them (#565, #568, #575). `getKits` runs only at startup,
   after scan and write, and after a bank rename; creating, copying or
   deleting a kit adds or removes that kit (#452).
6. **Undo as transactional intents** (step 9). Undo operations go through
   main as one call each (`restore-kit-voices` for samples, one call for a
   sequencer snapshot) and the stack lives with the kits store, keyed by
   store and kit (#568, #570).
7. **Preview mirrors the card** (any time after 2). Playback reads the
   voice's stereo setting and the same format rules the write uses, from
   one module in `shared/` (#569, #574, #576).

## Issues this map raised

Filed or commented on 2026-10-03 against `origin/main` 3612a5be. The
issues are the record; this list is a snapshot.

| Issue | Concept | Summary |
|---|---|---|
| #564 | Bank, card | SD-card setup leaves bank names behind; the first write deletes them from the card |
| #565 | Kit, voice | Stepping to another kit carries over BPM, mutes and sequencer state |
| #566 | Kit | "Modified since last write" has no single meaning |
| #567 | Bank | Bank names have three sources |
| #568 | Local store, undo | Changing the store keeps the open kit and its undo stack |
| #569 | Stereo, playback | Preview plays stereo on an unlinked voice; the card gets mono |
| #570 | Saves, undo | Remaining edits that fail without telling you; half-done sequencer undo |
| #571 | Rample claims | Code comments state Rample behaviour the manual doesn't |
| #572 | Kit | Main enforces `editable` only for stereo links |
| #573 | Kit, bank | Kit names and bank letters are checked by different patterns |
| #574 | Stereo, card | A linked voice with mono layers is written mixed, without a warning |
| #575 | Sample | The slicer waveform can show a slot's old sample |
| #576 | Sample, card | Format badge, write summary and the 50 ms minimum disagree with the write |
| #472, #452, #538, #543, #554 | IPC, reloads, parity, saves | Comments with the siblings found here |
