<!--
title: Use case register
status: living register (RE-67)
updated: 2026-10-03
context_size: large
-->

# Use cases

What Romper supports, from the user's side, and how each use case is built.
Each entry has:

- a description with a link to the manual;
- a **Concepts:** line linking the sections of
  [`domain-model.md`](domain-model.md) the entry reads or changes, each
  with its owner, copies and Rample manual section;
- entry points (renderer component or hook, IPC channels, main service),
  checked against the code on 2026-10-01;
- `**Status:** not built`, only when the docs or the code suggest it but no
  user can do it.

**Open issues are GitHub issues** labelled with the entry's ID, for example
[open issues for UC-19](https://github.com/peteb4ker/romper/issues?q=is%3Aopen+label%3AUC-19).
An issue's title says what a user would notice; its body has the technical
detail. (Older issues also link a `RE-` finding in the
[findings register](../../aidlc-docs/inception/reverse-engineering/code-quality-assessment.md),
now a frozen snapshot.) A doc gap (the docs promise what the code doesn't
do) is an issue too, labelled `documentation`, and a missing test is one
labelled `test`, so entries no longer list known issues or doc gaps here.
Issues labelled `triage`, or with no `UC-NN` or `Q-NN` label, haven't been
triaged yet and don't count. See [`BACKLOG.md`](../../BACKLOG.md) for the
loop.

The tests for each use case are listed in `traceability.md`, generated
(not committed) by `npm run trace` from `[UC-NN]` tags in test titles; CI
shows it in the Lint job summary. Tag a test
with the use cases it meaningfully covers, in its `describe` or `test` title:
`describe("[UC-14] creating a kit", ...)`. A supported use case needs a test
above unit level; when it has none, its entry says so in a `**Test gap:**`
line, which `npm run trace:check` accepts until a test closes it. A declared
test gap is an accepted limitation, not an issue.

The IDs are fixed in
[`validation-and-traceability.md`](validation-and-traceability.md). Add new
use cases at the end of their group with the next free ID, and create its
label (`gh label create UC-NN --description "<statement>"`); never reuse an
ID.

Everything traces from a user-oriented statement: a use case (what you can
do) or a quality (how Romper behaves while you do it, under
[Qualities](#qualities)).

## Status

Status isn't written here: `scripts/traceability.mjs` generates it from the
open GitHub issues. An entry is *supported* (works as the user docs
describe) when no open issue carries its label, and *partial* (works, with
a known bug, doc gap or missing test) when at least one does. Only *not
built* is set by hand, with a `**Status:** not built` line; open issues on
a not-built entry, such as one to build it, don't change it. So a fix
never edits this file to change a status: closing the issue is enough. See
each entry's status in the Lint job summary, the output of `npm run trace`,
the [website's testing page](https://peteb4ker.github.io/romper/testing/)
(as of the latest release), or on GitHub as the open issues for its label:
`https://github.com/peteb4ker/romper/issues?q=is%3Aopen+label%3AUC-NN`.

## Setup and local store

### UC-01 Set up from an SD card

On first launch, the setup wizard copies the kit folders from a Rample SD
card into a new local store and imports them. A voice with more than 12
samples keeps the first 12, and the wizard names the files it left out. A
voice whose samples are all stereo is linked with the next voice
automatically when that voice is free, and the setup summary lists each
pair it linked (#537, stereo rule 2). See
[Choosing a Local Store](../manual/getting-started.md#choosing-a-local-store).

**Concepts:** [Local store](domain-model.md#local-store-library), [Scan and setup import](domain-model.md#scan-and-setup-import), [Bank](domain-model.md#bank), [Stereo](domain-model.md#stereo).

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
  (one call per kit), `setup-import-bank-names` (the card's bank names),
  `cleanup-partial-init`, `write-settings`.
- **Main:** `electron/main/services/archiveService.ts` (`copyDirectory`);
  `electron/main/services/localStoreSetupService.ts` (`createSetupDatabase`,
  `hasExistingLocalStore`, `importSetupKit`, `importSetupBankNames`,
  `cleanupFailedSetup`, `cleanupUnfinishedSetups` on quit), which imports
  each kit with `electron/main/db/operations/kitScanOperations.ts`
  (`mergeKitScan`): up to 12 samples per voice, WAV metadata, voice names
  and stereo links (`planKitStereo` in `shared/stereoLinkRules.ts`), in one
  transaction per kit; and the card's `<letter> - <name>.rtf` files
  (`parseBankNameFile` in `shared/rampleCardLayout.ts`) into
  `banks.artist`, in one transaction.

### UC-02 Set up from the factory archive

The wizard's factory option downloads Squarp's sample archive (about
313 MiB), checks its SHA-256, extracts it into a new local store and imports
it. See
[Choosing a Local Store](../manual/getting-started.md#choosing-a-local-store)
and [Factory Samples](../manual/syncing.md#factory-samples).

**Concepts:** [Local store](domain-model.md#local-store-library), [Scan and setup import](domain-model.md#scan-and-setup-import), [Bank](domain-model.md#bank).

- **Renderer:** the UC-01 wizard, plus
  `app/renderer/components/hooks/wizard/useLocalStoreWizardFileOps.ts` (`extractSquarpArchive`, three
  attempts when main marks the failure `retryable`, otherwise main's reason
  at once).
- **IPC:** `download-and-extract-archive`; push events `archive-progress`,
  `archive-error`; `scan-banks` at startup for bank names.
- **Main:** `electron/main/services/archiveService.ts` (`downloadAndExtractArchive`,
  `getFactorySamplesArchiveUrl`); `electron/main/archiveUtils.ts`
  (`downloadArchive`, `extractZipEntries`); `electron/main/services/scanService.ts` (`scanBanks`).

### UC-03 Set up an empty library

The wizard's blank option creates an empty local store and opens the
browser on bank A with an Add Kit card. See
[Choosing a Local Store](../manual/getting-started.md#choosing-a-local-store)
and [Creating Kits](../manual/kit-browser.md#creating-kits).

**Concepts:** [Local store](domain-model.md#local-store-library), [Settings](domain-model.md#settings).

- **Renderer:** the UC-01 wizard with the blank source;
  `app/renderer/components/wizard/WizardPostInitGuidance.tsx`; then `app/renderer/components/KitBrowser.tsx` (UC-14).
- **IPC:** as UC-01, without `copy-dir` and `check-disk-space`.
- **Main:** `electron/main/services/localStoreSetupService.ts` (`createSetupDatabase`).

### UC-04 Choose an existing local store

On first launch, **Choose Existing Store** in the wizard points Romper at a
folder that already holds a local store (one containing `.romperdb`). See
[Recovering an Existing Store](../manual/getting-started.md#recovering-an-existing-store).

**Concepts:** [Local store](domain-model.md#local-store-library), [Settings](domain-model.md#settings).

- **Renderer:** `app/renderer/components/LocalStoreWizardUI.tsx` (`choose-existing-store-btn`,
  `handleChooseExistingStore`); `app/renderer/utils/SettingsContext.tsx`
  (`setLocalStorePath`); `app/renderer/components/hooks/kit-management/useLocalStoreSetupFlow.ts`.
- **IPC:** `select-existing-local-store`, `write-settings`,
  `get-local-store-status`.
- **Main:** `electron/main/services/localStoreService.ts` (`validateExistingLocalStore`) →
  `electron/main/localStoreValidator.ts` (`validateLocalStoreAndDb`);
  `electron/main/services/settingsService.ts` (`writeSetting`).

### UC-05 Recover from an invalid or missing store

When the saved local store is missing or no longer valid, Romper asks for
another. See
[Troubleshooting Setup](../manual/getting-started.md#troubleshooting-setup)
and [Validating Your Store](../manual/kit-browser.md#validating-your-store).

**Concepts:** [Local store](domain-model.md#local-store-library), [Settings](domain-model.md#settings).

- **Main, at startup:** `electron/main/mainProcessSetup.ts`
  (`validateSavedLocalStore`), which reports an invalid saved store but keeps
  its path (RE-80).
- **Renderer:** `app/renderer/utils/SettingsContext.tsx` (`refreshLocalStoreStatus`) →
  `app/renderer/components/hooks/kit-management/useLocalStoreSetupFlow.ts` → `app/renderer/components/dialogs/InvalidLocalStoreDialog.tsx`
  or the setup wizard; `app/renderer/components/dialogs/CriticalErrorDialog.tsx`.
  Nothing reads the store (kit load, startup bank scan, bank names) until
  its status says it's valid (`isLocalStoreReady`, #553).
- **IPC:** `get-local-store-status`, `validate-local-store`,
  `select-local-store-path`, `write-settings`.
- **Main:** `electron/main/services/localStoreService.ts` (`getLocalStoreStatus`);
  `electron/main/localStoreValidator.ts` (`validateLocalStoreAgainstDb`).

### UC-06 Change the local store

File > **Change Local Store...** or Settings > Advanced > **Change** switches
to another local store, and the browser reloads in place. A folder that isn't
a local store is refused with the reason. See
[Switching to Another Local Store](../manual/getting-started.md#switching-to-another-local-store).

**Concepts:** [Local store](domain-model.md#local-store-library), [Settings](domain-model.md#settings), [Undo history](domain-model.md#undo-history).

- **Renderer:** `app/renderer/components/hooks/shared/useMenuEvents.ts`
  (`menu-change-local-store-directory`) →
  `app/renderer/components/hooks/kit-management/useKitViewMenuHandlers.ts` →
  `app/renderer/components/dialogs/ChangeLocalStoreDirectoryDialog.tsx`;
  `app/renderer/components/preferences/AdvancedTab.tsx` → `app/renderer/components/dialogs/PreferencesDialog.tsx` →
  `app/renderer/components/hooks/shared/useChooseExistingLocalStore.ts` (shared with the wizard's Choose Existing Store);
  `app/renderer/utils/SettingsContext.tsx` (`setLocalStorePath`);
  `app/renderer/components/hooks/kit-management/useKitDataManager.ts` (`loadKitsData`).
- **IPC:** push `menu-change-local-store-directory`;
  `select-local-store-path`, `validate-local-store-basic`,
  `select-existing-local-store`, `write-settings`, `get-local-store-status`.
- **Main:** `electron/main/applicationMenu.ts`; `electron/main/services/settingsService.ts`;
  `electron/main/localStoreValidator.ts`.

## Browse and organise

### UC-07 Browse kits by bank

The kit browser shows every kit in a grid grouped by bank, A to Z. The bank
bar on the left and the letter keys jump to a bank; clicking a kit opens it.
The keys wait while a dialog is open.
See [Navigating Banks](../manual/kit-browser.md#navigating-banks) and
[Keyboard Navigation](../manual/kit-browser.md#keyboard-navigation).

**Concepts:** [Bank](domain-model.md#bank), [Kit](domain-model.md#kit).

- **Renderer:** `app/renderer/components/KitBrowserContainer.tsx` → `app/renderer/components/KitBrowser.tsx` →
  `app/renderer/components/KitBankNav.tsx`, `app/renderer/components/KitGrid.tsx` (rows from `app/renderer/components/utils/kitGridRows.ts`),
  `app/renderer/components/BankHeader.tsx`; `app/renderer/components/hooks/kit-management/useKitBrowser.ts`,
  `app/renderer/components/hooks/kit-management/useKitBankNavigation.ts`, `app/renderer/components/hooks/kit-management/useKitKeyboardNav.ts`;
  `app/renderer/components/hooks/useKitGridKeyboard.ts`; `app/renderer/utils/modalDialog.ts` (`isModalDialogOpen`).
- **IPC:** `get-all-kits`.
- **Main:** `electron/main/db/operations/kitCrudOperations.ts` (`getKits`).

### UC-08 Read kit card details

Each kit card shows the kit ID and alias, sample counts per voice, voice
names, a kit type icon, a stereo icon, a favourite star, a lock icon on
read-only kits and an amber border on kits changed since the last write.
See [Kit Cards](../manual/kit-browser.md#kit-cards).

**Concepts:** [Kit](domain-model.md#kit), [Voice](domain-model.md#voice), [Sample](domain-model.md#sample).

- **Renderer:** `app/renderer/components/KitGridCard.tsx`, `app/renderer/components/KitGridItem.tsx`, `app/renderer/components/KitVoiceStrip.tsx`,
  `app/renderer/components/shared/KitIconRenderer.tsx`, `app/renderer/components/shared/kitItemUtils.ts`;
  `app/renderer/components/hooks/kit-management/useKitItem.ts`.
- **IPC:** `get-all-kits`.

### UC-09 Search kits

The search box filters the grid to kits whose name, alias, bank artist,
voice names or sample file names contain the text (two characters or more),
and highlights the matches. See
[Search](../manual/kit-browser.md#search).

**Concepts:** [Kit](domain-model.md#kit), [Bank](domain-model.md#bank), [Voice](domain-model.md#voice), [Sample](domain-model.md#sample).

- **Renderer:** `app/renderer/components/KitBrowserHeader.tsx` → `app/renderer/components/SearchInput.tsx`;
  `app/renderer/components/hooks/kit-management/useKitSearch.ts`;
  `app/renderer/utils/kitSearchUtils.ts` (`filterKitsWithSearch`);
  `app/renderer/components/shared/searchHighlight.tsx`.
- **IPC, main:** none; search runs on the loaded kits.

### UC-10 Favourite kits

The star on a kit card or in the kit editor's header, or `;` (the
focused kit in the kit browser, the open kit in the kit editor) marks a
favorite; the Favorites filter shows only those. See
[Favorites Filter](../manual/kit-browser.md#favorites-filter).

**Concepts:** [Kit](domain-model.md#kit).

- **Renderer:** `app/renderer/components/KitGridItem.tsx` →
  `app/renderer/components/hooks/kit-management/useKitFilters.ts` (`handleToggleFavorite`,
  `handleToggleFavoritesFilter`, the count from the kit list); `app/renderer/components/hooks/kit-management/useKitKeyboardNav.ts` (`;`);
  `app/renderer/components/hooks/kit-management/useKitEditorKeyboardNav.ts` (`;`);
  `app/renderer/components/KitHeader.tsx`; both toggle through
  `app/renderer/components/hooks/kit-management/useKitDataManager.ts` (`toggleKitFavorite`), which
  updates the kit list.
- **IPC:** `toggle-kit-favorite`
  (`electron/main/db/favoritesIpcHandlers.ts`).
- **Main:** `electron/main/db/operations/kitFavoritesOperations.ts`.

### UC-11 Filter to kits modified since the last sync

The Modified filter shows the kits changed since they were last written to
the card. See [Modified Filter](../manual/kit-browser.md#modified-filter).

**Concepts:** [Kit](domain-model.md#kit), [The card and a write](domain-model.md#the-card-and-a-write).

- **Renderer:** `app/renderer/components/hooks/kit-management/useKitFilters.ts` (`handleToggleModifiedFilter`);
  `app/renderer/components/KitGridItem.tsx` (amber border).
- **Main:** `electron/main/db/operations/kitSyncOperations.ts` (`markKitAsModified`,
  `flagKitModified`, `flagBankKitsModified`, `markAllKitsAsSyncedExcept`);
  set by sample add, delete and move
  (`electron/main/services/sampleBatchOperations.ts`, `electron/main/services/crud/sampleCrudService.ts`), by a scan
  that adds samples, by gain, voice name and stereo link edits
  (`electron/main/db/operations/sampleCrudOperations.ts`, `electron/main/db/operations/voiceCrudOperations.ts`), by a
  bank rename for every kit in the bank (`electron/main/db/operations/crudOperations.ts`, `updateBank`), and on
  every created or duplicated kit; cleared on every kit by a completed
  write, except kits with a skipped sample (`electron/main/services/syncService.ts`).

### UC-12 Name banks

Each bank header has an editable artist name. Names are stored in the local
store and written to the card as `<letter> - <name>.rtf` files. See
[Editing Bank Names](../manual/kit-browser.md#editing-bank-names).

**Concepts:** [Bank](domain-model.md#bank), [The card and a write](domain-model.md#the-card-and-a-write).

- **Renderer:** `app/renderer/components/BankHeader.tsx` →
  `app/renderer/components/hooks/kit-management/useKitBankNavigation.ts` (`handleBankNameChange`).
- **IPC:** `update-bank` (`electron/main/dbIpcHandlers.ts`), `get-all-banks`
  (the names the browser shows), `scan-banks`.
- **Main:** `electron/main/db/operations/crudOperations.ts` (`updateBank`);
  `electron/main/services/rtfFileService.ts` (`writeRtfFile`, `removeRtfFile`); `electron/main/services/scanService.ts`
  (`scanBanks`); written to the card by `electron/main/services/syncService.ts`
  (`writeBankRtfFiles`).

### UC-13 Scan a kit, or scan all

**Scan Kit** in the kit editor (or "/") rebuilds a read-only kit's samples
from its folder, keeping edits, and names unnamed voices; in an editable
kit it only names voices. File > **Scan All** scans the bank names and every
kit. A scan never changes a stereo link; it reports what the write will do:
pairs it will link automatically, voices it will mix down to mono, and
quarantined kits (#537). See
[Scanning Your Library](../manual/kit-browser.md#scanning-your-library).

**Concepts:** [Scan and setup import](domain-model.md#scan-and-setup-import), [Bank](domain-model.md#bank), [Stereo](domain-model.md#stereo).

- **Renderer:** `app/renderer/components/KitHeader.tsx` and `app/renderer/components/hooks/kit-management/useKitEditorKeyboardNav.ts` →
  `app/renderer/components/hooks/kit-management/useKitScanning.ts` (`handleScanKit`);
  `app/renderer/components/hooks/kit-management/useKitViewMenuHandlers.ts` (`menu-scan-all-kits`) →
  `app/renderer/views/KitsView.tsx` (every kit in the store) →
  `app/renderer/components/hooks/kit-management/useKitScan.ts` (`scanAllKits`), `app/renderer/components/hooks/shared/useBankScanning.ts`.
- **IPC:** `rescan-kit`, `scan-banks`; push `menu-scan-all-kits`.
- **Main:** `electron/main/services/scanService.ts` (`rescanKit`, `scanBanks`);
  `electron/main/db/operations/kitScanOperations.ts` (`mergeKitScan`,
  `planKitScanMerge`).

## Kit lifecycle

### UC-14 Create a kit

Click the **Add Kit** card at the end of a bank to create a blank kit in
the bank's first free slot. An empty bank opens from its dimmed letter in
the bank bar, and an empty library shows bank A with an Add Kit card. See
[Creating Kits](../manual/kit-browser.md#creating-kits).

**Concepts:** [Kit](domain-model.md#kit).

- **Renderer:** `app/renderer/components/AddKitCard.tsx` (placed by
  `app/renderer/components/KitGrid.tsx`, test ID `add-kit-<bank>`), `app/renderer/components/KitBankNav.tsx`;
  `app/renderer/components/hooks/kit-management/useKitCreation.ts` (`handleCreateKitInBank`);
  `app/renderer/components/utils/kitOperations.ts` (`createKit`);
  `shared/kitUtilsShared.ts` (`getNextSlotInBank`).
- **IPC:** `create-kit` (`electron/main/ipcHandlers.ts`).
- **Main:** `electron/main/services/kitService.ts` (`createKit`) →
  `electron/main/db/operations/kitCrudOperations.ts` (`addKit`).

### UC-15 Duplicate a kit

Copy a kit, with its samples, gain, voice settings and sequence, into
another slot by typing the target (for example `B5`) in the kit card's
duplicate popover. See
[Duplicating Kits](../manual/kit-browser.md#duplicating-kits).

**Concepts:** [Kit](domain-model.md#kit), [Voice](domain-model.md#voice), [Sample](domain-model.md#sample).

- **Renderer:** the copy button on the kit card (`app/renderer/components/KitGridItem.tsx`) and
  `app/renderer/components/shared/KitItemActionPopovers.tsx` (`DuplicatePopoverContent`);
  `app/renderer/components/hooks/kit-management/useKitItemActions.ts`,
  `app/renderer/components/hooks/kit-management/useKitDuplication.ts` (`duplicateKitDirect`).
- **IPC:** `copy-kit`.
- **Main:** `electron/main/services/kitService.ts` (`copyKit`) → `electron/main/db/operations/kitCrudOperations.ts` (`copyKit`,
  one transaction).

### UC-16 Delete a kit

Delete an editable kit from its card, after a popover that says how many
samples it holds. The next write removes it from the card. The manual
doesn't describe this yet; the only mention is in
[The Sync Process](../manual/syncing.md#the-sync-process).

**Concepts:** [Kit](domain-model.md#kit), [The card and a write](domain-model.md#the-card-and-a-write).

- **Renderer:** the trash button on the kit card (`app/renderer/components/KitGridItem.tsx`, test ID
  `delete-kit-button`, shown only on editable kits) and
  `app/renderer/components/shared/KitItemActionPopovers.tsx` (`DeletePopoverContent`);
  `app/renderer/components/hooks/kit-management/useKitDeletion.ts` (`requestDeleteSummary`, `deleteKitDirect`).
- **IPC:** `get-kit-delete-summary`, `delete-kit`.
- **Main:** `electron/main/services/kitService.ts` (`deleteKit`, `getKitDeleteSummary`) →
  `electron/main/db/operations/kitCrudOperations.ts` (`deleteKit`, `getKitDeleteSummary`).

### UC-17 Make a kit editable and set its alias

Kits open read-only. The header switch makes a kit editable, which shows the
editing controls (drop, delete, gain, voice names). The kit's display name
(alias) is edited in the header. See
[Opening a Kit](../manual/kit-editor.md#opening-a-kit) and
[Kit Status Indicators](../manual/kit-browser.md#kit-status-indicators).

**Concepts:** [Kit](domain-model.md#kit).

- **Renderer:** `app/renderer/components/KitHeader.tsx` (editable switch,
  alias input); `app/renderer/components/hooks/kit-management/useKitEditorLogic.ts`;
  `app/renderer/components/hooks/kit-management/useKitDataManager.ts` (`updateKitAlias`,
  `toggleKitEditable`).
- **IPC:** `update-kit-metadata` (`electron/main/dbIpcHandlers.ts`).
- **Main:** `electron/main/db/operations/kitCrudOperations.ts` (`updateKit`).

### UC-18 Step to the previous or next kit

In the kit editor, the header's arrow buttons and the `,` and `.` keys open
the previous or next kit in slot order. See
[Navigating Between Kits](../manual/kit-editor.md#navigating-between-kits).

**Concepts:** [Kit](domain-model.md#kit).

- **Renderer:** `app/renderer/components/KitHeader.tsx` (prev and next buttons);
  `app/renderer/components/hooks/kit-management/useKitEditorKeyboardNav.ts` (`,` and `.`);
  `app/renderer/components/hooks/kit-management/useKitNavigation.ts` (`handleNextKit`,
  `handlePrevKit`); wired in `app/renderer/views/KitsView.tsx`.
- **IPC, main:** none.

## Samples

### UC-19 Drop WAVs onto a voice

Drag WAV files from Finder or Explorer onto a voice in an editable kit. Each
file is checked and added to the voice's next free slot, up to 12. A
stereo sample on a mono voice that would be linked automatically asks
**Link** or **Keep mono**, and the answer is remembered; a mono sample on a
stereo pair is added with a warning, and the kit is quarantined until it's
fixed (#537, #574).
See [Drag and Drop](../manual/kit-editor.md#drag-and-drop).

**Concepts:** [Sample](domain-model.md#sample), [Stereo](domain-model.md#stereo).

- **Renderer:** `app/renderer/components/hooks/shared/useDragAndDrop.ts`,
  `app/renderer/components/hooks/shared/useExternalDragHandlers.ts` (`handleDragOver`, `handleDrop`),
  `app/renderer/components/hooks/shared/useFileValidation.ts` (`validateDroppedFile`);
  `app/renderer/components/hooks/sample-management/useSampleProcessing.ts` (`processAssignment`),
  `app/renderer/components/hooks/sample-management/useSampleManagementOperations.ts` (`handleSampleAdd`);
  `app/renderer/components/utils/dropRejections.ts` (one message naming the files a drop didn't add);
  `app/renderer/components/KitVoicePanels.tsx` (`stereoDrop`: the
  `stereo-drop-prompt` dialog and the stereo messages). Drop zones have
  test ID `drop-zone-voice-N`.
- **IPC:** `validate-sample-format`, `get-all-samples-for-kit`,
  `add-sample-to-slot` (`electron/main/db/sampleIpcHandlers.ts`).
- **Main:** `electron/main/services/sampleService.ts` → `electron/main/services/crud/sampleCrudService.ts`
  (`addSampleToSlot`, which refuses the right-hand voice of a linked pair) →
  `electron/main/db/operations/sampleCrudOperations.ts` (`addSample`).

### UC-20 Replace a sample

**Status:** not built

Replace the file in an occupied slot, keeping its position. The service,
IPC channel and undo action exist, but no gesture reaches them: the only
caller passes `replaceExisting: false`, so a drop onto an occupied slot
appends instead (UC-19). No manual page describes replacing; the
"Confirm destructive actions" preference mentions it.

**Concepts:** [Sample](domain-model.md#sample).

- **Renderer:** `app/renderer/components/hooks/sample-management/useSampleManagementOperations.ts` (`handleSampleReplace`),
  reachable only through `useSampleProcessing.executeAssignment` with
  `replaceExisting: true`, which nothing passes.
- **IPC:** `replace-sample-in-slot`.
- **Main:** `electron/main/services/crud/sampleCrudService.ts` (`replaceSampleInSlot`) →
  `electron/main/db/operations/sampleCrudOperations.ts` (`replaceSampleTx`,
  one in-place update that keeps the slot and gain).
- **Decision needed:** build a replace gesture, or delete the dead path. A
  replace gesture must ask first while "Confirm destructive actions" is on,
  as sample delete does (`app/renderer/components/SampleDeleteButton.tsx`).

### UC-21 Move samples within a kit

Drag a sample to another slot or voice in the same kit; the samples after
it shift to make room. The manual doesn't describe this; the website and
the FAQ mention reordering
([Can I undo changes?](../faq.md#can-i-undo-changes)).

**Concepts:** [Sample](domain-model.md#sample).

- **Renderer:** `app/renderer/components/hooks/shared/useInternalDragHandlers.ts`
  (`handleSampleDrop`, drag type `application/x-romper-sample`);
  `app/renderer/components/hooks/sample-management/useSampleManagementMoveOps.ts`
  (`handleSampleMove`, records `MOVE_SAMPLE` undo).
- **IPC:** `move-sample-in-kit`.
- **Main:** `electron/main/services/sampleService.ts` → `electron/main/services/sampleBatchOperations.ts`
  (`moveSampleInKit`, refuses the linked partner voice) →
  `electron/main/db/operations/sampleManagementOps.ts` (`moveSample`) →
  `electron/main/db/operations/sampleMovement.ts` (`moveSampleInsertOnly`, one transaction).

### UC-22 Move a sample to another kit

**Status:** not built

Move a sample from one kit to another. Main implements it, but the UI never
passes a target kit: only one kit is open at a time and kit cards aren't
drop targets. No user doc promises it.

**Concepts:** [Sample](domain-model.md#sample).

- **Renderer:** the cross-kit branch of `app/renderer/components/hooks/sample-management/useSampleManagementMoveOps.ts`,
  unreachable from `app/renderer/components/hooks/shared/useInternalDragHandlers.ts`.
- **IPC:** `move-sample-between-kits`.
- **Main:** `electron/main/services/sampleService.ts` → `electron/main/services/crud/sampleCrudService.ts` →
  `electron/main/db/operations/sampleMovement.ts` (`moveSampleBetweenKitsTx`,
  one transaction that carries the row).
- **Decision needed:** build it, or delete the backend.

### UC-23 Delete a sample

Delete a sample with its trash button in an editable kit; the samples after
it move up. While "Confirm destructive actions" is on (the default), Romper
asks first. Undo puts it back. See
[Sample Slots](../manual/kit-editor.md#sample-slots).

**Concepts:** [Sample](domain-model.md#sample), [Settings](domain-model.md#settings).

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

### UC-24 Set a sample's gain

Each sample in an editable kit has a gain knob, from -24 to +12 dB. Gain is
applied when the kit is written to the card. See
[Gain Control](../manual/kit-editor.md#gain-control).

**Concepts:** [Sample](domain-model.md#sample), [The card and a write](domain-model.md#the-card-and-a-write).

- **Renderer:** `app/renderer/components/GainKnob.tsx`, rendered by
  `app/renderer/components/hooks/voice-panels/useVoicePanelSlotRendering.tsx`;
  saved by `app/renderer/components/KitVoicePanels.tsx` (`handleGainChange`)
  through `app/renderer/components/hooks/shared/useSettingSave.ts`, which
  puts back a gain that isn't saved and says so.
- **IPC:** `update-sample-gain` (`electron/main/dbIpcHandlers.ts`).
- **Main:** `electron/main/db/operations/sampleCrudOperations.ts` (`updateSampleGain`);
  applied at write time by `electron/main/formatConverter.ts`
  (`applyGain`).

### UC-25 Reveal a sample in Finder or Explorer

Right-click a sample to show its source file in Finder or Explorer. Nothing
in the UI or the manual mentions it.

**Concepts:** [Sample](domain-model.md#sample).

- **Renderer:** `app/renderer/components/hooks/voice-panels/useVoicePanelSlotRendering.tsx`
  (context menu) → `app/renderer/components/hooks/sample-management/useSampleActions.ts`
  (`handleSampleContextMenu`).
- **IPC:** `show-item-in-folder`.
- **Main:** `electron/main/ipcHandlers.ts` (`shell.showItemInFolder`).

**Test gap:** a real test would open Finder or Explorer; it needs a
`shell` stub in main to be testable above unit level.

### UC-26 Undo and redo

Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (or Ctrl+Y), and Edit > Undo and Redo,
undo sample adds, deletes and moves and sequencer edits in the open kit. A
focused text field keeps its own undo. See
[Keyboard Shortcuts](../manual/keyboard-shortcuts.md#kit-details) and
[Can I undo changes?](../faq.md#can-i-undo-changes).

**Concepts:** [Undo history](domain-model.md#undo-history).

- **Renderer:** `app/renderer/components/hooks/shared/useGlobalKeyboardShortcuts.ts`;
  `app/renderer/components/hooks/shared/useUndoRedo.ts`, `app/renderer/components/hooks/shared/useUndoRedoState.ts`, `app/renderer/components/hooks/shared/useUndoActionHandlers.ts`,
  `app/renderer/components/hooks/shared/useRedoActionHandlers.ts`;
  `app/renderer/components/hooks/sample-management/useSampleManagementUndoActions.ts`;
  `app/renderer/components/hooks/kit-management/useKitViewMenuHandlers.ts` with
  `app/renderer/components/hooks/shared/useMenuEvents.ts`; action types in `shared/undoTypes.ts`.
- **IPC:** `menu-undo`, `menu-redo` (pushed from main). Undoing a delete,
  replace or move restores the voices it touched with one
  `restore-kit-voices` call: full rows, gain and WAV details included, in
  one transaction (RE-86). Redo and undoing an add replay the sample
  channels above.
- **Main:** `electron/main/applicationMenu.ts` (Edit > Undo and Redo);
  `electron/main/db/operations/sampleCrudOperations.ts` (`restoreVoicesTx`).

## Voices and stereo

### UC-27 Name voices

In an editable kit, the pencil in a voice header renames the voice. Setup
and scans name unnamed voices from their file names and keep names set by hand. See
[Voice Names and Kit Type](../manual/kit-editor.md#voice-names-and-kit-type).

**Concepts:** [Voice](domain-model.md#voice), [Scan and setup import](domain-model.md#scan-and-setup-import).

- **Renderer:** `app/renderer/components/hooks/voice-panels/useVoiceNameEditor.ts`,
  `app/renderer/components/hooks/voice-panels/useVoicePanelUI.tsx` (`renderVoiceName`), `app/renderer/components/hooks/voice-panels/useVoiceAlias.ts`;
  `app/renderer/components/KitVoicePanel.tsx`.
- **IPC:** `update-voice-alias`.
- **Main:** `electron/main/db/operations/voiceCrudOperations.ts` (`updateVoiceAlias`).

### UC-28 Link a voice pair as stereo

The chain icon between two voices links them as a stereo pair: the left
voice's files play and are written in stereo, and the right voice is hidden.
The Stereo badge unlinks them. On an unlinked voice, stereo files are mixed
to mono when written. See
[Stereo and Mono Handling](../manual/kit-editor.md#stereo-and-mono-handling).

**Concepts:** [Voice](domain-model.md#voice), [Stereo](domain-model.md#stereo).

- **Renderer:** `app/renderer/components/KitVoicePanels.tsx`
  (`handleVoiceLink`, `handleVoiceUnlink`, test ID `link-button-N-M`);
  `app/renderer/components/hooks/sample-management/useStereoHandling.ts`;
  `app/renderer/components/hooks/voice-panels/useVoicePanelUI.tsx` (`stereo-badge-N`).
- **IPC:** `update-voice-stereo-mode` (refused for a kit that isn't
  editable, RE-71, and for a link `checkStereoLink` refuses, #541).
- **Main:** `electron/main/db/operations/voiceCrudOperations.ts` (`updateVoiceStereoMode`,
  checking `checkStereoLink` from `shared/stereoLinkRules.ts`, the rule
  the link button and drops use too);
  `electron/main/services/validation/sampleValidator.ts`
  (`validateVoiceNotLinkedPartner`); at write time,
  `electron/main/services/syncMonoAnnotation.ts` (`annotateMonoConversion`).

## Audition

### UC-29 Play a sample

The play button on a sample, or Space on the selected one, previews it.
Starting a sample stops whatever else is playing on that voice (voice
choke). See
[Single Sample Playback](../manual/kit-editor.md#single-sample-playback).

**Concepts:** [Playback and voice choke](domain-model.md#playback-and-voice-choke), [Sample](domain-model.md#sample), [Stereo](domain-model.md#stereo).

- **Renderer:** `app/renderer/components/hooks/voice-panels/useVoicePanelButtons.tsx`
  (`renderPlayButton`); `app/renderer/components/hooks/kit-management/useKitPlayback.ts`;
  `app/renderer/components/voiceChoke.ts` (`claimVoice`);
  `app/renderer/components/SampleWaveform.tsx`; `app/renderer/utils/sharedAudioContext.ts`.
- **IPC:** `get-sample-audio-buffer` (`electron/main/ipcHandlers.ts`).
- **Main:** `electron/main/services/sampleService.ts` (`getSampleAudioBuffer`) →
  `electron/main/services/metadata/sampleMetadataService.ts`.

### UC-30 Step sequencer

A 16-step grid per voice previews a kit's pattern at a set BPM. Patterns and
BPM are saved with the kit. See
[Step Sequencer](../manual/step-sequencer.md#grid-basics).

**Concepts:** [Kit](domain-model.md#kit), [Playback and voice choke](domain-model.md#playback-and-voice-choke).

- **Renderer:** `app/renderer/components/KitStepSequencer.tsx`,
  `app/renderer/components/StepSequencerGrid.tsx`, `app/renderer/components/StepSequencerControls.tsx`,
  `app/renderer/components/StepSequencerDrawer.tsx`;
  `app/renderer/components/hooks/kit-management/useKitStepSequencerLogic.ts` (scheduler worker),
  `app/renderer/components/hooks/kit-management/useSequenceHistory.ts`; `app/renderer/components/hooks/shared/useStepPattern.ts`, `app/renderer/components/hooks/shared/useBpm.ts`
  (both save through `app/renderer/components/hooks/shared/useSettingSave.ts`, which
  puts back steps or a BPM that isn't saved and says so),
  `app/renderer/components/hooks/shared/sequenceUndo.ts`.
- **IPC:** `update-step-pattern`, `update-kit-bpm`.
- **Main:** `electron/main/db/operations/kitCrudOperations.ts` (`updateKit`).

### UC-31 Trigger conditions

Right-click a step, or press `C` on the focused step, to give it an A:B
condition, so it fires only on some passes of the loop. See
[Trigger Conditions](../manual/step-sequencer.md#trigger-conditions-step-logic).

**Concepts:** [Kit](domain-model.md#kit).

- **Renderer:** `app/renderer/components/StepSequencerGrid.tsx` (`ConditionPopover`,
  `handleStepContextMenu`); `app/renderer/components/ConditionPips.tsx`;
  `app/renderer/components/hooks/shared/stepPatternConstants.ts` (`shouldTrigger`),
  `app/renderer/components/hooks/shared/useTriggerConditions.ts` (saves through
  `app/renderer/components/hooks/shared/useSettingSave.ts`); `app/renderer/components/KitStepSequencer.tsx`.
- **IPC:** `update-trigger-conditions`.
- **Main:** `electron/main/db/operations/kitCrudOperations.ts` (`updateKit`).

### UC-32 Sample mode, level and mute

Each voice in the sequencer has a sample mode (first, random or round-robin
across its samples), a level, and a mute that lasts for the session. See
[Sample Selection Mode](../manual/step-sequencer.md#sample-selection-mode)
and [Voice Volume and Mute](../manual/step-sequencer.md#voice-volume-and-mute).

**Concepts:** [Voice](domain-model.md#voice), [Playback and voice choke](domain-model.md#playback-and-voice-choke).

- **Renderer:** `app/renderer/components/KitStepSequencer.tsx` (`handleVolumeChange`,
  `handleSampleModeChange`, `handleMuteToggle`), saving through
  `app/renderer/components/hooks/shared/useSettingSave.ts`; `app/renderer/components/StepSequencerGrid.tsx`;
  `app/renderer/components/hooks/kit-management/useKitStepSequencerLogic.ts`.
- **IPC:** `update-voice-volume`, `update-voice-sample-mode`; mute isn't
  saved.
- **Main:** `electron/main/db/operations/voiceCrudOperations.ts` (`updateVoiceVolume`,
  `updateVoiceSampleMode`).

### UC-33 Slicer

The slicer cuts a voice's sample into equal slices and plays a slice per
step, with rolls ("happy accidents") to generate patterns. See
[Slicer](../manual/step-sequencer.md#slicer) and the spec,
[`step-sequencer-slicer.md`](step-sequencer-slicer.md).

**Concepts:** [Kit](domain-model.md#kit), [Voice](domain-model.md#voice), [Sample](domain-model.md#sample), [Playback and voice choke](domain-model.md#playback-and-voice-choke).

- **Renderer:** `app/renderer/components/hooks/kit-management/useSlicerEditor.ts`
  (`useVoiceSliceSettings`);
  `app/renderer/components/SliceStrip.tsx`, `app/renderer/components/SliceStepEditor.tsx`;
  `app/renderer/components/hooks/shared/useSliceSteps.ts`, `app/renderer/components/hooks/shared/sliceConstants.ts`;
  `shared/sliceTypes.ts`. Slices, the division and slicer settings save through
  `app/renderer/components/hooks/shared/useSettingSave.ts`, which puts back an
  edit that isn't saved and says so.
- **IPC:** `update-slice-steps`, `update-kit-slicer-division`,
  `update-voice-slice-settings`, `get-sample-audio-buffer`.
- **Main:** `electron/main/db/operations/kitCrudOperations.ts` (`updateKit`),
  `electron/main/db/operations/voiceCrudOperations.ts` (`updateVoiceSliceSettings`).

## Write to card

### UC-34 Write kits to the SD card

**Write** in the browser header compares the store with the card and shows a
summary: kits and samples to write, conversions, files the store no longer
has, and samples that can't be written. It then makes the card match the
store. It converts files the Rample can't play, applies gain, mixes stereo
files on unlinked voices to mono, writes bank name files, and leaves the
Rample's own `_save` folder alone. It links stereo voices automatically
where stereo rule 2 says, and leaves a quarantined kit off the card with
its card folder untouched (#537); the summary lists both. Cancel stops
between files. See
[Syncing](../manual/syncing.md) and the spec,
[`sd-card-layout.md`](sd-card-layout.md).

**Concepts:** [The card and a write](domain-model.md#the-card-and-a-write), [Sample](domain-model.md#sample), [Stereo](domain-model.md#stereo), [Bank](domain-model.md#bank), [Settings](domain-model.md#settings).

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
  `electron/main/services/syncStereoPlan.ts` (`planWriteStereo`),
  `electron/main/services/syncProgressManager.ts`, `electron/main/services/sdCardSafety.ts`, `electron/main/services/rtfFileService.ts`;
  `electron/main/formatConverter.ts`; `shared/rampleCardLayout.ts`.

## App

### UC-35 Preferences

Settings (Cmd/Ctrl+, or the gear in the header) has three tabs: Sample
Management ("Confirm destructive actions"), Appearance (light, system or
dark) and Advanced (the local store; see UC-06). The status bar also cycles
the theme. The manual has no Preferences section; see
[The Main Interface](../manual/getting-started.md#the-main-interface).

**Concepts:** [Settings](domain-model.md#settings).

- **Renderer:** `app/renderer/components/dialogs/PreferencesDialog.tsx`;
  `app/renderer/components/preferences/SampleManagementTab.tsx`, `app/renderer/components/preferences/AppearanceTab.tsx`,
  `app/renderer/components/preferences/AdvancedTab.tsx`; `app/renderer/utils/SettingsContext.tsx`;
  `app/renderer/components/hooks/shared/useMenuEvents.ts` (`menu-preferences`).
- **IPC:** `read-settings`, `write-settings`; push `menu-preferences`.
- **Main:** `electron/main/services/settingsService.ts` (`readSettings`,
  `writeSetting`); `electron/main/mainProcessSetup.ts` (`loadSettings`);
  `electron/main/settingsFile.ts` (value checks, atomic write).

### UC-36 Messages and error containment

Results and errors show as toasts at the top right that dismiss themselves.
An error boundary around the app, the kit list and the kit editor catches a
crash in that area and offers Try again, Back or Reload, instead of a blank
window. A promise that rejects outside a render, such as an IPC call nobody
awaited, is logged and shows one error message per burst. No manual page
covers this; [Troubleshooting](../troubleshooting.md) explains the
background-failure message, and the requirements are in
[`product-requirements.md`](product-requirements.md).

**Concepts:** [The IPC contract](domain-model.md#the-ipc-contract).

- **Renderer:** `app/renderer/components/hooks/shared/useMessageDisplay.ts`, `app/renderer/components/hooks/shared/useMessageApi.ts`;
  `app/renderer/components/MessageDisplay.tsx`, `app/renderer/components/MessageDisplayContext.tsx`;
  `app/renderer/components/ErrorBoundary.tsx` (mounted in `app/renderer/main.tsx` and
  `app/renderer/views/KitsView.tsx`); `app/renderer/components/dialogs/CriticalErrorDialog.tsx`;
  `app/renderer/utils/unhandledRejectionReporter.ts` (installed in `app/renderer/main.tsx`).
- **IPC, main:** none of its own; each feature reports through
  `onMessage`.

### UC-37 About, help, updates and diagnostics

The About dialog shows the version and links; the Help menu and status bar
link to the Romper and Rample manuals. On macOS, Romper checks for updates
at launch and weekly. `ROMPER_ENABLE_DEVTOOLS=1` turns on DevTools in an
installed build. See
[Troubleshooting](../troubleshooting.md#inspecting-romper-with-developer-tools)
and [Installation](../manual/getting-started.md#installation).

**Concepts:** [Settings](domain-model.md#settings).

- **Renderer:** `app/renderer/components/dialogs/AboutDialog.tsx`;
  `app/renderer/components/StatusBar.tsx` (manual links); `app/renderer/main.tsx`
  (`menu-about`).
- **IPC:** `open-external`; push `menu-about`.
- **Main:** `electron/main/applicationMenu.ts` (`createApplicationMenu`:
  About, Help links, the DevTools opt-in); `electron/main/autoUpdater.ts`
  (`initAutoUpdater`).

## Qualities

What Romper promises about how it behaves, whatever you're doing: the
user-oriented statements behind its non-functional work. Each has a status
like a use case, its tests and issues are labelled the same way (`[Q-01]`,
`Q-01`), and an issue that no use case shows goes under one of these.

### Q-01 Romper stays responsive as your library grows

Opening the app, opening and moving between kits, editing, and preparing a
write stay quick with hundreds of kits and thousands of samples. Each
everyday action has a work budget (`tests/perf/budgets.ts`) that a change
can't exceed; the plan to bring the budgets down is in
[`architecture-review.md`](architecture-review.md).

**Concepts:** [Kit](domain-model.md#kit), [Sample](domain-model.md#sample), [Playback and voice choke](domain-model.md#playback-and-voice-choke), [The IPC contract](domain-model.md#the-ipc-contract).


### Q-02 Your changes are saved completely, or not at all

An edit, a scan, an undo or an upgrade either finishes or leaves your
library as it was; it never leaves a kit half-changed or a sample without
its settings.

**Concepts:** [The IPC contract](domain-model.md#the-ipc-contract), [Undo history](domain-model.md#undo-history), [Scan and setup import](domain-model.md#scan-and-setup-import).


### Q-03 Romper only touches what you point it at

Romper reads your samples and writes only to your local store and the card
you choose. Its interface can't reach any other files or folders.

**Concepts:** [Local store](domain-model.md#local-store-library), [Settings](domain-model.md#settings), [The IPC contract](domain-model.md#the-ipc-contract).


### Q-04 The card ends up exactly matching your library

After a write, every file on the card is exactly what your library says it
should be, converted where the Rample needs it, and the Rample's own
settings folder is untouched. The full-pipeline validation checks this
byte for byte before every release.

**Concepts:** [The card and a write](domain-model.md#the-card-and-a-write), [Stereo](domain-model.md#stereo), [Sample](domain-model.md#sample).


### Q-05 Releases are signed and install cleanly everywhere Romper runs

Every release is signed, so your operating system trusts it, is built for
each supported platform, and is made from up-to-date, secure parts.

**Concepts:** none in the [domain model](domain-model.md); this quality is about how Romper is built and shipped.


### Q-06 Romper works with a keyboard and assistive technology

Everything you can do with a mouse you can do with a keyboard, and screen
readers can name every control.

**Concepts:** none in the [domain model](domain-model.md); this quality is about the interface, not stored data.


### Q-07 Every change is tested before it reaches you

A change is merged only after its tests pass on every platform, and those
tests check what you'd notice, not just the code's internals.

**Concepts:** [Use cases, qualities and issues](domain-model.md#use-cases-qualities-and-issues), [The IPC contract](domain-model.md#the-ipc-contract).

### Q-08 Romper supports or mirrors the Rample's features

What you can do on the Rample, Romper either prepares for it (writes what
the Rample reads from the card), mirrors so you can preview it on your
computer (like the step sequencer's slicer), or documents. Each Rample
feature is traced to the use cases that cover it, from the
[Rample manual](https://squarp.net/rample/manual/); features Romper doesn't
touch are candidates for the backlog.

**Concepts:** [Use cases, qualities and issues](domain-model.md#use-cases-qualities-and-issues), [Rample manual coverage](domain-model.md#rample-manual-coverage).


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

