import * as fs from "node:fs";
import * as path from "node:path";
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
    fs.createReadStream(zipPath)
      .pipe(unzipper.Parse())
      .on("entry", (entry: UnzipperEntry) => {
        if (isValidEntry(entry.path)) {
          count++;
        }
        entry.autodrain();
      })
      .on("close", () => resolve(count))
      .on("error", reject);
  });
}

export async function downloadArchive(
  url: string,
  tmpZipPath: string,
  onProgress: (percent: null | number) => void,
): Promise<void> {
  const https = await import("node:https");

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(tmpZipPath);
    setupFileStream(fileStream, resolve, reject);

    const request = https.get(url, (response) => {
      const totalBytes = Number.parseInt(
        response.headers["content-length"] || "0",
        10,
      );

      const trackProgress = createProgressTracker(totalBytes, onProgress);
      response.on("data", trackProgress);
      response.pipe(fileStream);
    });

    request.on("error", reject);
  });
}

export async function extractZipEntries(
  zipPath: string,
  destDir: string,
  entryCount: number,
  onProgress: (info: { file: string; percent: null | number }) => void,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
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

    const stream = fs.createReadStream(zipPath).pipe(unzipper.Parse());

    const maybeSettle = () => {
      if (settled || !streamClosed || pendingWrites.size > 0) return;
      settled = true;
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
      if (entry.type === "Directory") {
        handleDirectoryEntry(entry, destPath);
      } else {
        const writePromise = handleFileEntry(
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
      }
    });

    stream.on("error", fail);
    stream.on("close", () => {
      streamClosed = true;
      maybeSettle();
    });
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

// Helper function to handle directory extraction
function handleDirectoryEntry(entry: UnzipperEntry, destPath: string): void {
  fs.mkdir(destPath, { recursive: true }, (err) => {
    if (err) console.warn("Failed to create directory:", destPath, err);
    entry.autodrain();
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
        console.warn(
          "Failed to create parent directory:",
          path.dirname(destPath),
          err,
        );
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
      pipeEntryToFile(entry, destPath, openWriteStreams, resolveWrite);
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
    warnWriteFailure(destPath, err);
    finishWrite();
  });
  entry.pipe(writeStream);
}

// Helper to setup file stream handlers
function setupFileStream(
  fileStream: fs.WriteStream,
  resolve: () => void,
  reject: (error: unknown) => void,
) {
  fileStream.on("finish", () => {
    fileStream.close(() => resolve());
  });
  fileStream.on("error", reject);
}

// Defer the warning so it doesn't interleave with the synchronous teardown path
// (matches the original behaviour of logging write failures out-of-band).
function warnWriteFailure(destPath: string, err: unknown): void {
  setImmediate(() => {
    console.warn("Failed to write file:", destPath, err);
  });
}
