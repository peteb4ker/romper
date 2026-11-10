import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import { withCardWatchdog } from "./services/cardWatchdog.js";
import { removeAppleDoubleCompanion } from "./services/sdCardSafety.js";

/** A temporary name beside `finalPath` (see writeCardFileAtomically) */
export function cardTempPath(finalPath: string, suffix = "tmp"): string {
  const token = crypto.randomBytes(4).toString("hex");
  return path.join(path.dirname(finalPath), `romper-${token}.${suffix}`);
}

/**
 * Write a sample file to the card so it's never left cut off (#882). A
 * write can stop in the middle of a file: the card is pulled, fills up or
 * stops responding. Written straight to its final name, the file was then
 * a shortened WAV under the sample's name, in place of the good copy an
 * earlier write had put there.
 *
 * So `write` writes to a temporary name in the same folder, and only a
 * complete file is renamed over the final name. If anything fails, the
 * final name still holds what it held before, and the temporary file is
 * removed where the card allows. One left behind (a crash, a pulled card)
 * isn't one of the kit's samples, so the next write removes it
 * (`findStaleCardEntries`).
 *
 * The temporary name, `romper-<8 hex digits>.tmp`, is valid on FAT32 and
 * exFAT, well within the card's name limit, can't be a sample's name
 * (`<voice>-<slot> <name>.wav`) and doesn't end in `.wav`. It's random so
 * a write the card watchdog gave up on, still running, can't collide with
 * the next one.
 */
export async function writeCardFileAtomically(
  finalPath: string,
  write: (tempPath: string) => Promise<void>,
): Promise<void> {
  const tempPath = cardTempPath(finalPath);
  try {
    await write(tempPath);
    await replaceCardFile(tempPath, finalPath);
  } catch (error) {
    await removeQuietly(tempPath);
    throw error;
  } finally {
    // macOS keeps a `._` file beside each file on FAT and exFAT; renaming
    // the file moves it to the final name, which the caller cleans up
    await removeAppleDoubleCompanion(tempPath).catch(() => undefined);
  }
}

/** Codes Windows can give for a rename over a file it won't replace */
const REPLACE_REFUSED = new Set(["EACCES", "EBUSY", "EEXIST", "EPERM"]);

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.lstat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Best effort, under the card watchdog: a card that won't remove it now
 * has it removed by the next write
 */
async function removeQuietly(filePath: string): Promise<void> {
  await withCardWatchdog(fs.promises.rm(filePath, { force: true })).catch(
    () => undefined,
  );
}

/**
 * Rename `tempPath` over `finalPath`. A rename replaces an existing file on
 * macOS, Linux and Windows (libuv asks for MOVEFILE_REPLACE_EXISTING), but
 * Windows can refuse when something holds the old file. Then the old file
 * is moved aside first and removed only once the new one has its name; if
 * the new one can't take it, the old one is put back.
 */
async function replaceCardFile(
  tempPath: string,
  finalPath: string,
): Promise<void> {
  try {
    await fs.promises.rename(tempPath, finalPath);
    return;
  } catch (error) {
    if (!REPLACE_REFUSED.has((error as NodeJS.ErrnoException).code ?? "")) {
      throw error;
    }
    if (!(await exists(finalPath))) throw error;
  }

  const asidePath = cardTempPath(finalPath, "old");
  await fs.promises.rename(finalPath, asidePath);
  try {
    await fs.promises.rename(tempPath, finalPath);
  } catch (error) {
    await fs.promises.rename(asidePath, finalPath).catch(() => undefined);
    throw error;
  }
  await removeQuietly(asidePath);
  await removeAppleDoubleCompanion(asidePath).catch(() => undefined);
}
