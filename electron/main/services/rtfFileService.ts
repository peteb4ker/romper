import type { Bank } from "@romper/shared/db/schema.js";

import {
  isBankLetter,
  parseBankNameFile,
} from "@romper/shared/rampleCardLayout.js";
import * as fs from "node:fs";
import * as path from "node:path";

import { withCardWatchdog } from "./cardWatchdog.js";

// The bank letter rule lives with the card layout (#573); update-bank checks
// it through this module
export { isBankLetter } from "@romper/shared/rampleCardLayout.js";

/** A bank letter: one capital, A to Z. */

/**
 * Characters a bank name can't hold, because it becomes a file name on the
 * local store and on a FAT32 card: path separators and the characters
 * Windows and FAT reserve. Control characters are refused too.
 */
const RESERVED_NAME_CHARACTERS = /["*/:<>?\\|]/;

/**
 * A bank name file change made by {@link RtfFileService.stageRtfFile} but
 * not yet kept.
 */
export interface StagedRtfFile {
  /** Keep the change: delete the files it replaced. */
  commit(): void;
  /** Undo the change: remove the new file and put back the ones it replaced. */
  rollback(): void;
}

/**
 * Service for managing the bank name files: empty RTF files named
 * `{Letter} - {Artist}.rtf` at the SD card root, one per named bank.
 * Romper writes them because the factory archive has them, and reads them
 * only when setup imports a card or the archive (#564, #567); the names'
 * owner is `banks.artist`. The Rample manual doesn't mention them, so
 * whether the module reads or shows them is unverified on hardware.
 *
 * The card-side methods (`writeAllBankRtfFiles`, `writeRtfFile`,
 * `removeRtfFile`) are asynchronous, each card operation under the card
 * watchdog (#656). `stageRtfFile` works on the local store, never the card,
 * and stays synchronous so a bank's name and its file still change
 * together or not at all (#567).
 */
class RtfFileService {
  /**
   * Remove any name file of a bank letter from the card root: files
   * matching `{Letter} - *.rtf`. Each card operation is asynchronous and
   * under the card watchdog (#656).
   */
  async removeRtfFile(dirPath: string, bankLetter: string): Promise<void> {
    requireBankLetter(bankLetter);
    const files = await withCardWatchdog(fs.promises.readdir(dirPath));
    for (const file of files) {
      if (isRtfFileForBank(file, bankLetter)) {
        // One at a time, so the watchdog times each removal (#656)
        await withCardWatchdog(fs.promises.unlink(path.join(dirPath, file))); // NOSONAR: sequential on purpose (#656)
      }
    }
  }

  /**
   * Set a bank's name file in `dirPath` to `artistName`, or remove it when
   * `artistName` is null, in a way that can still be undone (#567). The
   * files it replaces are moved aside rather than deleted: `commit` deletes
   * them, `rollback` removes the new file and puts them back. If staging
   * fails, it undoes what it did before throwing, so the folder is as it
   * was.
   */
  stageRtfFile(
    dirPath: string,
    bankLetter: string,
    artistName: null | string,
  ): StagedRtfFile {
    requireBankLetter(bankLetter);
    if (artistName !== null) {
      const nameError = bankNameError(artistName);
      if (nameError) throw new Error(nameError);
    }

    const replaced: { aside: string; original: string }[] = [];
    let written: null | string = null;
    const rollback = () => {
      const failures: unknown[] = [];
      const file = written;
      if (file) attempt(failures, () => fs.rmSync(file, { force: true }));
      for (const { aside, original } of [...replaced].reverse()) {
        attempt(failures, () => fs.renameSync(aside, original));
      }
      if (failures.length > 0) throw failures[0];
    };

    try {
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        if (!entry.isFile() || !isRtfFileForBank(entry.name, bankLetter)) {
          continue;
        }
        const original = path.join(dirPath, entry.name);
        const aside = path.join(dirPath, `.${entry.name}.replaced`);
        fs.renameSync(original, aside);
        replaced.push({ aside, original });
      }
      if (artistName !== null) {
        written = path.join(dirPath, bankRtfFileName(bankLetter, artistName));
        fs.writeFileSync(written, String.raw`{\rtf1}`, "utf-8");
      }
    } catch (error) {
      rollback();
      throw error;
    }

    return {
      commit: () => {
        for (const { aside } of replaced) fs.rmSync(aside, { force: true });
      },
      rollback,
    };
  }

  /**
   * Write the name file of every named bank to the card root (`dirPath`),
   * during a write. Only writes files for banks whose name can be a file
   * name; the write summary warns about the others.
   *
   * Every card operation is asynchronous and under the card watchdog
   * (#656): the card's driver can stop responding, and a synchronous call
   * would then block the main process and freeze the window. A card that
   * stops responding fails the write with the watchdog's message instead.
   */
  async writeAllBankRtfFiles(dirPath: string, banks: Bank[]): Promise<number> {
    let written = 0;
    for (const bank of banks) {
      if (bank.artist && isWritableBankName(bank.artist)) {
        await this.writeRtfFile(dirPath, bank.letter, bank.artist); // NOSONAR: sequential on purpose (#656)
        written++;
      }
    }
    return written;
  }

  /**
   * Write a bank's name file, `{Letter} - {Artist}.rtf` with minimal RTF
   * content, to the card root, replacing any name file the letter had.
   * Each card operation is asynchronous and under the card watchdog
   * (#656).
   */
  async writeRtfFile(
    dirPath: string,
    bankLetter: string,
    artistName: string,
  ): Promise<void> {
    requireBankLetter(bankLetter);
    const nameError = bankNameError(artistName);
    if (nameError) throw new Error(nameError);

    // Remove any existing RTF file for this bank letter
    await this.removeRtfFile(dirPath, bankLetter);

    const filePath = path.join(
      dirPath,
      bankRtfFileName(bankLetter, artistName),
    );
    await withCardWatchdog(
      fs.promises.writeFile(filePath, String.raw`{\rtf1}`, "utf-8"),
    );
  }
}

/**
 * Why `name` can't be a bank name, or null when it can. The name becomes
 * the file name `{Letter} - {Name}.rtf`, so anything that would change the
 * folder it lands in (`/`, `..` after a separator) or that a card can't
 * store is refused (RE-23).
 */
export function bankNameError(name: string): null | string {
  if (name.trim() === "") return "A bank name can't be blank";
  if (RESERVED_NAME_CHARACTERS.test(name) || hasControlCharacter(name)) {
    return String.raw`A bank name can't contain / \ : * ? " < > | or control characters`;
  }
  return null;
}

/** A bank's name file on the card: `{Letter} - {Artist}.rtf`. */
export function bankRtfFileName(
  bankLetter: string,
  artistName: string,
): string {
  return `${bankLetter} - ${artistName}.rtf`;
}

/** True when a stored bank name can be written as a file. */
export function isWritableBankName(name: null | string | undefined): boolean {
  return typeof name === "string" && bankNameError(name) === null;
}

/** Run one undo step, collecting its failure so the others still run. */
function attempt(failures: unknown[], step: () => void): void {
  try {
    step();
  } catch (error) {
    failures.push(error);
  }
}

function hasControlCharacter(name: string): boolean {
  return [...name].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
}

/**
 * True for a bank name file of `bankLetter` (`{Letter} - {Name}.rtf`, the
 * letter in either case), by the one pattern every reader uses
 * (`parseBankNameFile`).
 */
function isRtfFileForBank(fileName: string, bankLetter: string): boolean {
  return parseBankNameFile(fileName)?.letter === bankLetter;
}

function requireBankLetter(bankLetter: string): void {
  if (!isBankLetter(bankLetter)) {
    throw new Error(`Invalid bank letter: ${JSON.stringify(bankLetter)}`);
  }
}

export const rtfFileService = new RtfFileService();
