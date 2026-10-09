// The SD card layout the Rample firmware reads (RE-06). Sync, the setup
// wizard's import and rescan all name and parse card files here.
//
//   <card>/<kit>/<voice>-<slot> <name>.wav     e.g. A0/1-01 KICK LOW.wav
//   <card>/<letter> - <bank name>.rtf          e.g. A - ALWIS.rtf
//   <card>/_save/                               the device's own settings
//
// Kit folders sit at the card root. WAV files sit directly in the kit
// folder; the first character of the name is the voice (1-4), and the
// firmware orders a voice's layers by sorting the names. See
// docs/developer/sd-card-layout.md.

import { trimTrailing } from "./trimTrailing.js";

/**
 * The folder at the card root where the Rample keeps what you set on the
 * device: STORE writes a kit's settings to `_save/<kit>.rpl`, SAVE SETTINGS
 * the device settings (docs/developer/rample-save-integration.md). The
 * device owns it: nothing Romper writes to a card may remove or write
 * anything at or under it, whatever the kit and bank patterns match (#787,
 * Q-04). Compare names with {@link isDeviceSaveFolderName}.
 */
export const DEVICE_SAVE_FOLDER = "_save";

/** Longest file name sync writes, extension included. */
export const MAX_CARD_FILE_NAME_LENGTH = 64;

const WAV_EXTENSION = /\.wav$/i;

// Kit names and bank letters (#573). The Rample manual (How to make your own
// sample kits) names a kit folder by its bank, a letter "from A to Z", and a
// number "from 0 to 99". Romper stores both in upper case. On the card, names
// are compared ignoring case, as FAT32 compares them: a folder named `a5` is
// kit A5's folder, so setup imports it as A5 and a write keeps it as A5's.
// Setup, the write's stale-entry check and every kit or bank check use these.

/** A bank letter as Romper stores it: one capital, A to Z. */
const BANK_LETTER_PATTERN = /^[A-Z]$/;

/** A kit name as Romper stores it: a bank letter and a number, A0 to Z99. */
const KIT_NAME_PATTERN = /^[A-Z]\d{1,2}$/;

/**
 * A kit folder at the card root: a kit name, the letter in either case
 * (see {@link kitNameOfCardFolder}).
 */
export const KIT_FOLDER_PATTERN = /^[A-Z]\d{1,2}$/i;

/**
 * A bank name file at the card root: `<letter> - <name>.rtf`, the letter A
 * to Z in either case. The factory card has them; whether the Rample shows
 * them is unverified on hardware.
 */
export const BANK_NAME_FILE_PATTERN = /^([A-Z]) - (.+)\.rtf$/i;

// A leading voice digit, optionally with the "-NN" slot this module adds,
// then any separators: "1 KICK", "1_KICK", "1KICK", "1-01 KICK".
const VOICE_PREFIX = /^[1-4](?:-\d{2}(?=[ ._-]|$))?[ ._-]*/;

// Characters FAT32 file names can't contain, plus control characters.
const FAT_FORBIDDEN = /[\u0000-\u001f"*/:<>?\\|]/g;

/**
 * The kit folders among the names at a card's root, in the order given,
 * each with the kit it holds (see {@link kitNameOfCardFolder}). Setup copies
 * and imports these, so it takes every folder a write treats as a kit's. One
 * folder per kit: should two names hold one kit, which only a
 * case-sensitive file system allows, the upper-case one is taken.
 */
export function cardKitFolders(
  names: readonly string[],
): { folder: string; kitName: string }[] {
  const byKit = new Map<string, string>();
  for (const folder of names) {
    const kitName = kitNameOfCardFolder(folder);
    if (kitName && (!byKit.has(kitName) || folder === kitName)) {
      byKit.set(kitName, folder);
    }
  }
  return [...byKit].map(([kitName, folder]) => ({ folder, kitName }));
}

/**
 * The name sync gives a sample on the card: `<voice>-<slot> <name>.wav`.
 *
 * - `voiceNumber` is 1-4 and comes first, so the firmware assigns the voice.
 * - `slotNumber` is the 0-based slot in the database; it is written 1-based
 *   and zero-padded (01-12) so the firmware's sort keeps Romper's layer
 *   order whether it sorts naturally or by character.
 * - `originalFileName` supplies the readable part. A leading voice prefix is
 *   dropped (so a re-imported card file isn't prefixed twice), characters
 *   FAT32 forbids become `_`, and the whole name is kept to
 *   {@link MAX_CARD_FILE_NAME_LENGTH} characters.
 */
export function cardSampleFileName(
  voiceNumber: number,
  slotNumber: number,
  originalFileName: string,
): string {
  if (!Number.isInteger(voiceNumber) || voiceNumber < 1 || voiceNumber > 4) {
    throw new Error(`Voice must be 1 to 4, got ${voiceNumber}`);
  }
  if (!Number.isInteger(slotNumber) || slotNumber < 0 || slotNumber > 98) {
    throw new Error(`Slot must be 0 to 98, got ${slotNumber}`);
  }

  const prefix = `${voiceNumber}-${String(slotNumber + 1).padStart(2, "0")}`;
  const extension = ".wav";
  const room = MAX_CARD_FILE_NAME_LENGTH - prefix.length - 1 - extension.length;

  const name = trimName(
    trimName(
      originalFileName
        .replace(WAV_EXTENSION, "")
        .replace(VOICE_PREFIX, "")
        .replaceAll(FAT_FORBIDDEN, "_"),
    ).slice(0, room),
  );

  return name ? `${prefix} ${name}${extension}` : `${prefix}${extension}`;
}

/** True for a bank letter as Romper stores it: one capital, A to Z. */
export function isBankLetter(value: unknown): value is string {
  return typeof value === "string" && BANK_LETTER_PATTERN.test(value);
}

/**
 * True when a name at the card root is the device's save folder
 * ({@link DEVICE_SAVE_FOLDER}). Case is ignored, as FAT32 ignores it, and so
 * are trailing spaces and dots, which Windows drops from a path (`_SAVE.`
 * opens `_save` there).
 */
export function isDeviceSaveFolderName(name: string): boolean {
  return trimTrailing(name, " .").toLowerCase() === DEVICE_SAVE_FOLDER;
}

/** True for a kit name as Romper stores it: A0 to Z99, the letter a capital. */
export function isKitName(value: unknown): value is string {
  return typeof value === "string" && KIT_NAME_PATTERN.test(value);
}

/**
 * The kit a folder at the card root holds, by the name Romper stores it
 * under (`a5` holds kit A5), or null when the folder isn't a kit folder
 * (see {@link KIT_FOLDER_PATTERN}).
 */
export function kitNameOfCardFolder(folderName: string): null | string {
  return KIT_FOLDER_PATTERN.test(folderName) ? folderName.toUpperCase() : null;
}

/**
 * The bank letter (upper case) and name a bank name file holds, or null when
 * `fileName` isn't one (see {@link BANK_NAME_FILE_PATTERN}).
 */
export function parseBankNameFile(
  fileName: string,
): { letter: string; name: string } | null {
  const match = BANK_NAME_FILE_PATTERN.exec(fileName);
  return match ? { letter: match[1].toUpperCase(), name: match[2] } : null;
}

/**
 * The voice (1-4) the firmware assigns a file in a kit folder, from the
 * first character of its name, or null if it doesn't start with 1-4.
 */
export function voiceOfCardFile(fileName: string): null | number {
  const first = fileName.charAt(0);
  return first >= "1" && first <= "4" ? Number(first) : null;
}

/** Strip leading and trailing spaces and dots, which FAT32 rejects or drops. */
function trimName(name: string): string {
  return trimTrailing(name.replace(/^[ .]+/, ""), " .");
}
