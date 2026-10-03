<!--
title: Use case register
status: living register (RE-67)
updated: 2026-10-03
context_size: large
-->

# Use cases

What Romper supports, from the user's side, and how each use case is built.
Each entry has:

- **Status:**
  - *supported*: works as the user docs describe;
  - *partial*: works, but the docs promise more than the code does, or a
    known issue breaks part of it;
  - *not built*: the docs or the code suggest it, but no user can do it.
- a description with a link to the manual;
- entry points (renderer component or hook, IPC channels, main service),
  checked against the code on 2026-10-01;
- **Doc gaps:** what the docs promise that the code doesn't do. The docs
  pass (#417) fixed the docs for every gap found by the audit; record new ones
  here;
- **Known issues:** open or partly done findings from
  [`BACKLOG.md`](../../BACKLOG.md) and the
  [findings register](../../aidlc-docs/inception/reverse-engineering/code-quality-assessment.md).

The tests for each use case are listed in `traceability.md`, generated
(not committed) by `npm run trace` from `[UC-NN]` tags in test titles; CI
shows it in the Lint job summary. Tag a test
with the use cases it meaningfully covers, in its `describe` or `test` title:
`describe("[UC-14] creating a kit", ...)`. A supported use case needs a test
above unit level; when it has none, its entry says so in a `**Test gap:**`
line, which `npm run trace:check` accepts until a test closes it.

The IDs are fixed in
[`validation-and-traceability.md`](validation-and-traceability.md). Add new
use cases at the end of their group with the next free ID; never reuse one.

Everything traces from a user-oriented statement: a use case (what you can
do) or a quality (how Romper behaves while you do it, under
[Qualities](#qualities)). Every open item in [`BACKLOG.md`](../../BACKLOG.md)
is listed under the **Known issues:** of at least one of them, and its
one-liner says what a user would notice, in plain words. `npm run
trace:check` fails when an open item isn't listed, when an entry still lists
an item that's done, or when a one-liner has code in it. When you fix an
item, remove it from every entry that lists it in the same PR.

## Summary

| Status | Use cases |
|---|---|
| supported | Q-04, UC-09, UC-13, UC-14, UC-16, UC-18, UC-21, UC-23, UC-24, UC-25, UC-26, UC-27, UC-28, UC-30, UC-31, UC-32, UC-33, UC-34 |
| partial | Q-01, Q-02, Q-03, Q-05, Q-06, Q-07, UC-01, UC-02, UC-03, UC-04, UC-05, UC-06, UC-07, UC-08, UC-10, UC-11, UC-12, UC-15, UC-17, UC-19, UC-29, UC-35, UC-36, UC-37 |
| not built | UC-20, UC-22 |

The doc gaps below feed [`validation-fix-plan.md`](validation-fix-plan.md)
item 10: each one is fixed in the docs, built, or given a decision.
Undocumented features (UC-16, UC-21, UC-25) need manual sections.

## Setup and local store

### UC-01 Set up from an SD card

**Status:** partial

On first launch, the setup wizard copies the kit folders from a Rample SD
card into a new local store and imports them. A voice with more than 12
samples keeps the first 12, and the wizard names the files it left out. See
[Choosing a Local Store](../manual/getting-started.md#choosing-a-local-store).

- **Renderer:** `app/renderer/views/KitsView.tsx` →
  `app/renderer/components/hooks/kit-management/useLocalStoreSetupFlow.ts` →
  `app/renderer/components/LocalStoreWizardModal.tsx`, `app/renderer/components/LocalStoreWizardUI.tsx`;
  `app/renderer/components/wizard/WizardSourceStep.tsx`, `app/renderer/components/wizard/WizardTargetStep.tsx`,
  `app/renderer/components/wizard/WizardPostInitGuidance.tsx`; `app/renderer/components/hooks/wizard/useLocalStoreWizard.ts`
  (`initialize`), `app/renderer/components/hooks/wizard/useLocalStoreWizardFileOps.ts`
  (`validateAndCopySdCardKits`, `createAndPopulateDb`),
  `app/renderer/components/hooks/wizard/wizardInitUtils.ts` (`runPreChecks`).
- **IPC:** `select-sd-card`, `select-local-store-path`,
  `check-existing-local-store`, `check-path-writable`, `check-disk-space`,
  `list-files-in-root`, `copy-dir`, `create-romper-db`, `setup-import-kit`
  (one call per kit), `cleanup-partial-init`, `write-settings`.
- **Main:** `electron/main/services/archiveService.ts` (`copyDirectory`);
  `electron/main/services/localStoreSetupService.ts` (`createSetupDatabase`,
  `hasExistingLocalStore`, `importSetupKit`, `cleanupFailedSetup`,
  `cleanupUnfinishedSetups` on quit), which imports each kit with
  `electron/main/db/operations/kitScanOperations.ts` (`mergeKitScan`): up
  to 12 samples per voice, WAV metadata and voice names, in one transaction
  per kit.
- **Doc gaps:** none since the docs pass (#417).
- **Known issues:** RE-67 (the e2e only checks that the database
  exists).

### UC-02 Set up from the factory archive

**Status:** partial

The wizard's factory option downloads Squarp's sample archive (about
313 MiB), checks its SHA-256, extracts it into a new local store and imports
it. See
[Choosing a Local Store](../manual/getting-started.md#choosing-a-local-store)
and [Factory Samples](../manual/syncing.md#factory-samples).

- **Renderer:** the UC-01 wizard, plus
  `app/renderer/components/hooks/wizard/useLocalStoreWizardFileOps.ts` (`extractSquarpArchive`, three
  attempts).
- **IPC:** `download-and-extract-archive`; push events `archive-progress`,
  `archive-error`; `scan-banks` at startup for bank names.
- **Main:** `electron/main/services/archiveService.ts` (`downloadAndExtractArchive`,
  `getFactorySamplesArchiveUrl`); `electron/main/archiveUtils.ts`
  (`downloadArchive`, `extractZipEntries`); `electron/main/services/scanService.ts` (`scanBanks`).
- **Doc gaps:** none since the docs pass (#417).
- **Known issues:** RE-77 (a checksum mismatch is downloaded three times,
  behind a generic network error), RE-67 (the e2e uses a 928-byte stub
  archive; `npm run validate:full` runs the real one, including a cancelled
  setup).

### UC-03 Set up an empty library

**Status:** partial

The wizard's blank option creates an empty local store and opens the
browser on bank A with an Add Kit card. See
[Choosing a Local Store](../manual/getting-started.md#choosing-a-local-store)
and [Creating Kits](../manual/kit-browser.md#creating-kits).

- **Renderer:** the UC-01 wizard with the blank source;
  `app/renderer/components/wizard/WizardPostInitGuidance.tsx`; then `app/renderer/components/KitBrowser.tsx` (UC-14).
- **IPC:** as UC-01, without `copy-dir` and `check-disk-space`.
- **Main:** `electron/main/services/localStoreSetupService.ts` (`createSetupDatabase`).
- **Doc gaps:** none since the docs pass (#417).
- **Known issues:** none.

### UC-04 Choose an existing local store

**Status:** partial

On first launch, **Choose Existing Store** in the wizard points Romper at a
folder that already holds a local store (one containing `.romperdb`). See
[Recovering an Existing Store](../manual/getting-started.md#recovering-an-existing-store).

- **Renderer:** `app/renderer/components/LocalStoreWizardUI.tsx` (`choose-existing-store-btn`,
  `handleChooseExistingStore`); `app/renderer/utils/SettingsContext.tsx`
  (`setLocalStorePath`); `app/renderer/components/hooks/kit-management/useLocalStoreSetupFlow.ts`.
- **IPC:** `select-existing-local-store`, `write-settings`,
  `get-local-store-status`.
- **Main:** `electron/main/services/localStoreService.ts` (`validateExistingLocalStore`) →
  `electron/main/localStoreValidator.ts` (`validateLocalStoreAndDb`);
  `electron/main/services/settingsService.ts` (`writeSetting`).
- **Doc gaps:** the manual says to point Romper at "an existing `.romperdb`
  directory" (`getting-started.md:67`); the picker wants the folder that
  contains it, and choosing `.romperdb` itself fails.
- **Known issues:** nothing tests the wizard's existing-store panel above
  unit level.

### UC-05 Recover from an invalid or missing store

**Status:** partial

When the saved local store is missing or no longer valid, Romper asks for
another. See
[Troubleshooting Setup](../manual/getting-started.md#troubleshooting-setup)
and [Validating Your Store](../manual/kit-browser.md#validating-your-store).

- **Main, at startup:** `electron/main/mainProcessSetup.ts`
  (`validateSavedLocalStore`), which reports an invalid saved store but keeps
  its path (RE-80).
- **Renderer:** `app/renderer/utils/SettingsContext.tsx` (`refreshLocalStoreStatus`) →
  `app/renderer/components/hooks/kit-management/useLocalStoreSetupFlow.ts` → `app/renderer/components/dialogs/InvalidLocalStoreDialog.tsx`
  or the setup wizard; `app/renderer/components/dialogs/CriticalErrorDialog.tsx`.
- **IPC:** `get-local-store-status`, `validate-local-store`,
  `select-local-store-path`, `write-settings`.
- **Main:** `electron/main/services/localStoreService.ts` (`getLocalStoreStatus`);
  `electron/main/localStoreValidator.ts` (`validateLocalStoreAgainstDb`).
- **Doc gaps:** none since the docs pass (#417).
- **Known issues:** RE-78 (Preferences ignores an invalid folder without a message), RE-56, RE-48.

### UC-06 Change the local store

**Status:** partial

File > **Change Local Store...** or Settings > Advanced > **Change** switches
to another local store, and the browser reloads in place. No manual page
describes it.

- **Renderer:** `app/renderer/components/hooks/shared/useMenuEvents.ts`
  (`menu-change-local-store-directory`) →
  `app/renderer/components/hooks/kit-management/useKitViewMenuHandlers.ts` →
  `app/renderer/components/dialogs/ChangeLocalStoreDirectoryDialog.tsx`;
  `app/renderer/components/preferences/AdvancedTab.tsx` → `app/renderer/components/dialogs/PreferencesDialog.tsx`;
  `app/renderer/utils/SettingsContext.tsx` (`setLocalStorePath`);
  `app/renderer/components/hooks/kit-management/useKitDataManager.ts` (`loadKitsData`).
- **IPC:** push `menu-change-local-store-directory`;
  `select-local-store-path`, `validate-local-store-basic`,
  `select-existing-local-store`, `write-settings`, `get-local-store-status`.
- **Main:** `electron/main/applicationMenu.ts`; `electron/main/services/settingsService.ts`;
  `electron/main/localStoreValidator.ts`.
- **Doc gaps:** none since the docs pass (#417).
- **Known issues:** RE-78. With `ROMPER_LOCAL_PATH` set, a change has no
  effect.

## Browse and organise

### UC-07 Browse kits by bank

**Status:** partial

The kit browser shows every kit in a grid grouped by bank, A to Z. The bank
bar on the left and the letter keys jump to a bank; clicking a kit opens it.
See [Navigating Banks](../manual/kit-browser.md#navigating-banks) and
[Keyboard Navigation](../manual/kit-browser.md#keyboard-navigation).

- **Renderer:** `app/renderer/components/KitBrowserContainer.tsx` → `app/renderer/components/KitBrowser.tsx` →
  `app/renderer/components/KitBankNav.tsx`, `app/renderer/components/KitGrid.tsx` (rows from `app/renderer/components/utils/kitGridRows.ts`),
  `app/renderer/components/BankHeader.tsx`; `app/renderer/components/hooks/kit-management/useKitBrowser.ts`,
  `app/renderer/components/hooks/kit-management/useKitBankNavigation.ts`, `app/renderer/components/hooks/kit-management/useKitKeyboardNav.ts`;
  `app/renderer/components/hooks/useKitGridKeyboard.ts`.
- **IPC:** `get-all-kits`.
- **Main:** `electron/main/db/operations/kitCrudOperations.ts` (`getKits`).
- **Doc gaps:** arrow keys and Enter (`kit-browser.md:126-130`,
  `keyboard-shortcuts.md:13-17`) do nothing from the first kit, the
  default focus (RE-39).
- **Known issues:** RE-39, RE-38 (letter hotkeys clash with "F"), RE-36,
  RE-47, RE-48.

### UC-08 Read kit card details

**Status:** partial

Each kit card shows the kit ID and alias, sample counts per voice, voice
names, a kit type icon, a stereo icon, a favourite star, a lock icon on
read-only kits and an amber border on kits changed since the last write.
See [Kit Cards](../manual/kit-browser.md#kit-cards).

- **Renderer:** `app/renderer/components/KitGridCard.tsx`, `app/renderer/components/KitGridItem.tsx`, `app/renderer/components/KitVoiceStrip.tsx`,
  `app/renderer/components/shared/KitIconRenderer.tsx`, `app/renderer/components/shared/kitItemUtils.ts`;
  `app/renderer/components/hooks/kit-management/useKitItem.ts`.
- **IPC:** `get-all-kits`.
- **Doc gaps:** none since the docs pass (#417).
- **Known issues:** RE-47, RE-48. Nothing tests the cards above unit
  level.

### UC-09 Search kits

**Status:** supported

The search box filters the grid to kits whose name, alias, bank artist,
voice names or sample file names contain the text (two characters or more),
and highlights the matches. See
[Search](../manual/kit-browser.md#search).

- **Renderer:** `app/renderer/components/KitBrowserHeader.tsx` → `app/renderer/components/SearchInput.tsx`;
  `app/renderer/components/hooks/kit-management/useKitSearch.ts`;
  `app/renderer/utils/kitSearchUtils.ts` (`filterKitsWithSearch`);
  `app/renderer/components/shared/searchHighlight.tsx`.
- **IPC, main:** none; search runs on the loaded kits.
- **Known issues:** none registered. Any part of the word "stereo" ("st",
  "re") matches every kit with a linked pair.

### UC-10 Favourite kits

**Status:** partial

The star on a kit card, the header in the kit editor, or the "F" key marks
a favourite; the Favorites filter shows only those. See
[Favorites Filter](../manual/kit-browser.md#favorites-filter).

- **Renderer:** `app/renderer/components/KitGridItem.tsx` →
  `app/renderer/components/hooks/kit-management/useKitFilters.ts` (`handleToggleFavorite`,
  `handleToggleFavoritesFilter`, the count from the kit list); `app/renderer/components/hooks/kit-management/useKitKeyboardNav.ts` ("F");
  `app/renderer/components/KitHeader.tsx`; both toggle through
  `app/renderer/components/hooks/kit-management/useKitDataManager.ts` (`toggleKitFavorite`), which
  updates the kit list.
- **IPC:** `toggle-kit-favorite`
  (`electron/main/db/favoritesIpcHandlers.ts`).
- **Main:** `electron/main/db/operations/kitFavoritesOperations.ts`.
- **Doc gaps:** the "F" shortcut isn't in the shortcut list.
- **Known issues:** RE-38 ("F" also jumps to bank F).

### UC-11 Filter to kits modified since the last sync

**Status:** partial

The Modified filter shows the kits changed since they were last written to
the card. See [Modified Filter](../manual/kit-browser.md#modified-filter).

- **Renderer:** `app/renderer/components/hooks/kit-management/useKitFilters.ts` (`handleToggleModifiedFilter`);
  `app/renderer/components/KitGridItem.tsx` (amber border).
- **Main:** `electron/main/db/operations/kitSyncOperations.ts` (`markKitAsModified`,
  `markKitsAsSynced`); set by sample add, delete and move
  (`electron/main/services/sampleBatchOperations.ts`, `electron/main/services/crud/sampleCrudService.ts`) and by a scan
  that adds samples; cleared by a write (`electron/main/services/syncService.ts`).
- **Doc gaps:** the filter shows "what needs to be synced"
  (`kit-browser.md:95`), but gain, stereo, voice name and bank edits don't
  set the flag, and a created or duplicated kit starts unmodified.
- **Known issues:** RE-35.

### UC-12 Name banks

**Status:** partial

Each bank header has an editable artist name. Names are stored in the local
store and written to the card as `<letter> - <name>.rtf` files. See
[Editing Bank Names](../manual/kit-browser.md#editing-bank-names).

- **Renderer:** `app/renderer/components/BankHeader.tsx` →
  `app/renderer/components/hooks/kit-management/useKitBankNavigation.ts` (`handleBankNameChange`).
- **IPC:** `update-bank` (`electron/main/dbIpcHandlers.ts`), `scan-banks`.
- **Main:** `electron/main/db/operations/crudOperations.ts` (`updateBank`);
  `electron/main/services/rtfFileService.ts` (`writeRtfFile`, `removeRtfFile`); `electron/main/services/scanService.ts`
  (`scanBanks`); written to the card by `electron/main/services/syncService.ts`
  (`writeBankRtfFiles`).
- **Doc gaps:** a name given to a bank with no kits is lost on reload.
- **Known issues:** RE-35.

### UC-13 Scan a kit, or scan all

**Status:** supported

**Scan Kit** in the kit editor (or "/") rebuilds a read-only kit's samples
from its folder, keeping edits, and names unnamed voices; in an editable
kit it only names voices. File > **Scan All** scans the bank names and every
kit. See [Scanning Your Library](../manual/kit-browser.md#scanning-your-library).

- **Renderer:** `app/renderer/components/KitHeader.tsx` and `app/renderer/components/hooks/kit-management/useKitEditorKeyboardNav.ts` →
  `app/renderer/components/hooks/kit-management/useKitScanning.ts` (`handleScanKit`);
  `app/renderer/components/hooks/kit-management/useKitViewMenuHandlers.ts` (`menu-scan-all-kits`) →
  `app/renderer/views/KitsView.tsx` (every kit in the store) →
  `app/renderer/components/hooks/kit-management/useKitScan.ts` (`scanAllKits`), `app/renderer/components/hooks/shared/useBankScanning.ts`.
- **IPC:** `rescan-kit`, `scan-banks`; push `menu-scan-all-kits`.
- **Main:** `electron/main/services/scanService.ts` (`rescanKit`, `scanBanks`);
  `electron/main/db/operations/kitScanOperations.ts` (`mergeKitScan`,
  `planKitScanMerge`).
- **Known issues:** none registered.

## Kit lifecycle

### UC-14 Create a kit

**Status:** supported

Click the **Add Kit** card at the end of a bank to create a blank kit in
the bank's first free slot. An empty bank opens from its dimmed letter in
the bank bar, and an empty library shows bank A with an Add Kit card. See
[Creating Kits](../manual/kit-browser.md#creating-kits).

- **Renderer:** `app/renderer/components/AddKitCard.tsx` (placed by
  `app/renderer/components/KitGrid.tsx`, test ID `add-kit-<bank>`), `app/renderer/components/KitBankNav.tsx`;
  `app/renderer/components/hooks/kit-management/useKitCreation.ts` (`handleCreateKitInBank`);
  `app/renderer/components/utils/kitOperations.ts` (`createKit`);
  `shared/kitUtilsShared.ts` (`getNextSlotInBank`).
- **IPC:** `create-kit` (`electron/main/ipcHandlers.ts`).
- **Main:** `electron/main/services/kitService.ts` (`createKit`) →
  `electron/main/db/operations/kitCrudOperations.ts` (`addKit`).
- **Known issues:** RE-28 (kit and its four voices are inserted without a
  transaction).

### UC-15 Duplicate a kit

**Status:** partial

Copy a kit, with its samples, gain, voice settings and sequence, into
another slot by typing the target (for example `B5`) in the kit card's
duplicate popover. See
[Duplicating Kits](../manual/kit-browser.md#duplicating-kits).

- **Renderer:** the copy button on the kit card (`app/renderer/components/KitGridItem.tsx`) and
  `app/renderer/components/shared/KitItemActionPopovers.tsx` (`DuplicatePopoverContent`);
  `app/renderer/components/hooks/kit-management/useKitItemActions.ts`,
  `app/renderer/components/hooks/kit-management/useKitDuplication.ts` (`duplicateKitDirect`).
- **IPC:** `copy-kit`.
- **Main:** `electron/main/services/kitService.ts` (`copyKit`) → `electron/main/db/operations/kitCrudOperations.ts` (`copyKit`,
  one transaction).
- **Doc gap:** the manual says to open the kit and use a **Duplicate Kit**
  option there (`kit-browser.md:64-68`). The kit editor has no duplicate
  control; duplicate is only on the browser card.
- **Known issues:** RE-36.

### UC-16 Delete a kit

**Status:** supported

Delete an editable kit from its card, after a popover that says how many
samples it holds. The next write removes it from the card. The manual
doesn't describe this yet; the only mention is in
[The Sync Process](../manual/syncing.md#the-sync-process).

- **Renderer:** the trash button on the kit card (`app/renderer/components/KitGridItem.tsx`, test ID
  `delete-kit-button`, shown only on editable kits) and
  `app/renderer/components/shared/KitItemActionPopovers.tsx` (`DeletePopoverContent`);
  `app/renderer/components/hooks/kit-management/useKitDeletion.ts` (`requestDeleteSummary`, `deleteKitDirect`).
- **IPC:** `get-kit-delete-summary`, `delete-kit`.
- **Main:** `electron/main/services/kitService.ts` (`deleteKit`, `getKitDeleteSummary`) →
  `electron/main/db/operations/kitCrudOperations.ts` (`deleteKit`, `getKitDeleteSummary`).
- **Doc gap:** no manual section; "editable kits only" and the "Kit is
  locked" refusal are undocumented, and nothing in the UI can lock a kit
  (UC-17).
- **Known issues:** RE-56 (dead `DeleteKitDialog` and unwired
  `useKitDeletion` handlers).

### UC-17 Make a kit editable and set its alias

**Status:** partial

Kits open read-only. The header switch makes a kit editable, which shows the
editing controls (drop, delete, gain, voice names). The kit's display name
(alias) is edited in the header. See
[Opening a Kit](../manual/kit-editor.md#opening-a-kit) and
[Kit Status Indicators](../manual/kit-browser.md#kit-status-indicators).

- **Renderer:** `app/renderer/components/KitHeader.tsx` (editable switch,
  alias input); `app/renderer/components/hooks/kit-management/useKitEditorLogic.ts`;
  `app/renderer/components/hooks/kit-management/useKitDataManager.ts` (`updateKitAlias`,
  `toggleKitEditable`).
- **IPC:** `update-kit-metadata` (`electron/main/dbIpcHandlers.ts`).
- **Main:** `electron/main/db/operations/kitCrudOperations.ts` (`updateKit`).
- **Doc gap:** kit locking isn't built. The manual promises a **Lock
  toggle** that protects a kit (`kit-editor.md:24`), a clickable lock icon on
  the card (`kit-browser.md:103`), Editable and Unsaved badges on cards
  (`kit-browser.md:47`) and "lock important kits" (`syncing.md:78`).
  `kits.locked` exists but nothing in the UI sets it; the switch labelled
  "Locked" is the editable toggle. Editable mode itself is never explained.
- **Known issues:** RE-22 (`update-kit-metadata` spreads the renderer's object),
  RE-56 (dead `app/renderer/components/hooks/kit-management/useKit.ts`).

### UC-18 Step to the previous or next kit

**Status:** supported

In the kit editor, the header's arrow buttons and the `,` and `.` keys open
the previous or next kit in slot order. See
[Navigating Between Kits](../manual/kit-editor.md#navigating-between-kits).

- **Renderer:** `app/renderer/components/KitHeader.tsx` (prev and next buttons);
  `app/renderer/components/hooks/kit-management/useKitEditorKeyboardNav.ts` (`,` and `.`);
  `app/renderer/components/hooks/kit-management/useKitNavigation.ts` (`handleNextKit`,
  `handlePrevKit`); wired in `app/renderer/views/KitsView.tsx`.
- **IPC, main:** none.
- **Known issues:** none specific. Stepping ignores the browser's search
  and filters and clears the undo history (UC-26), both undocumented.

## Samples

### UC-19 Drop WAVs onto a voice

**Status:** partial

Drag WAV files from Finder or Explorer onto a voice in an editable kit. Each
file is checked and added to the voice's next free slot, up to 12. See
[Drag and Drop](../manual/kit-editor.md#drag-and-drop).

- **Renderer:** `app/renderer/components/hooks/shared/useDragAndDrop.ts`,
  `app/renderer/components/hooks/shared/useExternalDragHandlers.ts` (`handleDragOver`, `handleDrop`),
  `app/renderer/components/hooks/shared/useFileValidation.ts` (`validateDroppedFile`);
  `app/renderer/components/hooks/sample-management/useSampleProcessing.ts` (`processAssignment`),
  `app/renderer/components/hooks/sample-management/useSampleManagementOperations.ts` (`handleSampleAdd`);
  `app/renderer/components/utils/dropRejections.ts` (one message naming the files a drop didn't add). Drop zones have
  test ID `drop-zone-voice-N`.
- **IPC:** `validate-sample-format`, `get-all-samples-for-kit`,
  `add-sample-to-slot` (`electron/main/db/sampleIpcHandlers.ts`).
- **Main:** `electron/main/services/sampleService.ts` → `electron/main/services/crud/sampleCrudService.ts`
  (`addSampleToSlot`, which refuses the right-hand voice of a linked pair) →
  `electron/main/db/operations/sampleCrudOperations.ts` (`addSample`).
- **Doc gaps:** none since the docs pass (#417).
- **Known issues:** RE-28, RE-36.

### UC-20 Replace a sample

**Status:** not built

Replace the file in an occupied slot, keeping its position. The service,
IPC channel and undo action exist, but no gesture reaches them: the only
caller passes `replaceExisting: false`, so a drop onto an occupied slot
appends instead (UC-19). No manual page describes replacing; the
"Confirm destructive actions" preference mentions it.

- **Renderer:** `app/renderer/components/hooks/sample-management/useSampleManagementOperations.ts` (`handleSampleReplace`),
  reachable only through `useSampleProcessing.executeAssignment` with
  `replaceExisting: true`, which nothing passes.
- **IPC:** `replace-sample-in-slot`.
- **Main:** `electron/main/services/sampleService.ts` (`replaceSampleInSlot`).
- **Decision needed:** build a replace gesture, or delete the dead path. A
  replace gesture must ask first while "Confirm destructive actions" is on,
  as sample delete does (`app/renderer/components/SampleDeleteButton.tsx`).
- **Known issues:** RE-26 (replace deletes, then adds, with no
  transaction).

### UC-21 Move samples within a kit

**Status:** supported

Drag a sample to another slot or voice in the same kit; the samples after
it shift to make room. The manual doesn't describe this; the website and
the FAQ mention reordering
([Can I undo changes?](../faq.md#can-i-undo-changes)).

- **Renderer:** `app/renderer/components/hooks/shared/useInternalDragHandlers.ts`
  (`handleSampleDrop`, drag type `application/x-romper-sample`);
  `app/renderer/components/hooks/sample-management/useSampleManagementMoveOps.ts`
  (`handleSampleMove`, records `MOVE_SAMPLE` undo).
- **IPC:** `move-sample-in-kit`.
- **Main:** `electron/main/services/sampleService.ts` → `electron/main/services/sampleBatchOperations.ts`
  (`moveSampleInKit`, refuses the linked partner voice) →
  `electron/main/db/operations/sampleManagementOps.ts` (`moveSample`) →
  `electron/main/db/operations/sampleMovement.ts` (`moveSampleInsertOnly`, one transaction).
- **Doc gap:** no manual section.
- **Known issues:** RE-28 (the modified flag is written outside the move
  transaction), RE-36, RE-45.

### UC-22 Move a sample to another kit

**Status:** not built

Move a sample from one kit to another. Main implements it, but the UI never
passes a target kit: only one kit is open at a time and kit cards aren't
drop targets. No user doc promises it.

- **Renderer:** the cross-kit branch of `app/renderer/components/hooks/sample-management/useSampleManagementMoveOps.ts`,
  unreachable from `app/renderer/components/hooks/shared/useInternalDragHandlers.ts`.
- **IPC:** `move-sample-between-kits`.
- **Main:** `electron/main/services/sampleService.ts` → `electron/main/services/crud/sampleCrudService.ts` →
  `electron/main/services/sampleBatchOperations.ts` (`executeCrossKitMove`).
- **Decision needed:** build it, or delete the backend.
- **Known issues:** RE-27 (not atomic; drops gain and WAV metadata),
  RE-57 (the contract offers an `"overwrite"` mode main rejects).

### UC-23 Delete a sample

**Status:** supported

Delete a sample with its trash button in an editable kit; the samples after
it move up. While "Confirm destructive actions" is on (the default), Romper
asks first. Undo puts it back. See
[Sample Slots](../manual/kit-editor.md#sample-slots).

- **Renderer:** `app/renderer/components/hooks/voice-panels/useVoicePanelButtons.tsx` →
  `app/renderer/components/SampleDeleteButton.tsx` (trash button; asks first
  while "Confirm destructive actions" is on) → `app/renderer/components/hooks/sample-management/useSampleActions.ts`
  (`handleDeleteSample`) → `app/renderer/components/hooks/sample-management/useSampleManagementOperations.ts`
  (`handleSampleDelete`, records `REINDEX_SAMPLES` undo).
- **IPC:** `delete-sample-from-slot`; undo uses
  `delete-sample-from-slot-without-reindexing`.
- **Main:** `electron/main/services/sampleService.ts` → `electron/main/services/crud/sampleCrudService.ts` →
  `electron/main/services/sampleBatchOperations.ts` (`deleteSampleFromSlot`) →
  `electron/main/db/operations/sampleCrudOperations.ts` (`deleteSamples`) and
  `electron/main/db/operations/sampleManagementOps.ts` (`performVoiceReindexing`).
- **Known issues:** RE-28, RE-36.

### UC-24 Set a sample's gain

**Status:** supported

Each sample in an editable kit has a gain knob, from -24 to +12 dB. Gain is
applied when the kit is written to the card. See
[Gain Control](../manual/kit-editor.md#gain-control).

- **Renderer:** `app/renderer/components/GainKnob.tsx`, rendered by
  `app/renderer/components/hooks/voice-panels/useVoicePanelSlotRendering.tsx`.
- **IPC:** `update-sample-gain` (`electron/main/dbIpcHandlers.ts`).
- **Main:** `electron/main/db/operations/sampleCrudOperations.ts` (`updateSampleGain`);
  applied at write time by `electron/main/formatConverter.ts`
  (`applyGain`).
- **Known issues:** RE-35 (a gain change doesn't mark the kit modified),
  RE-25 (no range check in main), RE-45 (same-named files share gain in the
  UI), RE-48 (no keyboard support on the knob). Gain changes aren't
  undoable (UC-26), and each change is a fire-and-forget IPC call with no
  error handling.

### UC-25 Reveal a sample in Finder or Explorer

**Status:** supported

Right-click a sample to show its source file in Finder or Explorer. Nothing
in the UI or the manual mentions it.

- **Renderer:** `app/renderer/components/hooks/voice-panels/useVoicePanelSlotRendering.tsx`
  (context menu) → `app/renderer/components/hooks/sample-management/useSampleActions.ts`
  (`handleSampleContextMenu`).
- **IPC:** `show-item-in-folder`.
- **Main:** `electron/main/ipcHandlers.ts` (`shell.showItemInFolder`).
- **Doc gap:** undocumented and undiscoverable.
- **Known issues:** RE-45 (metadata is keyed by file name, so a same-named
  file in another voice can reveal the wrong path).

**Test gap:** a real test would open Finder or Explorer; it needs a
`shell` stub in main to be testable above unit level.

### UC-26 Undo and redo

**Status:** supported

Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (or Ctrl+Y), and Edit > Undo and Redo,
undo sample adds, deletes and moves and sequencer edits in the open kit. A
focused text field keeps its own undo. See
[Keyboard Shortcuts](../manual/keyboard-shortcuts.md#kit-details) and
[Can I undo changes?](../faq.md#can-i-undo-changes).

- **Renderer:** `app/renderer/components/hooks/shared/useGlobalKeyboardShortcuts.ts`;
  `app/renderer/components/hooks/shared/useUndoRedo.ts`, `app/renderer/components/hooks/shared/useUndoRedoState.ts`, `app/renderer/components/hooks/shared/useUndoActionHandlers.ts`,
  `app/renderer/components/hooks/shared/useRedoActionHandlers.ts`;
  `app/renderer/components/hooks/sample-management/useSampleManagementUndoActions.ts`;
  `app/renderer/components/hooks/kit-management/useKitViewMenuHandlers.ts` with
  `app/renderer/components/hooks/shared/useMenuEvents.ts`; action types in `shared/undoTypes.ts`.
- **IPC:** `menu-undo`, `menu-redo` (pushed from main); undo replays the
  sample channels above.
- **Main:** `electron/main/applicationMenu.ts` (Edit > Undo and Redo).
- **Doc gaps:** none since the docs pass (#417).
- **Known issues:** none open.

## Voices and stereo

### UC-27 Name voices

**Status:** supported

In an editable kit, the pencil in a voice header renames the voice. Setup
and scans name unnamed voices from their file names and keep names set by hand. See
[Voice Names and Kit Type](../manual/kit-editor.md#voice-names-and-kit-type).

- **Renderer:** `app/renderer/components/hooks/voice-panels/useVoiceNameEditor.ts`,
  `app/renderer/components/hooks/voice-panels/useVoicePanelUI.tsx` (`renderVoiceName`), `app/renderer/components/hooks/voice-panels/useVoiceAlias.ts`;
  `app/renderer/components/KitVoicePanel.tsx`.
- **IPC:** `update-voice-alias`.
- **Main:** `electron/main/db/operations/voiceCrudOperations.ts` (`updateVoiceAlias`).
- **Known issues:** RE-48 (the name input has no label). A failed save only reaches
  the console.

### UC-28 Link a voice pair as stereo

**Status:** supported

The chain icon between two voices links them as a stereo pair: the left
voice's files play and are written in stereo, and the right voice is hidden.
The Stereo badge unlinks them. On an unlinked voice, stereo files are mixed
to mono when written. See
[Stereo and Mono Handling](../manual/kit-editor.md#stereo-and-mono-handling).

- **Renderer:** `app/renderer/components/KitVoicePanels.tsx`
  (`handleVoiceLink`, `handleVoiceUnlink`, test ID `link-button-N-M`);
  `app/renderer/components/hooks/sample-management/useStereoHandling.ts`;
  `app/renderer/components/hooks/voice-panels/useVoicePanelUI.tsx` (`stereo-badge-N`).
- **IPC:** `update-voice-stereo-mode` (refused for a kit that isn't
  editable, RE-71).
- **Main:** `electron/main/db/operations/voiceCrudOperations.ts` (`updateVoiceStereoMode`);
  `electron/main/services/validation/sampleValidator.ts`
  (`validateVoiceNotLinkedPartner`); at write time,
  `electron/main/services/syncMonoAnnotation.ts` (`annotateMonoConversion`).
- **Known issues:** none open.

## Audition

### UC-29 Play a sample

**Status:** partial

The play button on a sample, or Space on the selected one, previews it.
Starting a sample stops whatever else is playing on that voice (voice
choke). See
[Single Sample Playback](../manual/kit-editor.md#single-sample-playback).

- **Renderer:** `app/renderer/components/hooks/voice-panels/useVoicePanelButtons.tsx`
  (`renderPlayButton`); `app/renderer/components/hooks/kit-management/useKitPlayback.ts`;
  `app/renderer/components/voiceChoke.ts` (`claimVoice`);
  `app/renderer/components/SampleWaveform.tsx`; `app/renderer/utils/sharedAudioContext.ts`.
- **IPC:** `get-sample-audio-buffer` (`electron/main/ipcHandlers.ts`).
- **Main:** `electron/main/services/sampleService.ts` (`getSampleAudioBuffer`) →
  `electron/main/services/metadata/sampleMetadataService.ts`.
- **Doc gaps:** none since the docs pass (#417).
- **Known issues:** RE-45 (same-named samples in one voice share triggers),
  RE-46 (the waveform redraws every frame). No e2e presses Play; the e2e
  tests cover loading and decoding the audio.

### UC-30 Step sequencer

**Status:** supported

A 16-step grid per voice previews a kit's pattern at a set BPM. Patterns and
BPM are saved with the kit. See
[Step Sequencer](../manual/step-sequencer.md#grid-basics).

- **Renderer:** `app/renderer/components/KitStepSequencer.tsx`,
  `app/renderer/components/StepSequencerGrid.tsx`, `app/renderer/components/StepSequencerControls.tsx`,
  `app/renderer/components/StepSequencerDrawer.tsx`;
  `app/renderer/components/hooks/kit-management/useKitStepSequencerLogic.ts` (scheduler worker),
  `app/renderer/components/hooks/kit-management/useSequenceHistory.ts`; `app/renderer/components/hooks/shared/useStepPattern.ts`, `app/renderer/components/hooks/shared/useBpm.ts`,
  `app/renderer/components/hooks/shared/sequenceUndo.ts`.
- **IPC:** `update-step-pattern`, `update-kit-bpm`.
- **Main:** `electron/main/db/operations/kitCrudOperations.ts` (`updateKit`).
- **Known issues:** RE-25 (BPM isn't range-checked in main), RE-45, RE-36,
  RE-47. Undo covers less than the manual says (UC-26).

### UC-31 Trigger conditions

**Status:** supported

Right-click a step to give it an A:B condition, so it fires only on some
passes of the loop. See
[Trigger Conditions](../manual/step-sequencer.md#trigger-conditions-step-logic).

- **Renderer:** `app/renderer/components/StepSequencerGrid.tsx` (`ConditionPopover`,
  `handleStepContextMenu`); `app/renderer/components/ConditionPips.tsx`;
  `app/renderer/components/hooks/shared/stepPatternConstants.ts` (`shouldTrigger`),
  `app/renderer/components/hooks/shared/useTriggerConditions.ts`; `app/renderer/components/KitStepSequencer.tsx`.
- **IPC:** `update-trigger-conditions`.
- **Main:** `electron/main/db/operations/kitCrudOperations.ts` (`updateKit`).
- **Known issues:** RE-48 (conditions can only be set by right-click).

### UC-32 Sample mode, level and mute

**Status:** supported

Each voice in the sequencer has a sample mode (first, random or round-robin
across its samples), a level, and a mute that lasts for the session. See
[Sample Selection Mode](../manual/step-sequencer.md#sample-selection-mode)
and [Voice Volume and Mute](../manual/step-sequencer.md#voice-volume-and-mute).

- **Renderer:** `app/renderer/components/KitStepSequencer.tsx` (`handleVolumeChange`,
  `handleSampleModeChange`, `handleMuteToggle`); `app/renderer/components/StepSequencerGrid.tsx`;
  `app/renderer/components/hooks/kit-management/useKitStepSequencerLogic.ts`.
- **IPC:** `update-voice-volume`, `update-voice-sample-mode`; mute isn't
  saved.
- **Main:** `electron/main/db/operations/voiceCrudOperations.ts` (`updateVoiceVolume`,
  `updateVoiceSampleMode`).
- **Known issues:** RE-25 (no checks in main), RE-36. Failed level and mode
  saves are dropped silently.

### UC-33 Slicer

**Status:** supported

The slicer cuts a voice's sample into equal slices and plays a slice per
step, with rolls ("happy accidents") to generate patterns. See
[Slicer](../manual/step-sequencer.md#slicer) and the spec,
[`step-sequencer-slicer.md`](step-sequencer-slicer.md).

- **Renderer:** `app/renderer/components/hooks/kit-management/useSlicerEditor.ts`;
  `app/renderer/components/SliceStrip.tsx`, `app/renderer/components/SliceStepEditor.tsx`;
  `app/renderer/components/hooks/shared/useSliceSteps.ts`, `app/renderer/components/hooks/shared/sliceConstants.ts`;
  `shared/sliceTypes.ts`.
- **IPC:** `update-slice-steps`, `update-kit-slicer-division`,
  `update-voice-slice-settings`, `get-sample-audio-buffer`.
- **Main:** `electron/main/db/operations/kitCrudOperations.ts` (`updateKit`),
  `electron/main/db/operations/voiceCrudOperations.ts` (`updateVoiceSliceSettings`).
- **Known issues:** none open. Undo covers less than the manual says
  (UC-26).

## Write to card

### UC-34 Write kits to the SD card

**Status:** supported

**Write** in the browser header compares the store with the card and shows a
summary: kits and samples to write, conversions, files the store no longer
has, and samples that can't be written. It then makes the card match the
store. It converts files the Rample can't play, applies gain, mixes stereo
files on unlinked voices to mono, writes bank name files, and leaves the
Rample's own `_save` folder alone. Cancel stops between files. See
[Syncing](../manual/syncing.md) and the spec,
[`sd-card-layout.md`](sd-card-layout.md).

- **Renderer:** `app/renderer/components/KitBrowserHeader.tsx` (test ID
  `sync-to-sd-card`); `app/renderer/components/hooks/kit-management/useKitSync.ts`;
  `app/renderer/components/hooks/shared/useSyncUpdate.ts`, `app/renderer/components/hooks/shared/syncProgressStore.ts`;
  `app/renderer/components/dialogs/SyncUpdateDialog.tsx`.
- **IPC:** `generateSyncChangeSummary`, `startKitSync`, `cancelKitSync`,
  `select-sd-card`; push channel `sync-progress`
  (`electron/main/db/syncIpcHandlers.ts`).
- **Main:** `electron/main/services/syncService.ts` (`generateChangeSummary`,
  `startKitSync`, `cancelSync`, `planSync`, `removeStaleEntries`,
  `writeBankRtfFiles`); `electron/main/services/syncFileOperations.ts`, `electron/main/services/syncSampleProcessing.ts`,
  `electron/main/services/syncValidationService.ts`, `electron/main/services/syncMonoAnnotation.ts`,
  `electron/main/services/syncProgressManager.ts`, `electron/main/services/sdCardSafety.ts`, `electron/main/services/rtfFileService.ts`;
  `electron/main/formatConverter.ts`; `shared/rampleCardLayout.ts`.
- **Doc gaps:** none since the docs pass (#417).
- **Known issues:** RE-35 (the Modified filter misses gain and bank edits),
  RE-57 (contract drift in `SyncChangeSummary` and `SyncProgress`), RE-48
  (the write panel has no dialog role or Escape).
  No test above unit level cancels a write.

## App

### UC-35 Preferences

**Status:** partial

Settings (Cmd/Ctrl+, or the gear in the header) has three tabs: Sample
Management ("Confirm destructive actions"), Appearance (light, system or
dark) and Advanced (the local store; see UC-06). The status bar also cycles
the theme. The manual has no Preferences section; see
[The Main Interface](../manual/getting-started.md#the-main-interface).

- **Renderer:** `app/renderer/components/dialogs/PreferencesDialog.tsx`;
  `app/renderer/components/preferences/SampleManagementTab.tsx`, `app/renderer/components/preferences/AppearanceTab.tsx`,
  `app/renderer/components/preferences/AdvancedTab.tsx`; `app/renderer/utils/SettingsContext.tsx`;
  `app/renderer/components/hooks/shared/useMenuEvents.ts` (`menu-preferences`).
- **IPC:** `read-settings`, `write-settings`; push `menu-preferences`.
- **Main:** `electron/main/services/settingsService.ts` (`readSettings`,
  `writeSetting`); `electron/main/mainProcessSetup.ts` (`loadSettings`);
  `electron/main/settingsFile.ts` (value checks, atomic write).
- **Doc gaps:** none since the docs pass (#417).
- **Known issues:** RE-48.

### UC-36 Messages and error containment

**Status:** partial

Results and errors show as toasts at the top right that dismiss themselves.
An error boundary around the app, the kit list and the kit editor catches a
crash in that area and offers Try again, Back or Reload, instead of a blank
window. No manual page covers this; the requirements are in
[`product-requirements.md`](product-requirements.md).

- **Renderer:** `app/renderer/components/hooks/shared/useMessageDisplay.ts`, `app/renderer/components/hooks/shared/useMessageApi.ts`;
  `app/renderer/components/MessageDisplay.tsx`, `app/renderer/components/MessageDisplayContext.tsx`;
  `app/renderer/components/ErrorBoundary.tsx` (mounted in `app/renderer/main.tsx` and
  `app/renderer/views/KitsView.tsx`); `app/renderer/components/dialogs/CriticalErrorDialog.tsx`.
- **IPC, main:** none of its own; each feature reports through
  `onMessage`.
- **Doc gaps:** the PRD puts messages at the top centre and keeps errors
  until dismissed (`product-requirements.md:595, 829-832`); they're at the
  top right and errors go after 7 s. There's no message history.
- **Known issues:** RE-48. The renderer has no `unhandledrejection`
  handler. No test above unit level renders the error boundary in the app.

### UC-37 About, help, updates and diagnostics

**Status:** partial

The About dialog shows the version and links; the Help menu and status bar
link to the Romper and Rample manuals. On macOS, Romper checks for updates
at launch and weekly. `ROMPER_ENABLE_DEVTOOLS=1` turns on DevTools in an
installed build. See
[Troubleshooting](../troubleshooting.md#inspecting-romper-with-developer-tools)
and [Installation](../manual/getting-started.md#installation).

- **Renderer:** `app/renderer/components/dialogs/AboutDialog.tsx`;
  `app/renderer/components/StatusBar.tsx` (manual links); `app/renderer/main.tsx`
  (`menu-about`).
- **IPC:** `open-external`; push `menu-about`.
- **Main:** `electron/main/applicationMenu.ts` (`createApplicationMenu`:
  About, Help links, the DevTools opt-in); `electron/main/autoUpdater.ts`
  (`initAutoUpdater`).
- **Doc gaps:** none since the docs pass (#417).
- **Known issues:** RE-79 (Windows signing would leave the installed app unsigned), RE-18, RE-55 (no Intel Mac build), RE-56 (dead
  `AboutView`).

## Qualities

What Romper promises about how it behaves, whatever you're doing: the
user-oriented statements behind its non-functional work. Each has a status
like a use case, its tests are tagged the same way (`[Q-01]`), and every
open backlog item that isn't a use case's known issue is one of these.

### Q-01 Romper stays responsive as your library grows

**Status:** partial

Opening the app, opening and moving between kits, editing, and preparing a
write stay quick with hundreds of kits and thousands of samples. Each
everyday action has a work budget (`tests/perf/budgets.ts`) that a change
can't exceed; the plan to bring the budgets down is in
[`architecture-review.md`](architecture-review.md).

- **Known issues:** RE-36, RE-46, RE-47, RE-81, RE-82, RE-83, RE-85, RE-87,
  RE-88.

### Q-02 Your changes are saved completely, or not at all

**Status:** partial

An edit, a scan, an undo or an upgrade either finishes or leaves your
library as it was; it never leaves a kit half-changed or a sample without
its settings.

- **Known issues:** RE-22, RE-25, RE-26, RE-27, RE-28, RE-33, RE-81,
  RE-86, RE-89.

### Q-03 Romper only touches what you point it at

**Status:** partial

Romper reads your samples and writes only to your local store and the card
you choose. Its interface can't reach any other files or folders.

- **Known issues:** RE-84, RE-85.

### Q-04 The card ends up exactly matching your library

**Status:** supported

After a write, every file on the card is exactly what your library says it
should be, converted where the Rample needs it, and the Rample's own
settings folder is untouched. The full-pipeline validation checks this
byte for byte before every release.

- **Known issues:** none.

### Q-05 Releases are signed and install cleanly everywhere Romper runs

**Status:** partial

Every release is signed, so your operating system trusts it, is built for
each supported platform, and is made from up-to-date, secure parts.

- **Known issues:** RE-18, RE-49, RE-54, RE-55, RE-79, OPS-2, OPS-3.

### Q-06 Romper works with a keyboard and assistive technology

**Status:** partial

Everything you can do with a mouse you can do with a keyboard, and screen
readers can name every control.

- **Known issues:** RE-48.

### Q-07 Every change is tested before it reaches you

**Status:** partial

A change is merged only after its tests pass on every platform, and those
tests check what you'd notice, not just the code's internals.

- **Known issues:** RE-50, RE-51, RE-52, RE-53, RE-56, RE-57, RE-67,
  OPS-1.

## Promised, not built

The docs pass (#417) removed these promises from the user docs, because the
code doesn't do them. The product requirements still list most of them,
marked not built. Build any that are wanted, then document them again.

- A global preview volume slider (UC-29).
- A **Validate Store** button and its results dialog (UC-05).
- Kit locking from the UI, and status badges on kit cards (UC-08, UC-17).
- Importing factory samples after setup (UC-02).
- Resuming a partial download (UC-02).
- A warning when a dropped file is already in another voice (UC-19).
- Undo for gain, voice names, the editable switch, stereo links, kit
  create, duplicate and delete, and the sequencer's BPM, level, sample mode
  and slicer settings (UC-26).
- Write-time naming, duplicate and 12-slot checks, and "re-validate"
  (UC-34).
- A Linux AppImage (UC-37).
- An About link in the status bar (UC-37).
- Export and sharing of kit configurations, and batch operations (README).

