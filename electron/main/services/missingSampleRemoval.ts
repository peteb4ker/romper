import type { DbResult, Sample } from "@romper/shared/db/schema.js";
import type { RemoveMissingSamplesResult } from "@romper/shared/electronApi.js";
import type { VoiceSnapshot } from "@romper/shared/undoTypes.js";

import * as fs from "node:fs";

import {
  type ConfirmedMissingSample,
  putBackMissingSamplesTx,
  readMissingSamplesTx,
  removeMissingSamplesTx,
  withDb,
  withDbTransaction,
} from "../db/romperDbCoreORM.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";
import { CardNotRespondingError, withCardWatchdog } from "./cardWatchdog.js";
import { storeCheckSettings, volumeOf } from "./storeCheckService.js";

/**
 * Undo `removeMissingSamples`: put back the voices it returned, if they
 * are still as it left them (`putBackMissingSamplesTx`)
 */
export function putBackMissingSamples(
  localStorePath: string,
  kitName: string,
  voices: VoiceSnapshot[],
): DbResult<RemoveMissingSamplesResult> {
  const dbDir = ServicePathManager.getDbPath(localStorePath);
  return withDbTransaction(dbDir, (db) => ({
    samples: putBackMissingSamplesTx(db, kitName, voices),
    voicesBefore: [],
  }));
}

/**
 * "Remove missing samples", the store check's second fix (#822, stage 5 of
 * docs/developer/store-check.md), and its undo.
 *
 * The rows the store check recorded missing are checked again here, in
 * main, just before they go: the renderer's count is never trusted. A row
 * goes only if its file is still gone and the drive it was on is
 * connected (D6): a missing file on a drive that isn't there is the
 * drive's problem, not the sample's. One fs operation at a time, each
 * under the store check's time limit, and no sync fs call. Allowed on a
 * read-only kit (D5).
 */
export async function removeMissingSamples(
  localStorePath: string,
  kitName: string,
): Promise<DbResult<RemoveMissingSamplesResult>> {
  const dbDir = ServicePathManager.getDbPath(localStorePath);
  const read = withDb(dbDir, (db) => readMissingSamplesTx(db, kitName));
  if (!read.success || !read.data) {
    return { error: read.error ?? `Kit ${kitName} not found`, success: false };
  }
  const confirmed = await stillMissing(read.data);
  return withDbTransaction(dbDir, (db) =>
    removeMissingSamplesTx(db, kitName, confirmed),
  );
}

/** Whether a drive's mount point (or root) is there and answers */
async function driveConnected(
  volume: string,
  limit: <T>(operation: Promise<T>) => Promise<T>,
): Promise<boolean> {
  try {
    await limit(fs.promises.stat(volume));
    return true;
  } catch {
    return false;
  }
}

/** The fs error says there is no such file or folder (or it isn't one) */
function isGone(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/**
 * The rows whose file is still gone, on a drive that is connected. A file
 * that is back, a drive that is gone or didn't answer, and any other
 * failure (permissions, I/O) leave the row alone.
 */
async function stillMissing(rows: Sample[]): Promise<ConfirmedMissingSample[]> {
  const limit = <T>(operation: Promise<T>) =>
    withCardWatchdog(operation, storeCheckSettings.operationTimeoutMs);
  /** Whether each drive asked about is connected; false once one doesn't answer */
  const drives = new Map<string, boolean>();
  const confirmed: ConfirmedMissingSample[] = [];
  for (const row of rows) {
    const volume = volumeOf(row.source_path);
    if (drives.get(volume) === false) continue;
    try {
      // One operation at a time: never Promise.all
      await limit(fs.promises.stat(row.source_path)); // NOSONAR: one fs operation at a time on purpose
      continue; // The file is back
    } catch (error) {
      if (error instanceof CardNotRespondingError) {
        drives.set(volume, false);
        continue;
      }
      if (!isGone(error)) continue;
    }
    if (!drives.has(volume)) {
      drives.set(volume, await driveConnected(volume, limit)); // NOSONAR: one fs operation at a time on purpose
    }
    if (drives.get(volume)) {
      confirmed.push({ id: row.id, source_path: row.source_path });
    }
  }
  return confirmed;
}
