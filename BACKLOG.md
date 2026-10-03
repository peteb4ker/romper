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
  merges, move the row to Done with the PR number, and remove the item from
  every use case or quality that lists it in
  [`use-cases.md`](docs/developer/use-cases.md). Keep one row per item so
  concurrent PRs only conflict on the lines they touch.
- **New findings:** add them to the register with the next free `RE-` ID,
  then add a row here, and list it under the **Known issues:** of the use
  case or quality it affects.
- **One-liners say what a user would notice**, in plain words with no code;
  the technical detail lives in the register. They appear on the website's
  testing page. `npm run trace:check` fails on an open item no use case or
  quality lists, and on code in a one-liner.

## Now

| ID | Severity | Area | Item | Status |
|---|---|---|---|---|

## Next

| ID | Severity | Area | Item | Status |
|---|---|---|---|---|
| RE-67 | Medium | Tests | The tests didn't check Romper's main promise for real: that real and stereo audio reach the card intact, byte for byte, with no unexpected error along the way. | partly done (#402: `npm run validate:full` and its workflow; #411: the e2e error guard; #415: the use case register, `[UC-NN]` tags and `npm run trace:check`; next: the focused tests and the gaps in the traceability matrix (`npm run trace`); plan: [`validation-and-traceability.md`](docs/developer/validation-and-traceability.md)) |
| RE-18 | High | Release | Windows releases can ship without a code signature, so Windows warns you when you install them. | partly done (#387: signing required, Apple credentials checked first; Windows needs ALLOW_UNSIGNED_WINDOWS until OPS-2) |

## Owner (needs Pete)

| ID | Item | Status |
|---|---|---|
| OPS-1 | Require the end-to-end tests to pass before any change is merged, for everyone including admins, and keep the history linear. | open |
| OPS-2 | Set up code signing for Windows releases, so Windows trusts the installer. | open |
| OPS-3 | Delete three old Apple signing secrets that nothing uses any more. | open |

## Later

| ID | Severity | Area | Item | Status |
|---|---|---|---|---|
| RE-22 | Medium | IPC | Editing a kit's details could change other parts of the kit's record by mistake. | open |
| RE-25 | Medium | Validation | Out-of-range volume, gain, tempo or sample mode values aren't rejected, so a glitch could save a value the Rample can't use. | open |
| RE-26 | Medium | Samples | Replacing a sample can lose the original if something fails partway, and the new sample loses the old one's gain. | open |
| RE-27 | Medium | Samples | Moving a sample to another kit can fail partway, and the moved sample loses its gain and audio details. | open |
| RE-28 | Medium | DB | Some changes are saved in several steps (creating a kit, deleting a sample, scanning), so a failure partway can leave a kit half-updated. | open |
| RE-33 | Medium | DB | Upgrading an older library relies on a repair step that could leave it half-upgraded if interrupted. | open (#407 fixed the `kits.artist` snapshot drift) |
| RE-36 | Medium | Performance | Almost every edit reloads your whole library behind the scenes, which gets slower as the library grows. | open |
| RE-46 | Medium | Performance | While a sample plays, its waveform does far more drawing work than it needs, which can make playback stutter on slower machines. | open |
| RE-47 | Medium | Performance | The kit browser redraws far more than it needs to when you type, scroll or get a message. | open |
| RE-48 | Medium | Accessibility | Parts of Romper can't be used with only a keyboard or a screen reader: the gain knob, trigger conditions (right-click only), several unlabelled fields, and dialogs. | open |
| RE-49 | Medium | Dependencies | The installed app carries build tools and unused packages it doesn't need, making it bigger than necessary. | open |
| RE-50 | Medium | CI | A change that lowers test coverage isn't caught before it's merged, and coverage is only just above its minimum. | partly done (#352 runs coverage on PRs; the margin is still thin) |
| RE-51 | Medium | Tests | Mistakes in test code aren't caught by type checking, so a broken test can pass without testing anything. | open |
| RE-52 | Medium | CI | End-to-end tests don't have to pass before a change is merged, and pull requests run them on Linux only. | blocked on OPS-1 (make e2e a required check) |
| RE-53 | Medium | CI | Code-quality findings don't stop a change from being merged. | partly done (#352 analyzes PRs; not a required check) |
| RE-54 | Medium | Dependencies | Many of the libraries Romper is built on are a major version behind, including packaging tools with known security advisories. | open |
| RE-55 | Medium | Release | There's no build for Intel Macs, ARM Windows or ARM Linux. | open |
| RE-56 | Medium | Dead code | Unused code remains in Romper, which makes it harder to change safely. | partly done (#372 deletes `rampleNamingService` and `stereoSyncProcessor`) |
| RE-57 | Medium | Contract | The app's two halves can disagree about the data they exchange without any check catching it, which can hide bugs. | open |
| RE-78 | Medium | Settings | Choosing an invalid folder for your local store in Preferences fails without telling you. | partly done (#419: the Invalid Local Store and Change Local Store dialogs report a failed save; Set Up a New Local Store renders; Preferences still ignores an invalid folder) |
| RE-79 | Medium | Release | Once Windows signing is turned on, the installed app itself may still be unsigned (unconfirmed). | open (before OPS-2) |
| RE-81 | Medium | DB | Every save opens and closes the library's database, which is slower than needed and stops related changes from being saved together. | open (plan: [`architecture-review.md`](docs/developer/architecture-review.md)) |
| RE-82 | Medium | Sync | Romper freezes briefly while it prepares a write to the card, longer for big libraries. | open (plan: [`architecture-review.md`](docs/developer/architecture-review.md)) |
| RE-83 | Medium | Audio | Moving between kits reloads every sample's audio from disk, some of it twice, on every visit. | open (plan: [`architecture-review.md`](docs/developer/architecture-review.md)) |
| RE-84 | Medium | IPC | The app's interface can still reach file-access features it no longer uses. | open (plan: [`architecture-review.md`](docs/developer/architecture-review.md)) |
| RE-85 | Medium | Security | Checking whether Romper may open a file gets slower the longer you use it. | open (plan: [`architecture-review.md`](docs/developer/architecture-review.md)) |
| RE-86 | Medium | Undo | Undoing a delete, replace or move resets the sample's gain, and can stop partway if something fails. | open (plan: [`architecture-review.md`](docs/developer/architecture-review.md)) |
| RE-87 | Medium | Playback | Every sample trigger redraws the whole kit editor, which wastes work while the sequencer plays. | open (plan: [`architecture-review.md`](docs/developer/architecture-review.md)) |
| RE-88 | Medium | Samples | Turning the gain knob saves to your library on every tiny movement instead of once when you let go. | open (plan: [`architecture-review.md`](docs/developer/architecture-review.md)) |
| RE-89 | Medium | Samples | Samples you drop in are stored without their audio format details, unlike samples found by a scan. | open (plan: [`architecture-review.md`](docs/developer/architecture-review.md)) |

## Done

| ID | Severity | Area | Item | Status |
|---|---|---|---|---|
| RE-77 | Medium | Setup | If the factory download is corrupted, Romper downloads it three times and then reports a generic network error instead of the real reason. | done (#PRNUM: only a dropped, stalled or cut-short download is retried; a checksum mismatch, a damaged archive or a full disk shows its own reason at once) |
| RE-35 | Medium | Sync | Changing a sample's gain, a voice name or a bank name doesn't mark the kit as changed, so the "modified since last write" filter misses it. | done (#360: scan sets it when it adds samples; #407: stereo link changes set it; #498: gain, voice name and bank name edits, and new and duplicated kits, set it; a write clears it on every kit it brought in line) |
| RE-45 | Medium | Playback | Two samples with the same file name in one voice play together, and same-named samples in different voices share a gain setting on screen. | done (#497: each sample plays, shows as playing and keeps its gain on its own, whatever its file name) |
| RE-38 | Medium | Renderer | Pressing F both jumps to bank F and stars the selected kit. | done (#494: letters only jump to banks, `*` bookmarks, and Cmd, Ctrl and Alt combinations are left to the menu) |
| RE-39 | Medium | Renderer | Arrow keys and Enter don't work in the kit grid until you click a kit. | done (#435: the arrows follow the rows the grid draws, and the focused card takes keyboard focus) |
| RE-37 | Medium | Renderer | A kit's favourite star can disagree between the browser and the editor, so a kit can show as a favourite when it isn't. | done (#431: one toggle path, and the kit list is the only favourite state) |
| RE-23 | Medium | Banks | Clearing a bank's name doesn't stick: the name comes back after a reload and is written to the card. | done (#434: clearing removes the name everywhere; main refuses names a card can't hold, with a message; a bank name file the card can't take stops the write with an error) |
| RE-43 | Medium | Scan | Scan All only scans the kits you're currently viewing after a search or filter, not your whole library. | done (#438: Scan All scans every kit in the store, from the browser or the editor) |
| RE-21 | Medium | Settings | Your theme and the "Confirm destructive actions" setting reset every time Romper started. | done (#433: every saved setting is loaded and kept; saves go through a temporary file) |
| RE-41 | Medium | Renderer | If turning on editing or renaming a kit fails, nothing tells you. | done (#436: a failed toggle or rename shows a message instead of an unhandled rejection) |
| RE-40 | Medium | Renderer | Some failures happen silently: a rejected drop, a failed stereo link or undo, and the reason a write failed aren't shown to you. | done (#436: one message names the files a drop didn't add and why; a refused link or unlink, a failed undo or redo, and a failed write each show a message) |
| RE-44 | Medium | Settings | The "Confirm destructive actions" setting does nothing: samples are deleted and replaced without asking. | done (#437: with the setting on, deleting a sample asks first) |
| RE-58 | Medium | Tooling | Romper's own pre-commit checks failed on a busy computer because they always started the same large number of test workers. | done (#423: workers follow the free cores; under load the suite runs on fewer workers instead of timing out) |
| RE-74 | Medium | Samples | Dropping a sample onto a filled slot said it would insert it there and shift the rest down, but added it at the end. | done (#421: dragging files over a voice highlights the slot after the last sample, where they land) |
| RE-75 | Medium | Voices | In an editable kit, scanning the kit overwrote voice names you'd typed. | done (#422: only voices without a name are named, as main's scan does) |
| RE-80 | Medium | Settings | A local store on a drive that wasn't connected when Romper started was forgotten, and the first-run setup opened. | done (#419: the saved path is kept; the Invalid Local Store dialog offers Try Again, another folder, or a new store) |
| RE-76 | Medium | Sync | A card that only needed files removed couldn't be written: Start Write was disabled when the library had no samples. | done (#418: the write is enabled whenever there is something to copy or remove) |
| RE-72 | Medium | About | The About dialog showed "Version: dev" instead of the real version. | done (#420: the renderer build defines it from package.json) |
| RE-71 | Medium | Stereo | You could link or unlink stereo voices in a kit that isn't editable, changing what the next write puts on the card. | done (#416: linking is an edit; read-only kits show the pair but offer no link or unlink, and main refuses the change) |
| RE-73 | Medium | Setup | Setting up from an SD card carried on silently after a kit failed to copy, importing whatever had been copied. | done (#414: a failed copy stops setup with the reason) |
| RE-66 | Medium | Setup | Cancelling setup on first launch quit partway through and left a half-built library that blocked trying again in the same folder. | done (#408 cleans up on quit; #414: Cancel stops the download, extraction or import, removes what setup wrote, and closes once it has stopped) |
| RE-31 | Medium | Setup | A failed SD-card setup couldn't be retried: the folders it had copied were left behind and blocked the next attempt. | done (#414: cleanup removes the kit folders setup created, and only those, so nothing is overwritten) |
| RE-34 | Medium | Setup | Naming voices during setup did nothing, and setup was slower than it needed to be. | done (#413: setup imports kits in main with the rescan merge: samples, WAV metadata and voice names in one transaction per kit) |
| RE-32 | Medium | Kits | Setup could import folders that aren't valid kit names (such as Drum01), which Romper then refused to delete or duplicate. | done (#413: setup imports only folders named like kits, A0-Z99, the same rule `kitService` uses; `insert-kit` is gone) |
| RE-69 | High | Stereo | Unlinking a stereo pair did nothing when the voice held a stereo file. | done (#407: unlink only clears `voices.stereo_mode`; `samples.is_stereo` dropped; main refuses samples on the right-hand voice of a linked pair; proven by `npm run validate:full`) |
| RE-42 | Medium | Setup | After setup, the notice listing samples left out by the 12-per-voice limit never appeared. | done (#410) |
| Low | Low | Tests | Test and tooling hygiene: a test-mode banner could appear by mistake, screenshots could use the installed app's settings, and a test wrote into the source folder. | done (#409, plan item 7) |
| RE-24 | Medium | Archive | The factory download didn't check it had succeeded or was complete, never deleted its large zip file, and ignored errors while unpacking. | done (#405: fetch with an idle timeout, pinned SHA-256, zip deleted in `finally`, extraction fails on any write error) |
| RE-64 | High | Kits | A new, empty library couldn't create its first kit. | done (#401) |
| RE-65 | Medium | Undo | Edit > Undo and Edit > Redo in the menu did nothing; only the keyboard shortcuts worked. | done (#406) |
| RE-70 | Medium | Archive | Using the downloaded factory archive failed on Windows, and anywhere its path had a space in it. | done (#403) |
| RE-29 | High | Sync | A stereo sample on a mono voice was written to the card as stereo instead of being converted to mono. | done (#404: planned from the file's channel count and the voice's stereo setting; proven by `npm run validate:full`) |
| RE-68 | High | Tests | Running Romper's end-to-end tests reset the settings of the Romper installed on the same computer. | done (#400) |
| RE-15 | High | Platform | Romper ran on a version of Electron that no longer got security fixes. | done (#392: Electron 44, better-sqlite3 13) |
| RE-63 | Medium | Sync | Converting samples for the card truncated instead of rounding, adding avoidable noise and changing samples that didn't need changing. | done (#396) |
| RE-14 | High | Playback | Each play left audio connections behind, slowly using more memory and CPU. | done (#366 node leak; #397 one shared AudioContext) |
| RE-13 | High | Playback | After an edit, a voice could play two samples at once instead of cutting off the first. | done (#394) |
| RE-62 | Medium | Dependencies | Romper read WAV files with an abandoned library that has an open security report. | done (#395) |
| RE-20 | High | Docs | The docs promised an automatic backup before writing the card, which doesn't exist. | done (#393; no pre-sync backup: the local store is the master copy) |
| RE-61 | Medium | Sync | The write progress fell behind on large libraries and slowed the app down. | done (#391) |
| RE-19 | High | Release | Release signing secrets were exposed to more of the build than necessary. | done (#389) |
| RE-17 | High | Release | A release could be built without running the tests or checking that it came from the main branch. | done (#386) |
| RE-16 | High | Platform | Mac auto-update didn't work in installed builds. | done (#384) |
| RE-12 | High | Renderer | Any unexpected error left a blank window with no way to recover. | done (#383) |
| RE-11 | High | Renderer | Messages never appeared on screen. | done (#382) |
| RE-08 | High | Sync | Some valid WAV files were rejected or misread because Romper expected their header in one fixed layout. | done (#381) |
| RE-07 | High | Sync | Writing the card froze the app until it finished, so Cancel didn't work. | done (#379) |
| RE-05 | High | Sync | Writing the card never removed anything: deleted, moved or renamed samples and deleted kits stayed on the card. | done (#376; the card mirrors the store) |
| RE-06 | High | Sync | Kits written to the card used a folder layout that importing and scanning couldn't read back. | done (#372; spec: [`sd-card-layout.md`](docs/developer/sd-card-layout.md)) |
| RE-59 | High | Renderer | Pressing Escape on a sequencer step's options also closed the kit. | done (#371) |
| RE-60 | High | Undo | Sequencer edits couldn't be undone, and undo after a pattern edit undid a sample edit instead. | done (#371) |
| RE-03 | High | Security | Romper's interface could read, list and write files anywhere on your computer: far more access than it needs. | done (#367) |
| RE-04 | High | Scan | Scanning a kit that isn't editable, or Scan All, threw away the kit's sample settings and rebuilt them from its folder. | done (#360) |
| RE-09 | High | Sync | Problems found before writing the card, such as missing source files, were never shown. | done (#364) |
| RE-30 | Medium | Config | A setting meant for testing was honoured by some parts of the app and ignored by others. | done (#355) |
| RE-02 | High | Security | A safety check meant to stop the app's window navigating away never worked. | done (#358; the IPC sender check in #367) |
| RE-10 | High | Setup | If setup failed, its clean-up could delete a library database it hadn't created. | done (#359) |
| RE-01 | Critical | Sync | "Clear SD card before writing" deleted every file and folder at the chosen location. | done (#351) |
