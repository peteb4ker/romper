import type { DbResult, Sample } from "@romper/shared/db/schema.js";
import type {
  FindMissingFilesResult,
  FoundFile,
  MissingFileSearch,
} from "@romper/shared/electronApi.js";

import { isValidKit } from "@romper/shared/kitUtilsShared.js";
import * as fs from "node:fs";
import * as path from "node:path";

import { getAudioMetadataAsync } from "../audioUtils.js";
import { toWavMetadataFields } from "../db/operations/wavMetadataFields.js";
import {
  isKitEditableTx,
  readMissingSamplesTx,
  withDb,
} from "../db/romperDbCoreORM.js";
import {
  canonicalizePath,
  isSameOrInside,
  pathAccess,
} from "../security/pathAccess.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";
import { CardNotRespondingError, withCardWatchdog } from "./cardWatchdog.js";
import { stillMissing } from "./missingSampleRemoval.js";
import { storeCheckSettings, volumeOf } from "./storeCheckService.js";

/** How far a search goes; tests shorten these */
export const missingFileSearchSettings = {
  /** Folders deeper than this under a searched folder aren't listed */
  maxDepth: 12,
  /** The most folder entries one search looks at */
  maxEntries: 100_000,
  /** The most files offered for one missing sample */
  maxFound: 50,
};

/**
 * Folders that are packages on macOS (an app, a library, a project): the
 * search never goes into them (store-check.md, "The walk")
 */
const PACKAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  ".app",
  ".band",
  ".bundle",
  ".component",
  ".fcpbundle",
  ".framework",
  ".kext",
  ".logicx",
  ".musiclibrary",
  ".photoslibrary",
  ".pkg",
  ".plugin",
  ".vst",
  ".vst3",
  ".xpc",
]);

/** The parts of a dialog `pickSearchFolder` uses, so tests can answer it */
export type ShowFolderDialog = (options: {
  defaultPath?: string;
  message: string;
  properties: ["openDirectory"];
  title: string;
}) => Promise<{ canceled: boolean; filePaths: string[] }>;

type Limit = <T>(operation: Promise<T>) => Promise<T>;

/** A folder to search, and the folder its results are named from */
interface SearchRoot {
  base: string;
  folder: string;
}

/** One search's walk: its limits, what it skipped, and whether it stopped */
class Search {
  /** Why it didn't look everywhere, if it didn't */
  incomplete: FindMissingFilesResult["incomplete"] = null;
  /** Rejects when the search is cancelled */
  private readonly aborted: Promise<never>;
  private entries = 0;
  /** It looked at as many entries as one search may */
  private full = false;
  private readonly listed = new Set<string>();
  private readonly notResponding = new Set<string>();

  private constructor(
    private readonly signal: AbortSignal,
    aborted: Promise<never>,
  ) {
    this.aborted = aborted;
  }

  /** A search that stops when `signal` aborts, even mid-operation */
  static start(signal: AbortSignal): Search {
    const aborted = new Promise<never>((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Cancelled")), {
        once: true,
      });
    });
    aborted.catch(() => undefined);
    return new Search(signal, aborted);
  }

  /**
   * Walk each root, one folder at a time, and collect the files whose name
   * is a missing file's (case ignored), with each one's size and whether
   * it matches the row (D3)
   */
  async run(
    roots: SearchRoot[],
    rows: Sample[],
  ): Promise<Map<number, FoundFile[]>> {
    const byName = new Map<string, Sample[]>();
    for (const row of rows) {
      const name = fileNameOf(row).toLowerCase();
      byName.set(name, [...(byName.get(name) ?? []), row]);
    }
    const found = new Map<number, FoundFile[]>();
    for (const root of roots) {
      // One folder at a time: never Promise.all
      await this.walk(root, byName, found); // NOSONAR: one fs operation at a time on purpose
      if (this.stopped()) break;
    }
    return found;
  }

  /** The store's kit folders, each a root whose results are named from the kit: "B1" */
  async storeKitFolders(localStorePath: string): Promise<SearchRoot[]> {
    const entries = await this.list(localStorePath);
    return (entries ?? [])
      .filter((entry) => entry.isDirectory() && isValidKit(entry.name))
      .map((entry) => ({
        base: localStorePath,
        folder: path.join(localStorePath, entry.name),
      }));
  }

  /** Read a candidate's size, and its header when the size matches */
  private async describe(
    filePath: string,
    rows: Sample[],
    root: SearchRoot,
    found: Map<number, FoundFile[]>,
  ): Promise<void> {
    const stat = await this.op(filePath, () => fs.promises.lstat(filePath));
    if (!stat?.isFile()) return;
    let header: null | ReturnType<typeof toWavMetadataFields> | undefined;
    for (const row of rows) {
      if (row.source_path === filePath) continue;
      const list = found.get(row.id) ?? [];
      if (list.length >= missingFileSearchSettings.maxFound) continue;
      const sizeMatches =
        row.source_size === null || row.source_size === stat.size;
      if (sizeMatches && header === undefined) {
        const read = await this.readHeader(filePath); // NOSONAR: one fs operation at a time on purpose
        header =
          read?.success && read.data ? toWavMetadataFields(read.data) : null;
      }
      list.push({
        match: sizeMatches && header != null && sameHeader(row, header),
        mtimeMs: stat.mtimeMs,
        path: filePath,
        size: stat.size,
        where: displayFolder(root.base, path.dirname(filePath)),
      });
      found.set(row.id, list);
    }
  }

  /**
   * Each operation's time limit, and a cancel: a cancelled search doesn't
   * wait for the operation it is in
   */
  private readonly limit: Limit = (operation) =>
    withCardWatchdog(
      Promise.race([operation, this.aborted]),
      storeCheckSettings.operationTimeoutMs,
    );

  /** List a folder, or null if it can't be (gone, refused, not answering) */
  private async list(folder: string): Promise<fs.Dirent[] | null> {
    return this.op(folder, () =>
      fs.promises.readdir(folder, { withFileTypes: true }),
    );
  }

  /**
   * Start one fs operation and wait for it under the time limit. Null when
   * it fails, or when its drive doesn't answer, which skips the drive for
   * the rest of the search: nothing more is started on it.
   */
  private async op<T>(
    target: string,
    operation: () => Promise<T>,
  ): Promise<null | T> {
    const volume = volumeOf(target);
    // A drive that didn't answer gets no more work
    if (this.notResponding.has(volume)) return null;
    try {
      return await this.limit(operation());
    } catch (error) {
      if (error instanceof CardNotRespondingError) {
        this.notResponding.add(volume);
        this.incomplete ??= "notResponding";
      }
      return null;
    }
  }

  /** Read a WAV header, or null if it can't be */
  private readHeader(filePath: string) {
    return this.op(filePath, () => getAudioMetadataAsync(filePath));
  }

  private stopped(): boolean {
    return this.signal.aborted || this.full;
  }

  /**
   * Look at one entry of a folder being listed: queue a folder to list,
   * describe a file with a missing file's name. False once the search has
   * looked at as many entries as it may.
   */
  private async visit(
    entry: fs.Dirent,
    at: { depth: number; folder: string; root: SearchRoot },
    byName: Map<string, Sample[]>,
    found: Map<number, FoundFile[]>,
    pending: { depth: number; folder: string }[],
  ): Promise<boolean> {
    this.entries++;
    if (this.entries > missingFileSearchSettings.maxEntries) {
      this.full = true;
      this.incomplete = "limit";
      return false;
    }
    // Hidden files and folders (.romperdb, ._ files), and links: a link is
    // never followed out of the folder searched
    if (entry.name.startsWith(".") || entry.isSymbolicLink()) return true;
    const entryPath = path.join(at.folder, entry.name);
    if (entry.isDirectory()) {
      if (isPackage(entry.name)) return true;
      if (at.depth >= missingFileSearchSettings.maxDepth) {
        this.incomplete = "limit";
      } else {
        pending.push({ depth: at.depth + 1, folder: entryPath });
      }
    } else if (entry.isFile()) {
      const rows = byName.get(entry.name.toLowerCase());
      if (rows) await this.describe(entryPath, rows, at.root, found);
    }
    return true;
  }

  private async walk(
    root: SearchRoot,
    byName: Map<string, Sample[]>,
    found: Map<number, FoundFile[]>,
  ): Promise<void> {
    const pending: { depth: number; folder: string }[] = [
      { depth: 0, folder: root.folder },
    ];
    while (pending.length > 0 && !this.stopped()) {
      const { depth, folder } = pending.pop() as (typeof pending)[number];
      if (this.listed.has(folder)) continue;
      this.listed.add(folder);
      const entries = await this.list(folder); // NOSONAR: one fs operation at a time on purpose
      for (const entry of entries ?? []) {
        if (this.stopped()) return;
        const at = { depth, folder, root };
        if (!(await this.visit(entry, at, byName, found, pending))) return; // NOSONAR: one fs operation at a time on purpose
      }
    }
  }
}

/**
 * "Find missing files…", the store check's third fix (#823, stage 6 of
 * docs/developer/store-check.md): where to look, and the search.
 *
 * Main shows the folder dialog (D1), so a folder the renderer names is
 * searched only if the user chose it here this session. The search reads
 * the store's kit folders and that folder, nothing else (Q-03). It lists
 * one folder at a time with `fs.promises`, each operation under the store
 * check's time limit; a drive that doesn't answer is skipped for the rest
 * of the search. It skips hidden folders (`.romperdb` among them),
 * packages and links (never followed), stops at a depth and an entry
 * limit and says so, and can be cancelled. One search runs at a time.
 *
 * Matching is D3's: the same name (case ignored), size and header is a
 * match; the same name alone is a possible match. No content hash.
 */
export class MissingFileSearchService {
  private controller: AbortController | null = null;
  /**
   * The files each search offered, by store and sample: `restoreMissingFile`
   * puts back only one of these
   */
  private readonly offered = new Map<string, Set<string>>();
  /** The folders the user chose in `pickSearchFolder`, as resolved */
  private readonly picked = new Set<string>();

  /** Stop the search running now, if any */
  cancel(): void {
    this.controller?.abort();
    this.controller = null;
  }

  /**
   * Search for the kit's missing files in the store's kit folders and in
   * `folder`, a folder the user picked (`pickSearchFolder`)
   */
  async find(
    localStorePath: string,
    kitName: string,
    folder: string,
  ): Promise<DbResult<FindMissingFilesResult>> {
    if (!this.picked.has(path.resolve(folder))) {
      return {
        error: `Access denied: ${folder} wasn't chosen to search`,
        success: false,
      };
    }
    // A newer search, or a cancel, stops this one from here on
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    const { signal } = controller;
    const folderName = path.basename(folder) || folder;
    try {
      const rows = await searchableRows(localStorePath, kitName);
      if (!rows.success) return { error: rows.error, success: false };
      const search = Search.start(signal);
      const roots = [
        ...(await search.storeKitFolders(localStorePath)),
        { base: path.dirname(folder), folder },
      ];
      const found = await search.run(roots, rows.data ?? []);
      if (signal.aborted) {
        return {
          data: {
            cancelled: true,
            files: [],
            folderName,
            incomplete: null,
            kitEditable: false,
          },
          success: true,
        };
      }
      const files = await describeFiles(localStorePath, rows.data ?? [], found);
      const editable = withDb(
        ServicePathManager.getDbPath(localStorePath),
        (db) => isKitEditableTx(db, kitName),
      );
      if (!editable.success) return { error: editable.error, success: false };
      for (const file of files) {
        const key = this.offerKey(localStorePath, file.sampleId);
        const offered = this.offered.get(key) ?? new Set<string>();
        for (const { path: p } of file.found) offered.add(p);
        this.offered.set(key, offered);
      }
      return {
        data: {
          cancelled: false,
          files,
          folderName,
          incomplete: search.incomplete,
          kitEditable: editable.data === true,
        },
        success: true,
      };
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  /** Whether a search offered `foundPath` for this sample */
  offeredFile(
    localStorePath: string,
    sampleId: number,
    foundPath: string,
  ): boolean {
    return (
      this.offered
        .get(this.offerKey(localStorePath, sampleId))
        ?.has(foundPath) ?? false
    );
  }

  /**
   * Show the folder dialog for the kit's missing files, opened at the
   * nearest folder above the first one's old place that still exists (D1).
   * The folder chosen may be read for the rest of the session. Null when
   * the user cancels or no file is missing.
   */
  async pickFolder(
    localStorePath: string,
    kitName: string,
    showDialog: ShowFolderDialog,
    prompt: (fileNames: string[]) => string,
  ): Promise<DbResult<null | string>> {
    const rows = await searchableRows(localStorePath, kitName);
    if (!rows.success) return { error: rows.error, success: false };
    const missing = rows.data ?? [];
    if (missing.length === 0) return { data: null, success: true };
    const message = prompt(missing.map((row) => fileNameOf(row)));
    const defaultPath = await nearestFolder(missing[0].source_path);
    const result = await showDialog({
      ...(defaultPath ? { defaultPath } : {}),
      message,
      properties: ["openDirectory"],
      title: message,
    });
    const folder = result.filePaths[0];
    if (result.canceled || !folder) return { data: null, success: true };
    await pathAccess.grantRead(folder);
    this.picked.add(path.resolve(folder));
    return { data: folder, success: true };
  }

  /** Forget the folders picked and the files offered (tests) */
  reset(): void {
    this.cancel();
    this.offered.clear();
    this.picked.clear();
  }

  private offerKey(localStorePath: string, sampleId: number): string {
    return `${path.resolve(localStorePath)}\0${sampleId}`;
  }
}

/** The shared search */
export const missingFileSearch = new MissingFileSearchService();

/** The name the missing file had */
export function fileNameOf(row: Pick<Sample, "source_path">): string {
  return path.basename(row.source_path);
}

/**
 * Whether a sample's old place is inside the store, and not in its
 * database folder: a found file is copied back there (D2). Both are
 * resolved as path access resolves them, so a link can't lead out.
 */
export async function isInStore(
  localStorePath: string,
  filePath: string,
): Promise<boolean> {
  try {
    const [store, target] = [
      await canonicalizePath(localStorePath),
      await canonicalizePath(filePath),
    ];
    return (
      isSameOrInside(target, store) &&
      !isSameOrInside(target, path.join(store, ".romperdb")) &&
      target !== store
    );
  } catch {
    return false;
  }
}

/** Each searched row with its files: matches first, then by path */
async function describeFiles(
  localStorePath: string,
  rows: Sample[],
  found: Map<number, FoundFile[]>,
): Promise<MissingFileSearch[]> {
  const files: MissingFileSearch[] = [];
  for (const row of rows) {
    files.push({
      fileName: fileNameOf(row),
      found: (found.get(row.id) ?? []).sort(
        (a, b) =>
          Number(b.match) - Number(a.match) || a.path.localeCompare(b.path),
      ),
      inStore: await isInStore(localStorePath, row.source_path), // NOSONAR: one fs operation at a time on purpose
      sampleId: row.id,
    });
  }
  return files;
}

/** "Samples/Drums" for `/Users/me/Samples/Drums`, searched from `/Users/me/Samples` */
function displayFolder(base: string, folder: string): string {
  return path.relative(base, folder).split(path.sep).join("/") || folder;
}

function isPackage(name: string): boolean {
  return PACKAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

/**
 * The nearest folder above `filePath` that is there, for the dialog to
 * open at (D1), or undefined. One stat at a time, each under the limit.
 */
async function nearestFolder(filePath: string): Promise<string | undefined> {
  const limit: Limit = (operation) =>
    withCardWatchdog(operation, storeCheckSettings.operationTimeoutMs);
  let folder = path.dirname(filePath);
  for (;;) {
    try {
      const stat = await limit(fs.promises.stat(folder)); // NOSONAR: one fs operation at a time on purpose
      if (stat.isDirectory()) return folder;
    } catch (error) {
      if (error instanceof CardNotRespondingError) return undefined;
    }
    const parent = path.dirname(folder);
    if (parent === folder) return undefined;
    folder = parent;
  }
}

/** The header fields D3 compares, where the row knows them */
function sameHeader(
  row: Sample,
  header: ReturnType<typeof toWavMetadataFields>,
): boolean {
  return (
    [
      "wav_bit_depth",
      "wav_channels",
      "wav_format_tag",
      "wav_sample_rate",
    ] as const
  ).every((field) => row[field] === null || row[field] === header[field]);
}

/**
 * The rows the search is for, in voice and slot order: the kit's rows
 * recorded missing whose file is still gone, on a drive that is connected
 * (D6). Read again here, in main: the renderer's list is never trusted.
 */
async function searchableRows(
  localStorePath: string,
  kitName: string,
): Promise<DbResult<Sample[]>> {
  const dbDir = ServicePathManager.getDbPath(localStorePath);
  const read = withDb(dbDir, (db) => readMissingSamplesTx(db, kitName));
  if (!read.success || !read.data) {
    return { error: read.error ?? `Kit ${kitName} not found`, success: false };
  }
  const confirmed = new Set(
    (await stillMissing(read.data)).map((row) => row.id),
  );
  return {
    data: read.data
      .filter((row) => confirmed.has(row.id))
      .sort(
        (a, b) =>
          a.voice_number - b.voice_number || a.slot_number - b.slot_number,
      ),
    success: true,
  };
}
