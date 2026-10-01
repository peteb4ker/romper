/**
 * Our own copy of Squarp's factory archive, so a validation run doesn't
 * download ~313 MiB from Squarp's server every time.
 *
 * The copy lives outside the repo (`~/.cache/romper`, or
 * `ROMPER_ARCHIVE_CACHE_DIR`, which CI points at its cache folder) and is
 * checked against the SHA-256 in `factory-archive.json`. The archive is
 * Squarp's content: never commit, publish or upload it.
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";

interface ArchiveRecord {
  checked: string;
  contents: {
    bankFiles: number;
    filesOverTwelvePerVoice: number;
    kitFolders: number;
    wavFiles: number;
  };
  fileName: string;
  sha256: string;
  size: number;
  url: string;
}

const record: ArchiveRecord = JSON.parse(
  readFileSync(new URL("../factory-archive.json", import.meta.url), "utf8"),
);

export const factoryArchive = record;

export interface CachedArchive {
  /** True when this run downloaded it from Squarp */
  downloaded: boolean;
  /** file:// URL for ROMPER_SQUARP_ARCHIVE_URL */
  fileUrl: string;
  path: string;
}

export function archiveCacheDir(): string {
  return (
    process.env.ROMPER_ARCHIVE_CACHE_DIR ||
    path.join(os.homedir(), ".cache", "romper")
  );
}

/**
 * Return a verified local copy, downloading it from Squarp when it's missing
 * or when `fresh` is set. A checksum mismatch after a download means Squarp
 * changed the archive: the error gives the new checksum so updating
 * `factory-archive.json` is a deliberate edit.
 */
export async function ensureFactoryArchive(
  fresh: boolean,
  log: (line: string) => void,
): Promise<CachedArchive> {
  const dir = archiveCacheDir();
  const target = path.join(dir, record.fileName);
  await fs.mkdir(dir, { recursive: true });

  let downloaded = false;
  if (fresh || !(await exists(target))) {
    log(`Downloading ${record.url} to ${target}`);
    await download(record.url, target);
    downloaded = true;
  }

  const sha256 = await hashFile(target);
  if (sha256 !== record.sha256) {
    const message = downloaded
      ? `Squarp's archive changed: ${record.url} now has SHA-256 ${sha256} ` +
        `(expected ${record.sha256}). Check its contents, then update ` +
        `tests/validation/factory-archive.json.`
      : `The cached archive at ${target} doesn't match the recorded ` +
        `SHA-256 (got ${sha256}). Delete it, or run with --fresh.`;
    throw new Error(message);
  }
  log(`Factory archive verified (${sha256.slice(0, 12)}…)`);
  return { downloaded, fileUrl: pathToFileURL(target).href, path: target };
}

export async function hashFile(file: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

async function download(url: string, target: string): Promise<void> {
  const partial = `${target}.part`;
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15 * 60 * 1000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status} from ${url}`);
  }
  await pipeline(
    Readable.fromWeb(response.body as import("node:stream/web").ReadableStream),
    createWriteStream(partial),
  );
  await fs.rename(partial, target);
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
