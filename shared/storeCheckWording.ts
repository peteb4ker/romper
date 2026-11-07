// What the store check found, in words (#824, stage 3 of
// docs/developer/store-check.md). One module for every string the badge,
// the status bar item, the one-time message and the "Library check" dialog
// show. The wording is the maintainer's, approved on #824 (2026-10-30)
// as written in the spec's "Wording" section. The singular forms ("1 sample
// file not found") are the same words with the number agreeing; they're
// listed in the PR for sign-off.
import type { StoreCheckKitFinding } from "./electronApi.js";

import { compareKitSlots } from "./kitUtilsShared.js";
import { trimTrailing } from "./trimTrailing.js";

/** One drive that isn't connected, with what wasn't checked on it */
export interface DriveNotConnected {
  /** Kits with samples on it */
  kits: number;
  samples: number;
  volume: string;
}

/** What the notice shows: the kits to look at and the drives involved */
export interface StoreCheckSummary {
  /** Kits with a badge, in slot order */
  attention: StoreCheckKitFinding[];
  /** Drives that aren't connected, with the samples that weren't checked */
  notConnected: DriveNotConnected[];
  /** Drives that didn't respond */
  notResponding: string[];
}

/** The details dialog's title */
export const LIBRARY_CHECK_TITLE = "Library check";

/** The dialog's headings over the kits, by what is wrong (approved 2026-10-31) */
export const LIBRARY_CHECK_HEADINGS = {
  missing: "Sample files not found",
  untracked: "Files not in the kit",
} as const;

/** What the dialog says when nothing is left to list (approved 2026-10-31) */
export const LIBRARY_CHECK_EMPTY = "No problems found.";

/** The fix button that rescans a kit (approved on #824, 2026-10-30) */
export const SCAN_KIT_LABEL = "Scan kit";

/**
 * The fix button that removes a kit's missing samples, and the button in
 * its popover that confirms it (approved on #824, 2026-10-30)
 */
export const REMOVE_MISSING_SAMPLES_LABEL = "Remove missing samples";

/** The fix button that searches for a kit's missing files (approved on #824, 2026-10-30) */
export const FIND_MISSING_FILES_LABEL = "Find missing files…";

/** The restore button for a sample whose old place is in the store (approved on #824, 2026-10-30) */
export const COPY_BACK_LABEL = "Copy back";

/** The restore button for a sample whose old place is outside the store (approved on #824, 2026-10-30, D2) */
export const USE_THIS_FILE_LABEL = "Use this file";

/** The undo of a copy that changed since Romper made it (approved on #824, 2026-10-30) */
export function describeCopyChanged(fileName: string): string {
  return `${fileName} has changed since Romper copied it, so it wasn't removed.`;
}

/** The drive's name for people: "Samples SSD" for `/Volumes/Samples SSD` */
export function describeDrive(volume: string): string {
  const trimmed = trimTrailing(volume, String.raw`\/`);
  const name = trimmed.split(/[\\/]/).at(-1);
  return name || volume;
}

export function describeDriveNotConnected({
  kits,
  samples,
  volume,
}: DriveNotConnected): string {
  const was = samples === 1 ? "wasn't" : "weren't";
  return `The drive "${describeDrive(volume)}" isn't connected, so ${samples} ${samples === 1 ? "sample" : "samples"} in ${kits} ${kits === 1 ? "kit" : "kits"} ${was} checked.`;
}

export function describeDriveNotResponding(volume: string): string {
  return `The drive "${describeDrive(volume)}" didn't respond, so some samples weren't checked.`;
}

/**
 * The find button's accessible name: its label with the kit, as "Scan kit
 * A3" is (approved on #821, 2026-10-31)
 */
export function describeFindMissingFilesButton(kitName: string): string {
  return `${FIND_MISSING_FILES_LABEL} ${kitName}`;
}

/** A read-only kit whose folder is gone from the store */
export function describeFolderMissing(kitName: string): string {
  return `${kitName}'s folder is missing from your library.`;
}

/** One file found that matches (approved on #824, 2026-10-30) */
export function describeFoundFile(fileName: string, where: string): string {
  return `Found ${fileName} in ${where}.`;
}

/**
 * PROPOSED, awaiting sign-off (#823): the only file found has the missing
 * file's name but not its size or format (D3's possible match)
 */
export function describeFoundPossibleFile(
  fileName: string,
  where: string,
): string {
  return `Found a file named ${fileName} in ${where}, but its size or format is different.`;
}

/** Several files found, for the user to choose (approved on #824, 2026-10-30) */
export function describeFoundSeveralFiles(
  count: number,
  fileName: string,
): string {
  return `Found ${count} files named ${fileName}. Choose one.`;
}

/**
 * The badge's accessible name and tooltip: what's wrong and how many. Null
 * for a kit with nothing to badge. A file that can't be read isn't here: it
 * quarantines the kit, which has its own icon.
 */
export function describeKitBadge(finding: StoreCheckKitFinding): null | string {
  const untracked = finding.untracked.length;
  if (finding.missing > 0 && untracked > 0) {
    const files = untracked === 1 ? "file" : "files";
    const are = untracked === 1 ? "isn't" : "aren't";
    return `${describeMissingFiles(finding.missing)}; ${untracked} ${files} in the folder ${are} in the kit`;
  }
  if (finding.missing > 0) return describeMissingFiles(finding.missing);
  if (untracked > 0) return describeUntrackedFiles(untracked);
  if (finding.folderMissing) return describeFolderMissing(finding.kitName);
  return null;
}

/** PROPOSED, awaiting sign-off (#823): marks a possible match in a list of choices */
export const POSSIBLE_MATCH_NOTE = "Different size or format";

/** The status bar item */
export function describeKitsNeedAttention(kits: number): string {
  return kits === 1 ? "1 kit needs attention" : `${kits} kits need attention`;
}

/** Sample files the kit's rows point at that aren't there */
export function describeMissingFiles(count: number): string {
  return `${count} sample ${count === 1 ? "file" : "files"} not found`;
}

/** The message shown once when a pass finds missing files it hadn't */
export function describeNewMissingFiles(kits: number): string {
  return `Romper found missing sample files in ${kits} ${kits === 1 ? "kit" : "kits"}. Open the list from the status bar.`;
}

/** Nothing found for a missing file (approved on #824, 2026-10-30) */
export function describeNotFound(fileName: string, folderName: string): string {
  return `No copy of ${fileName} found in ${folderName}.`;
}

/**
 * The removal as undo names it, the popover's words without the question:
 * "Couldn't undo: remove 2 missing samples from A3. ..." when undo fails
 */
export function describeRemovedMissingSamples(
  count: number,
  kitName: string,
): string {
  return `Remove ${count} missing ${count === 1 ? "sample" : "samples"} from ${kitName}`;
}

/**
 * The remove popover's question (approved on #824, 2026-10-30; the
 * singular in the same style, 2026-10-31), with what the next write does
 * (approved on #822, 2026-11-06)
 */
export function describeRemoveMissingSamples(
  count: number,
  kitName: string,
): string {
  return count === 1
    ? `Remove 1 missing sample from ${kitName}? You can undo this. Your next write also removes it from the card.`
    : `Remove ${count} missing samples from ${kitName}? You can undo this. Your next write also removes them from the card.`;
}

/**
 * The remove button's accessible name: its label with the kit, as "Scan
 * kit A3" is (approved on #821, 2026-10-31)
 */
export function describeRemoveMissingSamplesButton(kitName: string): string {
  return `${REMOVE_MISSING_SAMPLES_LABEL} ${kitName}`;
}

/**
 * The restore as undo names it: its button's words with the file.
 * PROPOSED, awaiting sign-off (#823): "Couldn't undo: copy back kick.wav.
 * Check the kit, then try again." when undo fails.
 */
export function describeRestoredMissingFile(
  kind: "copy" | "repoint",
  fileName: string,
): string {
  return kind === "copy"
    ? `Copy back ${fileName}`
    : `Use this file for ${fileName}`;
}

/**
 * The scan button's accessible name: its label with the kit, so each
 * button in a list says which kit it scans (Q-06). The label stays in it.
 */
export function describeScanKit(kitName: string): string {
  return `${SCAN_KIT_LABEL} ${kitName}`;
}

/**
 * The folder dialog's prompt (approved on #824, 2026-10-30, for one
 * file). PROPOSED, awaiting sign-off (#823): the prompt for several.
 */
export function describeSearchFolderPrompt(fileNames: string[]): string {
  return fileNames.length === 1
    ? `Choose a folder to search for ${fileNames[0]}`
    : `Choose a folder to search for ${fileNames.length} missing files`;
}

/**
 * PROPOSED, awaiting sign-off (#823): the search didn't look everywhere,
 * because it reached its limits or a drive didn't respond
 */
export function describeSearchIncomplete(
  reason: "limit" | "notResponding",
  folderName: string,
): string {
  return reason === "limit"
    ? `${folderName} has too many files to search them all. Choose a folder inside it.`
    : "A drive didn't respond, so some folders weren't searched.";
}

/**
 * The status bar item's text, or null while there is nothing to show: the
 * kit count when kits need attention, else the drive's state (approved
 * 2026-10-31)
 */
export function describeStatusBarItem(
  summary: StoreCheckSummary,
): null | string {
  if (summary.attention.length > 0) {
    return describeKitsNeedAttention(summary.attention.length);
  }
  if (summary.notConnected.length > 0) return "Drive not connected";
  if (summary.notResponding.length > 0) return "Drive not responding";
  return null;
}

/** Voice-prefixed WAVs in a read-only kit's folder that the kit doesn't hold */
export function describeUntrackedFiles(count: number): string {
  return count === 1
    ? "1 file in this kit's folder isn't in the kit. Scan the kit to add it."
    : `${count} files in this kit's folder aren't in the kit. Scan the kit to add them.`;
}

/** Whether the kit has a badge, and so counts as needing attention */
export function hasKitBadge(finding: StoreCheckKitFinding): boolean {
  return describeKitBadge(finding) !== null;
}

/** Sort and total the kits' findings for the notice */
export function summarizeStoreCheck(
  findings: Iterable<StoreCheckKitFinding>,
): StoreCheckSummary {
  const attention: StoreCheckKitFinding[] = [];
  const notConnected = new Map<string, DriveNotConnected>();
  const notResponding = new Set<string>();
  for (const finding of findings) {
    if (hasKitBadge(finding)) attention.push(finding);
    for (const { samples, volume } of finding.notConnected) {
      if (samples === 0) continue;
      const drive = notConnected.get(volume) ?? { kits: 0, samples: 0, volume };
      drive.kits++;
      drive.samples += samples;
      notConnected.set(volume, drive);
    }
    for (const volume of finding.notResponding) notResponding.add(volume);
  }
  attention.sort((a, b) => compareKitSlots(a.kitName, b.kitName));
  return {
    attention,
    notConnected: [...notConnected.values()].sort((a, b) =>
      a.volume.localeCompare(b.volume),
    ),
    notResponding: [...notResponding].sort((a, b) => a.localeCompare(b)),
  };
}
