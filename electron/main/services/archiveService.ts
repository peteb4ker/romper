import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ArchiveChecksumError,
  ArchiveHttpError,
  countZipEntries,
  downloadArchive,
  extractZipEntries,
} from "../archiveUtils.js";
import { logger } from "../utils/logger.js";

/**
 * The Squarp factory sample pack. Main owns this URL: the renderer only names
 * the destination folder, never what is downloaded (RE-03).
 */
export const SQUARP_FACTORY_SAMPLES_URL =
  "https://data.squarp.net/RampleSamplesV1-2.zip";

/**
 * SHA-256 of the archive at SQUARP_FACTORY_SAMPLES_URL (327,886,026 bytes),
 * checked after every download from that URL. It must match
 * `tests/validation/factory-archive.json`, which a unit test enforces.
 */
export const SQUARP_FACTORY_SAMPLES_SHA256 =
  "1b03f1737a21598bdce05e1de344f71a1c9d64a0f314516ccf82c60215eca84c";

/** The outcome of installing the factory archive */
export interface ArchiveInstallResult {
  cancelled?: boolean;
  error?: string;
  /**
   * The download failed in a way another attempt can fix: the connection
   * dropped or stalled, or the server had a temporary problem. A checksum
   * mismatch, a damaged archive or a full disk would fail the same way
   * again, so they aren't retryable (RE-77).
   */
  retryable?: boolean;
  success: boolean;
}

/** File system errors that another download wouldn't fix */
const LOCAL_FS_ERROR_CODES = new Set([
  "EACCES",
  "EDQUOT",
  "ENOSPC",
  "EPERM",
  "EROFS",
]);

/**
 * Service for archive download and extraction operations
 * Extracted from ipcHandlers.ts to separate business logic from IPC routing
 */
export class ArchiveService {
  /**
   * Recursively copy a directory
   */
  copyDirectory(
    src: string,
    dest: string,
  ): { error?: string; success: boolean } {
    try {
      this.copyRecursiveSync(src, dest);
      return { success: true };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : String(e),
        success: false,
      };
    }
  }

  async downloadAndExtractArchive(
    url: string,
    destDir: string,
    progressCallback?: (progress: {
      file?: string;
      percent: null | number;
      phase: string;
    }) => void,
    signal?: AbortSignal,
  ): Promise<ArchiveInstallResult> {
    let tmpZipPath: string | undefined;
    let phase: "download" | "extract" = "download";

    try {
      tmpZipPath = await this.resolveArchivePath(url, progressCallback, signal);
      phase = "extract";
      await this.performExtraction(
        tmpZipPath,
        destDir,
        progressCallback,
        signal,
      );
      progressCallback?.({ percent: 100, phase: "Done" });
      return { success: true };
    } catch (e) {
      if (signal?.aborted) {
        return { cancelled: true, error: "Setup cancelled", success: false };
      }
      const retryable =
        phase === "download" &&
        url.startsWith("https://") &&
        isTransientDownloadFailure(e);
      return {
        error: this.formatErrorMessage(e, phase, retryable),
        retryable,
        success: false,
      };
    } finally {
      // The downloaded zip (about 313 MiB for the factory pack) is only
      // needed until extraction ends, whether it succeeded or not
      if (tmpZipPath) {
        await this.cleanupTempFile(url, tmpZipPath);
      }
    }
  }

  /**
   * Ensure directory exists, creating it recursively if needed
   */
  ensureDirectory(dir: string): { error?: string; success: boolean } {
    try {
      fs.mkdirSync(dir, { recursive: true });
      return { success: true };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : String(e),
        success: false,
      };
    }
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFile(
    url: string,
    tmpZipPath: string,
  ): Promise<void> {
    // Only clean up the temp file if we downloaded it (not for file:// URLs)
    if (!url.startsWith("file://") && tmpZipPath) {
      const fsPromises = fs.promises;
      try {
        await fsPromises.unlink(tmpZipPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Internal helper for recursive directory copying
   */
  private copyRecursiveSync(src: string, dest: string): void {
    fs.mkdirSync(dest);
    for (const item of fs.readdirSync(src)) {
      const srcItem = path.join(src, item);
      const destItem = path.join(dest, item);
      // Use lstat (no symlink following) and skip symlinks entirely: following
      // them would copy the contents of files outside the source tree (e.g. a
      // link planted in an SD-card folder pointing at a sensitive file).
      const stats = fs.lstatSync(srcItem);
      if (stats.isSymbolicLink()) {
        continue;
      }
      if (stats.isDirectory()) {
        this.copyRecursiveSync(srcItem, destItem);
      } else if (stats.isFile()) {
        fs.copyFileSync(srcItem, destItem);
      }
    }
  }

  /**
   * Download archive from HTTPS URL
   */
  private async downloadFromUrl(
    url: string,
    progressCallback?: (progress: {
      file?: string;
      percent: null | number;
      phase: string;
    }) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const os = await import("node:os");
    const tmp = os.tmpdir();
    const tmpZipPath = path.join(tmp, `romper_download_${Date.now()}.zip`);

    await downloadArchive(
      url,
      tmpZipPath,
      (percent: null | number) => {
        progressCallback?.({
          percent,
          phase: "Downloading",
        });
      },
      {
        // Only Squarp's archive has a known checksum; an override URL (tests,
        // a local mirror) is trusted as given
        expectedSha256:
          url === SQUARP_FACTORY_SAMPLES_URL
            ? SQUARP_FACTORY_SAMPLES_SHA256
            : undefined,
        signal,
      },
    );

    return tmpZipPath;
  }

  /**
   * Say why the install failed, in words the setup wizard can show as they
   * are: it no longer replaces them with a generic network error (RE-77).
   */
  private formatErrorMessage(
    e: unknown,
    phase: "download" | "extract",
    retryable: boolean,
  ): string {
    if (e instanceof ArchiveChecksumError) {
      console.error("[ArchiveService]", e.message);
      return (
        "The downloaded factory sample archive didn't match the expected " +
        "checksum, so Romper didn't install it. The download may have been " +
        "damaged on the way, or the archive on Squarp's server has changed " +
        "since this version of Romper was released. Try again, update " +
        "Romper, or set up from an SD card instead."
      );
    }
    let message = e instanceof Error ? e.message : String(e);
    if (message?.includes("premature close")) {
      message =
        "Extraction failed: Archive closed unexpectedly. Please try again.";
    } else if (phase === "extract") {
      message = `The factory sample archive couldn't be unpacked: ${message}`;
    } else if (message === "fetch failed") {
      message = "Couldn't connect to the download server.";
    }
    if (retryable && !/try again/i.test(message)) {
      message += " Check your internet connection and try again.";
    }
    return message;
  }

  /**
   * Handle local file URL
   */
  private handleFileUrl(url: string): string {
    // fileURLToPath, not string slicing: on Windows file:///C:/x.zip is
    // C:\x.zip, and %20 and other escapes must be decoded on every platform
    const tmpZipPath = fileURLToPath(url);
    logger.log("[ArchiveService] Using local file for extraction:", tmpZipPath);

    if (!fs.existsSync(tmpZipPath)) {
      throw new Error(`Local file does not exist: ${tmpZipPath}`);
    }

    return tmpZipPath;
  }

  /**
   * Extract archive with progress tracking
   */
  private async performExtraction(
    tmpZipPath: string,
    destDir: string,
    progressCallback?: (progress: {
      file?: string;
      percent: null | number;
      phase: string;
    }) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    // Count entries for progress tracking
    let entryCount = 0;
    try {
      entryCount = await countZipEntries(tmpZipPath);
    } catch {
      entryCount = 0;
    }

    // Extract with progress callback
    await extractZipEntries(
      tmpZipPath,
      destDir,
      entryCount,
      ({ file, percent }: { file: string; percent: null | number }) => {
        progressCallback?.({
          file,
          percent,
          phase: "Extracting",
        });
      },
      undefined,
      signal,
    );
  }

  /**
   * Download and extract archive from URL or local file
   * Supports both HTTPS URLs and file:// URLs for testing
   */
  /**
   * Handle file URL or download from HTTPS URL
   */
  private async resolveArchivePath(
    url: string,
    progressCallback?: (progress: {
      file?: string;
      percent: null | number;
      phase: string;
    }) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    if (url.startsWith("file://")) {
      return this.handleFileUrl(url);
    }
    // Only allow downloads over HTTPS. Reject http:// and any other scheme
    // explicitly rather than letting it fall through to the HTTPS downloader.
    if (!url.startsWith("https://")) {
      throw new Error(
        "Unsupported archive URL scheme: only https:// and file:// are allowed",
      );
    }
    return this.downloadFromUrl(url, progressCallback, signal);
  }
}

/**
 * The archive the setup wizard installs. `ROMPER_SQUARP_ARCHIVE_URL` (set by
 * whoever launches the app, e.g. e2e tests pointing at a local fixture zip)
 * overrides the default.
 */
export function getFactorySamplesArchiveUrl(): string {
  const override = process.env.ROMPER_SQUARP_ARCHIVE_URL;
  return override && override.trim() !== ""
    ? override
    : SQUARP_FACTORY_SAMPLES_URL;
}

/**
 * Whether downloading again could succeed: a dropped, stalled or cut-short
 * connection, or a temporary server error. Not a checksum mismatch, a
 * missing file (HTTP 4xx) or a local disk error.
 */
function isTransientDownloadFailure(e: unknown): boolean {
  if (e instanceof ArchiveChecksumError) return false;
  if (e instanceof ArchiveHttpError) {
    return e.status >= 500 || e.status === 408 || e.status === 429;
  }
  const code = (e as NodeJS.ErrnoException | undefined)?.code;
  return !(code && LOCAL_FS_ERROR_CODES.has(code));
}

// Export singleton instance
export const archiveService = new ArchiveService();
