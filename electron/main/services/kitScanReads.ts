import type { DbResult, KitScanResult } from "@romper/shared/db/schema.js";

import * as fs from "node:fs";

import type {
  KitFolderScan,
  KitScanIo,
} from "../db/operations/kitScanOperations.js";

import { getAudioMetadataAsync } from "../audioUtils.js";
import {
  type SourceFileStat,
  toWavMetadataFields,
  type WavMetadataFields,
} from "../db/operations/wavMetadataFields.js";
import {
  mergeKitScan,
  planKitScanMerge,
  readKitScanInputs,
  withDb,
} from "../db/romperDbCoreORM.js";

/** Why a merge was refused: it asked for a read that wasn't made */
const READS_CHANGED =
  "The kit's samples changed while it was being scanned. Scan it again.";

/** The kit's rows, voices and flags, as a scan merges into them */
type KitScanInputs = ReturnType<typeof readKitScanInputs>;

/** The files a dry run of the merge asked about */
interface WantedReads {
  headers: Set<string>;
  stats: Set<string>;
}

/**
 * How often a merge is tried when the kit's rows change between the reads
 * and the transaction (an edit landing during the scan)
 */
const MAX_ATTEMPTS = 3;

/**
 * A dry run asks for the stats of the rows' files, then the next one for
 * the headers of the files that exist, and a third finds nothing more
 */
const MAX_ROUNDS = 4;

/** What a merge's file reads found, read ahead one file at a time */
class KitScanReads {
  /** The `io` the transaction merges with: only what was read */
  get io(): KitScanIo {
    return {
      readMetadata: (filePath) => {
        const read = this.headers.get(filePath);
        if (read === undefined) throw new Error(READS_CHANGED);
        return read;
      },
      statFile: (filePath) => {
        const read = this.stats.get(filePath);
        if (read === undefined) throw new Error(READS_CHANGED);
        return read;
      },
    };
  }

  private readonly headers = new Map<string, null | WavMetadataFields>();

  private readonly stats = new Map<string, null | SourceFileStat>();

  /** Read every file the merge into `inputs` and `folder` asks about */
  async readFor(inputs: KitScanInputs, folder: KitFolderScan): Promise<void> {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const wanted: WantedReads = { headers: new Set(), stats: new Set() };
      planKitScanMerge({ ...inputs, folder, io: this.recorder(wanted) });
      if (wanted.stats.size === 0 && wanted.headers.size === 0) return;
      // One file operation at a time: a kit has few files, and the pool is
      // shared with the write's copies
      for (const filePath of wanted.stats) {
        this.stats.set(filePath, await statFileAsync(filePath)); // NOSONAR: one fs operation at a time on purpose
      }
      for (const filePath of wanted.headers) {
        this.headers.set(filePath, await readWavMetadataAsync(filePath)); // NOSONAR: one fs operation at a time on purpose
      }
    }
  }

  /**
   * An `io` for planning: what was read is answered, anything else is
   * noted in `wanted` and answered as a file that isn't there
   */
  private recorder(wanted: WantedReads): KitScanIo {
    return {
      readMetadata: (filePath) => {
        const read = this.headers.get(filePath);
        if (read !== undefined) return read;
        wanted.headers.add(filePath);
        return null;
      },
      statFile: (filePath) => {
        const read = this.stats.get(filePath);
        if (read !== undefined) return read;
        wanted.stats.add(filePath);
        return null;
      },
    };
  }
}

/**
 * Merge a kit folder scan into the database (`mergeKitScan`), reading the
 * files it needs with `fs.promises` first, so the scan holds the main
 * thread only for the transaction (#821, Q-01).
 *
 * The merge itself is synchronous (it runs inside one database
 * transaction), so it can't wait on a read. The reads it will make are
 * found by planning the merge with a recording `io`: each file it asks
 * about is read, one at a time, and the plan is made again, until it asks
 * for nothing new. The transaction then runs on those answers. If the
 * kit's rows changed in between and the merge asks for a file that wasn't
 * read, it is rolled back and tried again.
 */
export async function mergeKitScanReadingAsync(
  dbDir: string,
  kitName: string,
  folder: KitFolderScan,
): Promise<DbResult<KitScanResult>> {
  const reads = new KitScanReads();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const inputs = withDb(dbDir, (db) => readKitScanInputs(db, kitName));
    if (!inputs.success || !inputs.data) {
      return { error: inputs.error ?? "Kit not found", success: false };
    }
    await reads.readFor(inputs.data, folder); // NOSONAR: each attempt reads the rows it just loaded
    const merged = mergeKitScan(dbDir, kitName, folder, reads.io);
    if (merged.success || merged.error !== READS_CHANGED) return merged;
  }
  return { error: READS_CHANGED, success: false };
}

/** A file's header fields, with the size and time from before it was read */
export async function readWavMetadataAsync(
  filePath: string,
): Promise<null | WavMetadataFields> {
  const stat = await statFileAsync(filePath);
  const header = await getAudioMetadataAsync(filePath);
  if (!header.success || !header.data) return null;
  return toWavMetadataFields(header.data, stat);
}

/** A file's size and modification time, or null when it isn't there */
export async function statFileAsync(
  filePath: string,
): Promise<null | SourceFileStat> {
  try {
    const { mtimeMs, size } = await fs.promises.stat(filePath);
    return { mtimeMs, size };
  } catch {
    return null;
  }
}
