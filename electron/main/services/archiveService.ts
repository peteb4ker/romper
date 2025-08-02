import * as fs from "fs";
import * as path from "path";

import {
  countZipEntries,
  downloadArchive,
  extractZipEntries,
} from "../archiveUtils.js";

/**
 * Service for archive download and extraction operations
 * Extracted from ipcHandlers.ts to separate business logic from IPC routing
 */
export class ArchiveService {
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
      phase: string;
      percent: number | null;
      file?: string;
    }) => void,
  ): Promise<string> {
    if (url.startsWith("file://")) {
      return this.handleFileUrl(url);
    } else {
      return this.downloadFromUrl(url, progressCallback);
    }
  }

  /**
   * Handle local file URL
   */
  private handleFileUrl(url: string): string {
    const tmpZipPath = url.replace("file://", "");
    console.log(
      "[ArchiveService] Using local file for extraction:",
      tmpZipPath,
    );

    if (!fs.existsSync(tmpZipPath)) {
      throw new Error(`Local file does not exist: ${tmpZipPath}`);
    }

    return tmpZipPath;
  }

  /**
   * Download archive from HTTPS URL
   */
  private async downloadFromUrl(
    url: string,
    progressCallback?: (progress: {
      phase: string;
      percent: number | null;
      file?: string;
    }) => void,
  ): Promise<string> {
    const os = await import("os");
    const tmp = os.tmpdir();
    const tmpZipPath = path.join(tmp, `romper_download_${Date.now()}.zip`);

    await downloadArchive(url, tmpZipPath, (percent: number | null) => {
      progressCallback?.({
        phase: "Downloading",
        percent,
      });
    });

    return tmpZipPath;
  }

  /**
   * Extract archive with progress tracking
   */
  private async performExtraction(
    tmpZipPath: string,
    destDir: string,
    progressCallback?: (progress: {
      phase: string;
      percent: number | null;
      file?: string;
    }) => void,
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
      ({ percent, file }: { percent: number | null; file: string }) => {
        progressCallback?.({
          phase: "Extracting",
          percent,
          file,
        });
      },
    );
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
   * Format error message
   */
  private formatErrorMessage(e: unknown): string {
    let message = e instanceof Error ? e.message : String(e);
    if (message && message.includes("premature close")) {
      message =
        "Extraction failed: Archive closed unexpectedly. Please try again.";
    }
    return message;
  }

  async downloadAndExtractArchive(
    url: string,
    destDir: string,
    progressCallback?: (progress: {
      phase: string;
      percent: number | null;
      file?: string;
    }) => void,
  ): Promise<{ success: boolean; error?: string }> {
    let tmpZipPath: string | undefined;

    try {
      tmpZipPath = await this.resolveArchivePath(url, progressCallback);
      await this.performExtraction(tmpZipPath, destDir, progressCallback);
      progressCallback?.({ phase: "Done", percent: 100 });
      return { success: true };
    } catch (e) {
      if (tmpZipPath) {
        await this.cleanupTempFile(url, tmpZipPath);
      }
      return { success: false, error: this.formatErrorMessage(e) };
    }
  }

  /**
   * Ensure directory exists, creating it recursively if needed
   */
  ensureDirectory(dir: string): { success: boolean; error?: string } {
    try {
      fs.mkdirSync(dir, { recursive: true });
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /**
   * Recursively copy a directory
   */
  copyDirectory(
    src: string,
    dest: string,
  ): { success: boolean; error?: string } {
    try {
      this.copyRecursiveSync(src, dest);
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
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
      if (fs.lstatSync(srcItem).isDirectory()) {
        this.copyRecursiveSync(srcItem, destItem);
      } else {
        fs.copyFileSync(srcItem, destItem);
      }
    }
  }
}

// Export singleton instance
export const archiveService = new ArchiveService();
