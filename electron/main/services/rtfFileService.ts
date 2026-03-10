import type { Bank } from "@romper/shared/db/schema.js";

import * as fs from "fs";
import * as path from "path";

/**
 * Service for managing RTF files that represent bank artist names.
 * The Rample hardware uses empty RTF files named `{Letter} - {Artist}.rtf`
 * at the SD card root to display bank/artist names.
 */
class RtfFileService {
  /**
   * Remove any existing RTF file for a bank letter in a directory.
   * Finds and removes files matching `{Letter} - *.rtf`.
   */
  removeRtfFile(dirPath: string, bankLetter: string): void {
    const files = fs.readdirSync(dirPath);
    const pattern = new RegExp(`^${bankLetter} - .+\\.rtf$`, "iu");
    for (const file of files) {
      if (pattern.test(file)) {
        fs.unlinkSync(path.join(dirPath, file));
      }
    }
  }

  /**
   * Write all bank RTF files to a directory (used during SD card sync).
   * Only writes files for banks that have a non-empty artist name.
   */
  writeAllBankRtfFiles(dirPath: string, banks: Bank[]): number {
    let written = 0;
    for (const bank of banks) {
      if (bank.artist) {
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
    // Remove any existing RTF file for this bank letter
    this.removeRtfFile(dirPath, bankLetter);

    const filename = `${bankLetter} - ${artistName}.rtf`;
    const filePath = path.join(dirPath, filename);
    fs.writeFileSync(filePath, "{\\rtf1}", "utf-8");
  }
}

export const rtfFileService = new RtfFileService();
