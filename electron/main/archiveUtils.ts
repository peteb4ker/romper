import type { ReadableStream as WebReadableStream } from "node:stream/web";

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as unzipper from "unzipper";

/**
 * Resource limits applied during archive extraction to defend against
 * decompression bombs (a small archive that expands to an enormous size).
 * Defaults are generous enough for legitimate Squarp sample packs while
 * still bounding worst-case disk usage.
 */
export interface ArchiveLimits {
  maxEntries: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

interface UnzipperEntry {
  autodrain(): void;
  on(event: string, listener: (...args: unknown[]) => void): UnzipperEntry;
  path: string;
  pipe(destination: fs.WriteStream): fs.WriteStream;
  type: string;
}

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxEntries: 10_000,
  maxFileBytes: 512 * 1024 * 1024, // 512 MiB per file
  maxTotalBytes: 2 * 1024 * 1024 * 1024, // 2 GiB total uncompressed
};

// Mutable byte/entry budget shared across entries of a single extraction.
interface ExtractionBudget {
  totalBytes: number;
  validEntries: number;
}

export async function countZipEntries(zipPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    let failure: Error | null = null;
    // The parser can stop before the end of the file and doesn't close what
    // it reads; settle only once the file is closed, or Windows can't delete
    // the zip afterwards
    const source = fs.createReadStream(zipPath);
    source.on("close", () => (failure ? reject(failure) : resolve(count)));
    source
      .pipe(unzipper.Parse())
      .on("entry", (entry: UnzipperEntry) => {
        if (isValidEntry(entry.path)) {
          count++;
        }
        entry.autodrain();
      })
      .on("close", () => source.destroy())
      .on("error", (error: Error) => {
        failure = error;
        source.destroy();
      });
  });
}

/** A download that receives nothing for this long is treated as stalled. */
export const DOWNLOAD_IDLE_TIMEOUT_MS = 60_000;

export interface DownloadOptions {
  /** Checked before the file is kept; a mismatch throws ArchiveChecksumError */
  expectedSha256?: string;
  /** No data for this long fails the download (default 60 s) */
  idleTimeoutMs?: number;
  signal?: AbortSignal;
}

/** The downloaded file's SHA-256 isn't the one the caller expected. */
export class ArchiveChecksumError extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(
      `Archive checksum mismatch: expected SHA-256 ${expected}, got ${actual}`,
    );
    this.name = "ArchiveChecksumError";
  }
}

/**
 * Download `url` to `targetPath`. The body streams to `<targetPath>.part`,
 * hashed as it arrives, and is renamed to `targetPath` only once the status,
 * length and checksum all check out. On failure the partial file is removed
 * and nothing is left at `targetPath`.
 */
export async function downloadArchive(
  url: string,
  targetPath: string,
  onProgress: (percent: null | number) => void,
  options: DownloadOptions = {},
): Promise<void> {
  const idleTimeoutMs = options.idleTimeoutMs ?? DOWNLOAD_IDLE_TIMEOUT_MS;
  const partPath = `${targetPath}.part`;

  // An idle timeout rather than a total one: a slow connection is fine as
  // long as data keeps arriving.
  const idle = new AbortController();
  let idleTimer: NodeJS.Timeout | undefined;
  const resetIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const seconds = Math.round(idleTimeoutMs / 1000);
      idle.abort(
        new Error(
          `Download stalled: no data received for ${seconds} seconds. Check your connection and try again.`,
        ),
      );
    }, idleTimeoutMs);
  };
  const signal = options.signal
    ? AbortSignal.any([options.signal, idle.signal])
    : idle.signal;

  try {
    resetIdleTimer();
    const response = await fetch(url, {
      // Content-Length has to count the bytes we receive
      headers: { "Accept-Encoding": "identity" },
      redirect: "follow",
      signal,
    });
    if (!response.ok || !response.body) {
      const status = `${response.status} ${response.statusText}`.trim();
      throw new Error(`Download failed: the server answered HTTP ${status}`);
    }

    const totalBytes = expectedLength(response.headers);
    const trackProgress = createProgressTracker(totalBytes ?? 0, onProgress);
    const hash = createHash("sha256");
    let receivedBytes = 0;

    await pipeline(
      Readable.fromWeb(response.body as WebReadableStream<Uint8Array>),
      async function* (source: AsyncIterable<Buffer>) {
        for await (const chunk of source) {
          resetIdleTimer();
          hash.update(chunk);
          receivedBytes += chunk.length;
          trackProgress(chunk);
          yield chunk;
        }
      },
      fs.createWriteStream(partPath),
      { signal },
    );

    if (totalBytes !== undefined && receivedBytes !== totalBytes) {
      throw new Error(
        `Download incomplete: received ${receivedBytes} of ${totalBytes} bytes. Try again.`,
      );
    }
    const sha256 = hash.digest("hex");
    if (options.expectedSha256 && sha256 !== options.expectedSha256) {
      throw new ArchiveChecksumError(options.expectedSha256, sha256);
    }
    await fs.promises.rename(partPath, targetPath);
  } catch (error) {
    await fs.promises.rm(partPath, { force: true }).catch(() => {});
    // An abort surfaces as a bare AbortError; report why it was aborted
    throw signal.aborted && signal.reason instanceof Error
      ? signal.reason
      : error;
  } finally {
    clearTimeout(idleTimer);
  }
}

export async function extractZipEntries(
  zipPath: string,
  destDir: string,
  entryCount: number,
  onProgress: (info: { file: string; percent: null | number }) => void,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let processedCount = 0;
    let settled = false;
    let streamClosed = false;
    let failure: Error | null = null;
    const budget: ExtractionBudget = { totalBytes: 0, validEntries: 0 };
    // In-flight file writes. The extraction promise must not settle until every
    // write has finished (or been torn down); otherwise a caller that cleans up
    // the destination directory races still-open write streams, producing
    // intermittent ENOENT failures under parallel load.
    const pendingWrites = new Set<Promise<void>>();
    const openWriteStreams = new Set<fs.WriteStream>();

    // Kept separately: destroying the parser doesn't close the file it reads,
    // and Windows can't delete a file that is still open (the downloaded zip
    // after a cancel or failure)
    const source = fs.createReadStream(zipPath);
    let sourceClosed = false;
    const stream = source.pipe(unzipper.Parse());

    const maybeSettle = () => {
      if (settled || !streamClosed || !sourceClosed || pendingWrites.size > 0)
        return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      if (failure) {
        reject(failure);
      } else {
        resolve();
      }
    };

    const fail = (error: unknown) => {
      if (failure) return;
      failure = error instanceof Error ? error : new Error(String(error));
      stream.destroy();
      source.destroy();
      // Tear down any in-flight writes so their streams close promptly and we
      // don't leave fs operations racing the caller's cleanup.
      for (const writeStream of openWriteStreams) {
        writeStream.destroy();
      }
      maybeSettle();
    };

    stream.on("entry", (entry: UnzipperEntry) => {
      if (settled || failure) {
        entry.autodrain();
        return;
      }

      // Skip macOS artifacts and anything that would escape the destination
      // directory (Zip-Slip). Both the pure-string check and the resolved-path
      // check must pass before we write.
      if (
        !isValidEntry(entry.path) ||
        !isWithinDirectory(destDir, entry.path)
      ) {
        entry.autodrain();
        return;
      }

      budget.validEntries++;
      if (budget.validEntries > limits.maxEntries) {
        fail(
          new Error(
            `Archive exceeds maximum entry count (${limits.maxEntries})`,
          ),
        );
        return;
      }

      processedCount++;
      const percent =
        entryCount > 0 ? Math.floor((processedCount / entryCount) * 100) : null;
      onProgress({ file: entry.path, percent });

      const destPath = path.join(destDir, entry.path);
      const writePromise =
        entry.type === "Directory"
          ? handleDirectoryEntry(entry, destPath, fail)
          : handleFileEntry(
              entry,
              destPath,
              limits,
              budget,
              fail,
              () => failure !== null,
              openWriteStreams,
            );
      pendingWrites.add(writePromise);
      void writePromise.finally(() => {
        pendingWrites.delete(writePromise);
        maybeSettle();
      });
    });

    stream.on("error", fail);
    stream.on("close", () => {
      streamClosed = true;
      // The parser can finish without reading to the end of the file
      source.destroy();
      maybeSettle();
    });
    source.on("close", () => {
      sourceClosed = true;
      maybeSettle();
    });

    // Cancelling setup stops the extraction and tears down open writes; the
    // promise still waits for them to close before it rejects (RE-66)
    function onAbort() {
      fail(signal?.reason ?? new Error("Extraction cancelled"));
    }
    if (signal?.aborted) {
      onAbort();
    } else {
      signal?.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/**
 * Validates a zip entry path. Rejects macOS metadata artifacts and, critically,
 * any entry that would escape the extraction directory (Zip-Slip), i.e. absolute
 * paths or paths containing ".." traversal segments.
 */
export function isValidEntry(entryPath: string): boolean {
  if (!entryPath) {
    return false;
  }

  // Reject absolute paths (POSIX and Windows drive-letter) and parent-directory
  // traversal segments — the core Zip-Slip defence.
  if (path.isAbsolute(entryPath) || /^[a-zA-Z]:[\\/]/.test(entryPath)) {
    return false;
  }
  const segments = entryPath.split(/[\\/]/);
  if (segments.includes("..")) {
    return false;
  }

  return (
    !entryPath.startsWith("__MACOSX/") &&
    !entryPath.includes("/__MACOSX/") &&
    !segments.some((p: string) => p.startsWith("._"))
  );
}

/**
 * Returns true when `entryPath` resolved against `destDir` stays within
 * `destDir`. Defence-in-depth check applied at write time in addition to the
 * pure string check in {@link isValidEntry}.
 */
export function isWithinDirectory(destDir: string, entryPath: string): boolean {
  const resolvedDest = path.resolve(destDir);
  const resolvedTarget = path.resolve(resolvedDest, entryPath);
  return (
    resolvedTarget === resolvedDest ||
    resolvedTarget.startsWith(resolvedDest + path.sep)
  );
}

// Enforce per-file and cumulative size limits as data flows, failing fast when
// either bound is crossed.
function attachSizeGuard(
  entry: UnzipperEntry,
  limits: ArchiveLimits,
  budget: ExtractionBudget,
  fail: (error: unknown) => void,
): void {
  let fileBytes = 0;
  entry.on("data", (...args: unknown[]) => {
    const chunk = args[0] as Buffer;
    fileBytes += chunk.length;
    budget.totalBytes += chunk.length;
    if (fileBytes > limits.maxFileBytes) {
      fail(
        new Error(
          `Archive entry exceeds per-file size limit (${limits.maxFileBytes} bytes): ${entry.path}`,
        ),
      );
    } else if (budget.totalBytes > limits.maxTotalBytes) {
      fail(
        new Error(
          `Archive exceeds total uncompressed size limit (${limits.maxTotalBytes} bytes)`,
        ),
      );
    }
  });
}

// Helper to track download progress
function createProgressTracker(
  totalBytes: number,
  onProgress: (percent: null | number) => void,
) {
  let receivedBytes = 0;
  let lastPercent = 0;

  return (chunk: Buffer) => {
    receivedBytes += chunk.length;
    if (totalBytes > 0) {
      const percent = Math.floor((receivedBytes / totalBytes) * 100);
      if (percent !== lastPercent) {
        onProgress(percent);
        lastPercent = percent;
      }
    } else {
      onProgress(null);
    }
  };
}

// The body length to check against, when the server gives one that counts
// the bytes we receive (an encoded body's Content-Length counts encoded bytes).
function expectedLength(headers: Headers): number | undefined {
  const encoding = headers.get("content-encoding");
  if (encoding && encoding !== "identity") return undefined;
  const length = Number.parseInt(headers.get("content-length") ?? "", 10);
  return Number.isFinite(length) && length >= 0 ? length : undefined;
}

// An extraction failure the user can act on: what failed, where, and why
// (usually a full disk or a folder they can't write to).
function extractionError(action: string, target: string, err: unknown): Error {
  const reason = err instanceof Error ? err.message : String(err);
  return new Error(
    `Extraction failed: couldn't ${action} ${target}: ${reason}`,
    {
      cause: err,
    },
  );
}

// Create a directory entry's folder. A failure fails the extraction: a
// missing folder means its files are missing too.
function handleDirectoryEntry(
  entry: UnzipperEntry,
  destPath: string,
  fail: (error: unknown) => void,
): Promise<void> {
  return new Promise<void>((done) => {
    fs.mkdir(destPath, { recursive: true }, (err) => {
      if (err) fail(extractionError("create folder", destPath, err));
      entry.autodrain();
      done();
    });
  });
}

// Helper function to handle file extraction, enforcing per-file and cumulative
// size limits to defend against decompression bombs. Returns a promise that
// resolves once the write has finished (or been torn down/errored), so the
// caller can wait for every write to complete before settling the extraction.
function handleFileEntry(
  entry: UnzipperEntry,
  destPath: string,
  limits: ArchiveLimits,
  budget: ExtractionBudget,
  fail: (error: unknown) => void,
  isFailed: () => boolean,
  openWriteStreams: Set<fs.WriteStream>,
): Promise<void> {
  return new Promise<void>((resolveWrite) => {
    fs.mkdir(path.dirname(destPath), { recursive: true }, (err) => {
      if (err) {
        fail(extractionError("create folder", path.dirname(destPath), err));
        entry.autodrain();
        resolveWrite();
        return;
      }

      // The extraction may have already failed (e.g. a sibling entry tripped a
      // size or count limit) while this mkdir was in flight. Bail out without
      // opening a write stream so we don't write into a directory the caller is
      // about to tear down.
      if (isFailed()) {
        entry.autodrain();
        resolveWrite();
        return;
      }

      attachSizeGuard(entry, limits, budget, fail);
      pipeEntryToFile(entry, destPath, openWriteStreams, fail, resolveWrite);
    });
  });
}

// Pipe an entry to its destination file, tracking the write stream so the
// extraction can wait for (and tear down) it. `done` is invoked exactly once
// when the write is no longer in flight.
function pipeEntryToFile(
  entry: UnzipperEntry,
  destPath: string,
  openWriteStreams: Set<fs.WriteStream>,
  fail: (error: unknown) => void,
  done: () => void,
): void {
  const writeStream = fs.createWriteStream(destPath);
  openWriteStreams.add(writeStream);
  const finishWrite = () => {
    openWriteStreams.delete(writeStream);
    done();
  };
  // "close" fires after a successful finish and after a destroy(); "error"
  // covers open/write failures. Either way the write is no longer in flight.
  writeStream.on("close", finishWrite);
  writeStream.on("error", (err: unknown) => {
    fail(extractionError("write", destPath, err));
    finishWrite();
  });
  entry.pipe(writeStream);
}
