// The SD card layout the Rample firmware reads (RE-06). Sync, the setup
// wizard's import and rescan all name and parse card files here.
//
//   <card>/<kit>/<voice>-<slot> <name>.wav     e.g. A0/1-01 KICK LOW.wav
//   <card>/<letter> - <bank name>.rtf          e.g. A - ALWIS.rtf
//
// Kit folders sit at the card root. WAV files sit directly in the kit
// folder; the first character of the name is the voice (1-4), and the
// firmware orders a voice's layers by sorting the names. See
// docs/developer/sd-card-layout.md.

import { trimTrailing } from "./trimTrailing.js";

/** Longest file name sync writes, extension included. */
export const MAX_CARD_FILE_NAME_LENGTH = 64;

const WAV_EXTENSION = /\.wav$/i;

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
