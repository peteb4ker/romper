import type { Bank } from "@romper/shared/db/schema.js";

import { parseBankNameFile } from "@romper/shared/rampleCardLayout.js";
import * as fs from "node:fs";
import * as path from "node:path";

/** A bank letter: one capital, A to Z. */
const BANK_LETTER_PATTERN = /^[A-Z]$/;

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
 */
class RtfFileService {
  /**
   * Remove any existing RTF file for a bank letter in a directory.
   * Finds and removes files matching `{Letter} - *.rtf`.
   */
  removeRtfFile(dirPath: string, bankLetter: string): void {
    requireBankLetter(bankLetter);
    for (const file of fs.readdirSync(dirPath)) {
      if (isRtfFileForBank(file, bankLetter)) {
        fs.unlinkSync(path.join(dirPath, file));
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
   * Write all bank RTF files to a directory (used during SD card sync).
   * Only writes files for banks whose name can be a file name; the sync
   * summary warns about the others.
   */
  writeAllBankRtfFiles(dirPath: string, banks: Bank[]): number {
    let written = 0;
    for (const bank of banks) {
      if (bank.artist && isWritableBankName(bank.artist)) {
        this.writeRtfFile(dirPath, bank.letter, bank.artist);
        written++;
      }
    }
    return written;
  }

  /**
   * Write an RTF file for a bank letter with a given artist name.
   * First removes any existing RTF file for that bank letter,
   * then creates `{Letter} - {Artist}.rtf` with minimal RTF content.
   */
  writeRtfFile(dirPath: string, bankLetter: string, artistName: string): void {
    requireBankLetter(bankLetter);
    const nameError = bankNameError(artistName);
    if (nameError) throw new Error(nameError);

    // Remove any existing RTF file for this bank letter
    this.removeRtfFile(dirPath, bankLetter);

    const filePath = path.join(
      dirPath,
      bankRtfFileName(bankLetter, artistName),
    );
    fs.writeFileSync(filePath, String.raw`{\rtf1}`, "utf-8");
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

/** True for a bank letter Romper accepts: one capital, A to Z. */
export function isBankLetter(value: unknown): value is string {
  return typeof value === "string" && BANK_LETTER_PATTERN.test(value);
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
